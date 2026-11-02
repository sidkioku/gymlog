import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { createGymLogServer } from '../server.mjs';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');

function invokeServer(server, { method = 'GET', url = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = new Readable({
      read() {
        if (body !== null) {
          this.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8'));
        }
        this.push(null);
      },
    });
    req.method = method;
    req.url = url;
    req.headers = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );

    let statusCode = 200;
    const resHeaders = {};
    const chunks = [];

    const res = {
      writeHead(code, hdrs = {}) {
        statusCode = code;
        for (const [k, v] of Object.entries(hdrs)) {
          resHeaders[k.toLowerCase()] = v;
        }
      },
      setHeader(k, v) {
        resHeaders[k.toLowerCase()] = v;
      },
      write(chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      },
      end(chunk) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);
        resolve({
          status: statusCode,
          headers: resHeaders,
          buffer,
          text: () => buffer.toString('utf8'),
          json: () => JSON.parse(buffer.toString('utf8')),
        });
      },
    };

    try {
      server.emit('request', req, res);
    } catch (err) {
      reject(err);
    }
  });
}

test('All JS/MJS files pass node --check syntax validation', async () => {
  const jsFiles = [
    'server.mjs',
    'sw.js',
    'src/app.js',
    'src/audio.js',
    'src/chart.js',
    'src/csv.js',
    'src/icons.js',
    'src/models.js',
    'src/overload.js',
    'src/storage.js',
    'src/store.js',
    'src/weight.js',
    'src/views/dashboard.js',
    'src/views/history.js',
    'src/views/machines.js',
    'src/views/settings.js',
    'src/views/workout.js',
  ];

  for (const rel of jsFiles) {
    const abs = path.join(ROOT_DIR, rel);
    await execFileAsync(process.execPath, ['--check', abs]);
  }
});

test('Service Worker is valid classic script for iOS Safari and registers install/activate/fetch', async () => {
  const swSource = await fs.readFile(path.join(ROOT_DIR, 'sw.js'), 'utf8');
  assert.ok(!/^\s*(import|export)\s/m.test(swSource), 'sw.js must not use ES module import/export');

  const registeredEvents = [];
  const sandbox = {
    globalThis: {},
    self: {
      location: { origin: 'http://localhost:3000' },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
      addEventListener: (evtName) => registeredEvents.push(evtName),
    },
    caches: {
      open: async () => ({ addAll: async () => {}, match: async () => null, put: async () => {} }),
      keys: async () => [],
      delete: async () => true,
    },
    URL,
    Response,
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(swSource, sandbox, { filename: 'sw.js' });
  assert.deepEqual(registeredEvents.sort(), ['activate', 'fetch', 'install']);
  assert.ok(Array.isArray(sandbox.__GYMLOG_PRECACHE_ASSETS__));
  assert.ok(sandbox.__GYMLOG_PRECACHE_ASSETS__.length >= 24);
});

test('index.html mount IDs and all view data-action handlers match src/app.js', async () => {
  const indexHtml = await fs.readFile(path.join(ROOT_DIR, 'index.html'), 'utf8');
  const appJs = await fs.readFile(path.join(ROOT_DIR, 'src/app.js'), 'utf8');

  const requiredIds = [
    'app-main',
    'mini-workout-slot',
    'workout-overlay-slot',
    'bottom-tab-bar',
    'app-modal',
    'app-prompt-modal',
    'toast-container',
  ];
  for (const id of requiredIds) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html contains #${id}`);
  }

  // Extract all case '...' action names handled in src/app.js
  const handledActions = new Set();
  for (const m of appJs.matchAll(/case\s+'([^']+)'\s*:/g)) {
    handledActions.add(m[1]);
  }

  // Scan all view files + chart.js + app.js for static data-action="xyz"
  const templateFiles = [
    'src/chart.js',
    'src/app.js',
    'src/views/dashboard.js',
    'src/views/machines.js',
    'src/views/workout.js',
    'src/views/history.js',
    'src/views/settings.js',
  ];

  for (const rel of templateFiles) {
    const content = await fs.readFile(path.join(ROOT_DIR, rel), 'utf8');
    for (const m of content.matchAll(/data-action="([^"$]+)"/g)) {
      const actionName = m[1].trim();
      assert.ok(
        handledActions.has(actionName),
        `data-action="${actionName}" in ${rel} has a handler in src/app.js`
      );
    }
  }
});

test('HTTP Server serves all precache assets with proper MIME types and persists /api/sync', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gymlog-e2e-'));
  const tempDataFile = path.join(tmpDir, 'gymlog-backup.json');

  const server = createGymLogServer({
    rootDir: ROOT_DIR,
    dataFilePath: tempDataFile,
  });

  try {
    // 1. Load precache asset list from sw.js
    const swSource = await fs.readFile(path.join(ROOT_DIR, 'sw.js'), 'utf8');
    const sandbox = { self: {} };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(swSource, sandbox);
    const assets = sandbox.__GYMLOG_PRECACHE_ASSETS__;

    for (const relAsset of assets) {
      const cleanPath = relAsset.replace(/^\.\//, '');
      const res = await invokeServer(server, { method: 'GET', url: `/${cleanPath}` });
      assert.equal(res.status, 200, `GET /${cleanPath} returns 200`);
      assert.ok(res.buffer.byteLength > 0, `/${cleanPath} is non-empty`);

      const ct = res.headers['content-type'] || '';
      if (!cleanPath || cleanPath.endsWith('.html')) assert.ok(ct.includes('text/html'));
      if (cleanPath.endsWith('.css')) assert.ok(ct.includes('text/css'));
      if (cleanPath.endsWith('.js')) assert.ok(ct.includes('text/javascript'));
      if (cleanPath.endsWith('.png')) assert.ok(ct.includes('image/png'));
      if (cleanPath.endsWith('.webmanifest')) assert.ok(ct.includes('application/manifest+json'));
    }

    // 2. Security & HTTP method checks
    const headIndex = await invokeServer(server, { method: 'HEAD', url: '/' });
    assert.equal(headIndex.status, 200);
    assert.equal(headIndex.buffer.byteLength, 0);

    const resServerFile = await invokeServer(server, { method: 'GET', url: '/server.mjs' });
    assert.equal(resServerFile.status, 404);
    const resDotFile = await invokeServer(server, { method: 'GET', url: '/.gitignore' });
    assert.equal(resDotFile.status, 404);
    const resTraversal = await invokeServer(server, { method: 'GET', url: '/..%2F..%2Fetc%2Fpasswd' });
    assert.ok(resTraversal.status === 403 || resTraversal.status === 404);
    const resMissingJs = await invokeServer(server, { method: 'GET', url: '/src/does-not-exist.js' });
    assert.equal(resMissingJs.status, 404);

    // 3. Test GET /api/sync (initially empty) -> POST /api/sync -> GET /api/sync
    const initSync = (await invokeServer(server, { method: 'GET', url: '/api/sync' })).json();
    assert.equal(initSync.ok, true);
    assert.equal(initSync.data, null);

    const badJsonRes = await invokeServer(server, {
      method: 'POST',
      url: '/api/sync',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });
    assert.equal(badJsonRes.status, 400);

    const samplePayload = {
      version: 2,
      updatedAt: '2026-11-02T14:55:00.000Z',
      machines: [{ id: 'm1', name: 'Brustpresse', targetWeight: 42.5 }],
      sessions: [{ id: 's1', machineId: 'm1', machineName: 'Brustpresse', sets: [] }],
      settings: { preferredUnit: 'kg' },
    };

    const postRes = (
      await invokeServer(server, {
        method: 'POST',
        url: '/api/sync',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload),
      })
    ).json();
    assert.equal(postRes.ok, true);
    assert.ok(postRes.savedAt);

    const afterSync = (await invokeServer(server, { method: 'GET', url: '/api/sync' })).json();
    assert.equal(afterSync.ok, true);
    assert.equal(afterSync.data.machines[0].targetWeight, 42.5);
    assert.equal(afterSync.data.sessions.length, 1);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
