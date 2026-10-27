import { useEffect, useState } from 'react';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Query,
  type WriteBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { CollectionName } from './types';

type NewRecord<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;

function actor(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You are signed out. Sign in again to save.');
  return uid;
}

export function newId(name: CollectionName): string {
  return doc(collection(db, name)).id;
}

function createMeta() {
  const uid = actor();
  return { createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: uid, updatedBy: uid };
}

function updateMeta() {
  return { updatedAt: serverTimestamp(), updatedBy: actor() };
}

function stripId<T extends object>(data: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = data as T & { id?: string };
  return rest;
}

/** In updates, a key explicitly set to undefined means "clear this field". */
function patchOf<T extends object>(data: T) {
  return Object.fromEntries(Object.entries(stripId(data)).map(([k, v]) => [k, v === undefined ? deleteField() : v]));
}

export async function createRecord<T>(name: CollectionName, data: NewRecord<T>, id = newId(name)): Promise<string> {
  await setDoc(doc(db, name, id), { ...stripId(data as object), ...createMeta() });
  return id;
}

export async function updateRecord<T>(name: CollectionName, id: string, patch: Partial<NewRecord<T>>): Promise<void> {
  await updateDoc(doc(db, name, id), { ...patchOf(patch as object), ...updateMeta() } as DocumentData);
}

/** Batched multi-document writes (e.g. client + household + dog + relationship in one step). */
export function batchWriter() {
  const batch: WriteBatch = writeBatch(db);
  return {
    create<T>(name: CollectionName, data: NewRecord<T>, id = newId(name)) {
      batch.set(doc(db, name, id), { ...stripId(data as object), ...createMeta() });
      return id;
    },
    createAt(path: string, data: object) {
      batch.set(doc(db, path), { ...data, ...createMeta() });
    },
    update<T>(name: CollectionName, id: string, patch: Partial<NewRecord<T>>) {
      batch.update(doc(db, name, id), { ...patchOf(patch as object), ...updateMeta() } as DocumentData);
    },
    commit: () => batch.commit(),
  };
}

export async function getRecord<T>(name: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, name, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
}

export interface Live<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

/** Live query. Pass null to skip. `key` must change when the query changes. */
export function useQuery<T>(q: Query | null, key: string): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: !!q, error: null });
  useEffect(() => {
    if (!q) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), loading: false, error: null }),
      (error) => setState({ data: [], loading: false, error }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Live single document. */
export function useRecord<T>(name: string, id: string | undefined | null): Live<T | null> {
  const [state, setState] = useState<Live<T | null>>({ data: null, loading: !!id, error: null });
  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      doc(db, name, id),
      (snap) => setState({ data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }),
    );
  }, [name, id]);
  return state;
}

/** User-facing message for a failed Firestore/Storage call. Never includes record contents. */
export function friendlyError(err: unknown): string {
  const code = String((err as { code?: unknown })?.code ?? '');
  if (code.includes('permission-denied')) return 'You don’t have permission to do that. Try signing in again.';
  if (code.includes('unavailable')) return 'You appear to be offline. Changes will sync when you reconnect.';
  if (code.includes('not-found')) return 'That record no longer exists.';
  if (err instanceof Error && err.message.startsWith('You are signed out')) return err.message;
  return 'Something went wrong while saving. Please try again.';
}
