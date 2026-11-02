import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
};

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB for multi-year workout history

function getLanIPv4Addresses() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const net of entries) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function readRequestBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload zu groß'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createGymLogServer({
  rootDir = __dirname,
  dataFilePath = path.join(rootDir, 'data', 'gymlog-backup.json'),
} = {}) {
  const resolvedRoot = path.resolve(rootDir);

  return http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      const pathname = decodeURIComponent(parsedUrl.pathname);

      // --- Local Mac Automatic History Sync API ---
      if (pathname === '/api/sync') {
        if (req.method === 'GET') {
          try {
            const raw = await fs.readFile(dataFilePath, 'utf8');
            const parsed = JSON.parse(raw);
            sendJson(res, 200, { ok: true, data: parsed });
          } catch (err) {
            if (err && err.code === 'ENOENT') {
              sendJson(res, 200, { ok: true, data: null });
            } else {
              sendJson(res, 500, { ok: false, error: 'Fehler beim Lesen des lokalen Backups' });
            }
          }
          return;
        }

        if (req.method === 'POST') {
          let rawBody = '';
          try {
            rawBody = await readRequestBody(req);
          } catch {
            sendJson(res, 413, { ok: false, error: 'Backup-Daten zu groß' });
            return;
          }

          let parsed;
          try {
            parsed = JSON.parse(rawBody);
          } catch {
            sendJson(res, 400, { ok: false, error: 'Ungültiges JSON-Format' });
            return;
          }

          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            sendJson(res, 400, { ok: false, error: 'Ungültiges Backup-Objekt' });
            return;
          }

          const savedAt = new Date().toISOString();
          const enriched = {
            ...parsed,
            updatedAt: parsed.updatedAt || savedAt,
            serverSavedAt: savedAt,
          };

          await fs.mkdir(path.dirname(dataFilePath), { recursive: true });
          const tmpPath = `${dataFilePath}.${process.pid}.${Date.now()}.tmp`;
          await fs.writeFile(tmpPath, JSON.stringify(enriched, null, 2), 'utf8');
          await fs.rename(tmpPath, dataFilePath);

          sendJson(res, 200, { ok: true, savedAt });
          return;
        }

        sendJson(res, 405, { ok: false, error: 'Methode nicht erlaubt' });
        return;
      }

      // --- Static PWA Asset Serving ---
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Methode nicht erlaubt');
        return;
      }

      const relTarget = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      // Block access to server internals or hidden dotfiles
      if (
        relTarget === 'server.mjs' ||
        relTarget === 'start.command' ||
        relTarget.startsWith('data/') ||
        relTarget.startsWith('tests/') ||
        relTarget.split('/').some((seg) => seg.startsWith('.'))
      ) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Nicht gefunden');
        return;
      }

      const candidatePath = path.resolve(resolvedRoot, relTarget);
      if (
        candidatePath !== resolvedRoot &&
        !candidatePath.startsWith(resolvedRoot + path.sep)
      ) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Zugriff verweigert');
        return;
      }

      let targetFile = candidatePath;
      let stat = null;
      try {
        stat = await fs.stat(targetFile);
        if (stat.isDirectory()) {
          targetFile = path.join(targetFile, 'index.html');
          stat = await fs.stat(targetFile);
        }
      } catch {
        // SPA fallback ONLY for extensionless navigation routes
        if (!path.extname(relTarget)) {
          targetFile = path.join(resolvedRoot, 'index.html');
          stat = await fs.stat(targetFile).catch(() => null);
        }
      }

      if (!stat || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Datei nicht gefunden');
        return;
      }

      const ext = path.extname(targetFile).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const isSwOrHtml =
        ext === '.html' || path.basename(targetFile) === 'sw.js' || ext === '.webmanifest';

      const headers = {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Cache-Control': isSwOrHtml ? 'no-cache' : 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      };

      res.writeHead(200, headers);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const content = await fs.readFile(targetFile);
      res.end(content);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Interner Serverfehler');
    }
  });
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  const server = createGymLogServer();

  server.listen(port, host, () => {
    const actualPort = server.address()?.port || port;
    const lanIps = getLanIPv4Addresses();
    console.log('\n========================================================');
    console.log('  GymLog WebApp läuft bereit für Mac & iPhone!');
    console.log('========================================================');
    console.log(`  Lokal am Mac:     http://localhost:${actualPort}`);
    if (lanIps.length > 0) {
      for (const ip of lanIps) {
        console.log(`  Auf dem iPhone:   http://${ip}:${actualPort}`);
      }
      console.log('\n  Tipp fürs iPhone (gleiches WLAN):');
      console.log('  1. Öffne die iPhone-Adresse in Safari');
      console.log('  2. Tippe auf Teilen -> "Zum Home-Bildschirm"');
      console.log('  3. Deine Historie wird lokal + automatisch in ./data/gymlog-backup.json gesichert!');
    }
    console.log('========================================================\n');
  });
}
