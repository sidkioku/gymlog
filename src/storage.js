const LS_KEY = 'gymlog_webapp_state_v2';
const IDB_NAME = 'GymLogWebDB';
const IDB_VERSION = 1;
const IDB_STORE = 'kv';
const IDB_STATE_KEY = 'full_state';

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

function hasIndexedDB() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('IndexedDB nicht verfügbar'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB Fehler'));
  });
}

async function idbGet(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      db.close();
      resolve(req.result ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function idbSet(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export class StorageEngine {
  constructor() {
    this.status = {
      persisted: false,
      indexedDBAvailable: hasIndexedDB(),
      localStorageAvailable: hasLocalStorage(),
      serverSyncAvailable: false,
      lastSavedAt: null,
    };
    this._syncTimer = null;
  }

  loadSyncSnapshot() {
    if (!hasLocalStorage()) return null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async initAndLoadLatest() {
    // Request persistent storage from WebKit / browser so iOS does not auto-evict data
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persist === 'function'
    ) {
      try {
        const already = await navigator.storage.persisted();
        this.status.persisted = already || (await navigator.storage.persist());
      } catch {
        this.status.persisted = false;
      }
    }

    const lsData = this.loadSyncSnapshot();
    let idbData = null;

    if (this.status.indexedDBAvailable) {
      try {
        idbData = await idbGet(IDB_STATE_KEY);
      } catch {
        this.status.indexedDBAvailable = false;
      }
    }

    // Check optional local Mac server sync endpoint (/api/sync) only on local/LAN hosts
    let serverData = null;
    const host = typeof location !== 'undefined' ? location.hostname || '' : '';
    const isLocalHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

    if (
      isLocalHost &&
      typeof fetch === 'function' &&
      typeof location !== 'undefined' &&
      location.protocol.startsWith('http')
    ) {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 1000);
        const res = await fetch('./api/sync', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: ctrl.signal,
        });
        clearTimeout(timeout);
        if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
          const json = await res.json();
          if (json && json.ok) {
            this.status.serverSyncAvailable = true;
            serverData = json.data || null;
          }
        }
      } catch {
        this.status.serverSyncAvailable = false;
      }
    }

    // Pick newest snapshot by updatedAt (or highest session count if first load)
    const candidates = [lsData, idbData, serverData].filter(Boolean);
    if (!candidates.length) return null;

    candidates.sort((a, b) => {
      const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (tB !== tA) return tB - tA;
      return (b.sessions?.length || 0) - (a.sessions?.length || 0);
    });

    const winner = candidates[0];
    // Self-heal all storage layers with winner
    await this.saveState(winner, { skipServerDebounce: true });
    return winner;
  }

  async saveState(snapshot, opts = {}) {
    const payload = {
      ...snapshot,
      updatedAt: snapshot.updatedAt || new Date().toISOString(),
    };
    this.status.lastSavedAt = payload.updatedAt;

    if (hasLocalStorage()) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(payload));
      } catch {
        // Ignore quota errors because IndexedDB handles unlimited large history
      }
    }

    if (this.status.indexedDBAvailable) {
      try {
        await idbSet(IDB_STATE_KEY, payload);
      } catch {
        // Fallback already in localStorage
      }
    }

    if (this.status.serverSyncAvailable && !opts.skipServer) {
      if (opts.skipServerDebounce) {
        this._pushToServer(payload);
      } else {
        clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => this._pushToServer(payload), 350);
      }
    }
  }

  async _pushToServer(payload) {
    if (!this.status.serverSyncAvailable || typeof fetch !== 'function') return;
    try {
      await fetch('./api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Offline or server stopped; local IndexedDB & localStorage remain intact
    }
  }
}

export async function shareOrDownloadFile({ filename, content, mimeType = 'application/json', title = 'GymLog Backup' }) {
  const blob = new Blob([content], { type: mimeType });
  const file = typeof File !== 'undefined' ? new File([blob], filename, { type: mimeType }) : null;

  // On iPhone Safari / PWA, navigator.share({ files }) opens the native iOS Share Sheet ("In Dateien sichern" / iCloud Drive / AirDrop)
  if (
    file &&
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function'
  ) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          files: [file],
        });
        return { method: 'share', ok: true };
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return { method: 'cancelled', ok: false };
      }
      // Fall through to standard download
    }
  }

  if (typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { method: 'download', ok: true };
  }

  return { method: 'none', ok: false };
}

export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true
  );
}
