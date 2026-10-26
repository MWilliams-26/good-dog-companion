import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { doc, deleteDoc } from 'firebase/firestore';
import { storage, db } from './firebase';
import { createRecord, newId, updateRecord } from './db';
import type { Dog, DogDocument } from './types';

export const ACCEPTED = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
const MAX_BYTES = 15 * 1024 * 1024;

/** Downscale large phone photos before upload so they load quickly in the field. */
async function shrinkImage(file: File, maxSide = 1600): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.86));
}

export async function uploadDogFile(dog: Pick<Dog, 'id'>, file: File, kind: DogDocument['kind']): Promise<string> {
  if (!ACCEPTED.split(',').includes(file.type)) throw new Error('Only photos (JPEG, PNG, WebP, HEIC) and PDFs can be attached.');
  if (file.size > MAX_BYTES) throw new Error('Files must be smaller than 15 MB.');
  const blob = kind === 'photo' ? await shrinkImage(file) : file;
  const id = newId('dogDocuments');
  const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-80);
  const path = `dogs/${dog.id}/${id}-${safe}`;
  const contentType = blob === file ? file.type : 'image/jpeg';
  await uploadBytes(ref(storage, path), blob, { contentType });
  await createRecord<DogDocument>('dogDocuments', { dogId: dog.id, name: file.name, storagePath: path, contentType, size: blob.size, kind }, id);
  if (kind === 'photo') await updateRecord<Dog>('dogs', dog.id, { photoPath: path });
  return path;
}

export async function openDogFile(d: DogDocument) {
  const url = await getDownloadURL(ref(storage, d.storagePath));
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function removeDogFile(d: DogDocument) {
  await deleteObject(ref(storage, d.storagePath)).catch(() => undefined);
  await deleteDoc(doc(db, 'dogDocuments', d.id));
}
