// Demo-build stand-in for `firebase/storage`: uploaded photos and PDFs are kept
// in this browser's IndexedDB.
type Ref = { fullPath: string };

const urls = new Map<string, string>();

function files<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('gooddog-demo-files', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('files');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = run(open.result.transaction('files', mode).objectStore('files'));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    };
  });
}

export const getStorage = (..._args: unknown[]) => ({});
export const connectStorageEmulator = (..._args: unknown[]) => undefined;
export const ref = (_storage: unknown, path: string): Ref => ({ fullPath: path });

export async function uploadBytes(r: Ref, blob: Blob, meta?: { contentType?: string }) {
  const typed = meta?.contentType && meta.contentType !== blob.type ? new Blob([blob], { type: meta.contentType }) : blob;
  await files('readwrite', (s) => s.put(typed, r.fullPath));
  return { ref: r };
}

export async function getDownloadURL(r: Ref) {
  const cached = urls.get(r.fullPath);
  if (cached) return cached;
  const blob = await files<Blob | undefined>('readonly', (s) => s.get(r.fullPath));
  if (!blob) throw Object.assign(new Error('File not found'), { code: 'storage/object-not-found' });
  const url = URL.createObjectURL(blob);
  urls.set(r.fullPath, url);
  return url;
}

export async function deleteObject(r: Ref) {
  urls.delete(r.fullPath);
  await files('readwrite', (s) => s.delete(r.fullPath));
}
