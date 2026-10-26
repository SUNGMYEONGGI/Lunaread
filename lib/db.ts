// Tiny IndexedDB wrapper: `docs` holds paper metadata + user data, `files` holds PDF bytes.
import type { Doc } from './types.ts';

let dbp: Promise<IDBDatabase> | undefined;
function db() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('lunaread', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('docs', { keyPath: 'id' });
      req.result.createObjectStore('files');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const listDocs = async () => (await tx<Doc[]>('docs', 'readonly', s => s.getAll())).sort((a, b) => (b.openedAt || b.addedAt) - (a.openedAt || a.addedAt));
export const getDoc = (id: string) => tx<Doc | undefined>('docs', 'readonly', s => s.get(id));
export const putDoc = (doc: Doc) => tx<void>('docs', 'readwrite', s => s.put(doc));
export const getFile = (id: string) => tx<Uint8Array>('files', 'readonly', s => s.get(id));
export async function deleteDoc(id: string) {
  await tx('docs', 'readwrite', s => s.delete(id));
  await tx('files', 'readwrite', s => s.delete(id));
}

export async function addPdf(bytes: Uint8Array, { title, url }: { title?: string; url?: string } = {}) {
  const id = crypto.randomUUID();
  const doc: Doc = { id, title: title || 'Untitled', url, addedAt: Date.now(), folder: '', marks: [], chat: [], cards: [], translations: {} };
  await tx('files', 'readwrite', s => s.put(bytes, id));
  await putDoc(doc);
  return doc;
}
