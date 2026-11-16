import { AttendanceRecord, SyncBaseline } from '../types';

const DB_NAME = 'lentera_belajar_offline_v1';
const DB_VERSION = 1;
const STORE_ATTENDANCE = 'attendance_queue';
const STORE_SYNC_META = 'sync_meta';

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di browser ini.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ATTENDANCE)) {
        const store = db.createObjectStore(STORE_ATTENDANCE, { keyPath: 'id' });
        store.createIndex('institutionId', 'institutionId', { unique: false });
        store.createIndex('pendingSync', 'pendingSync', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_META)) {
        db.createObjectStore(STORE_SYNC_META, { keyPath: 'institutionId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Gagal membuka IndexedDB.'));
  });
}

export async function enqueueOfflineAttendance(
  record: AttendanceRecord
): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATTENDANCE, 'readwrite');
    tx.objectStore(STORE_ATTENDANCE).put({
      ...record,
      pendingSync: true,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllOfflineAttendance(
  institutionId?: string
): Promise<AttendanceRecord[]> {
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ATTENDANCE, 'readonly');
      const req = tx.objectStore(STORE_ATTENDANCE).getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as AttendanceRecord[];
        resolve(
          institutionId
            ? items.filter((i) => i.institutionId === institutionId)
            : items
        );
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getPendingOfflineAttendance(
  institutionId?: string
): Promise<AttendanceRecord[]> {
  const all = await getAllOfflineAttendance(institutionId);
  return all.filter((r) => r.pendingSync);
}

export async function markOfflineAttendanceSynced(
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATTENDANCE, 'readwrite');
    const store = tx.objectStore(STORE_ATTENDANCE);
    for (const id of ids) {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const rec = getReq.result as AttendanceRecord | undefined;
        if (rec) {
          store.put({ ...rec, pendingSync: false });
        }
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSyncBaseline(baseline: SyncBaseline): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_META, 'readwrite');
      tx.objectStore(STORE_SYNC_META).put(baseline);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore IndexedDB errors in constrained environments
  }
}

export async function getSyncBaseline(
  institutionId: string
): Promise<SyncBaseline | null> {
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_META, 'readonly');
      const req = tx.objectStore(STORE_SYNC_META).get(institutionId);
      req.onsuccess = () => resolve((req.result as SyncBaseline) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
