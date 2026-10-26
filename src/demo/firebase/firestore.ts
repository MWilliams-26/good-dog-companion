// Demo-build stand-in for `firebase/firestore`: the subset of the modular API
// this app uses, backed by the in-browser store. See ../store.ts.
import { DEMO_UID, Timestamp, clone, sameValue, store, type Data } from '../store';
import { auth } from './auth';

export { Timestamp };
export type DocumentData = Data;
export type Unsubscribe = () => void;
export type FirestoreSettings = Record<string, unknown>;

type Db = { kind: 'db' };
type CollectionRef = { kind: 'collection'; path: string; id: string };
type DocRef = { kind: 'document'; path: string; id: string };
type Constraint =
  | { kind: 'where'; field: string; op: string; value: unknown }
  | { kind: 'orderBy'; field: string; dir: 'asc' | 'desc' }
  | { kind: 'limit'; n: number };
type QueryRef = { kind: 'query'; path: string; constraints: Constraint[] };
export type Query = QueryRef | CollectionRef;
export type WriteBatch = ReturnType<typeof writeBatch>;

class FirestoreError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

const db: Db = { kind: 'db' };
export const initializeFirestore = (..._args: unknown[]) => db;
export const getFirestore = () => db;
export const persistentLocalCache = (..._args: unknown[]) => ({});
export const persistentMultipleTabManager = () => ({});
export const terminate = async (..._args: unknown[]) => undefined;
export const clearIndexedDbPersistence = async (..._args: unknown[]) => undefined;

const autoId = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');
const join = (parent: Db | CollectionRef | DocRef, segments: string[]) => [...(parent.kind === 'db' ? [] : [parent.path]), ...segments].join('/');

export function collection(parent: Db | DocRef, ...segments: string[]): CollectionRef {
  const path = join(parent, segments);
  return { kind: 'collection', path, id: path.split('/').pop()! };
}

export function doc(parent: Db | CollectionRef, ...segments: string[]): DocRef {
  const path = join(parent, segments.length ? segments : [autoId()]);
  return { kind: 'document', path, id: path.split('/').pop()! };
}

export const where = (field: string, op: string, value: unknown): Constraint => ({ kind: 'where', field, op, value });
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): Constraint => ({ kind: 'orderBy', field, dir });
export const limit = (n: number): Constraint => ({ kind: 'limit', n });
export const query = (ref: Query, ...constraints: Constraint[]): QueryRef => ({
  kind: 'query',
  path: ref.path,
  constraints: [...(ref.kind === 'query' ? ref.constraints : []), ...constraints],
});

// ── Reads ──────────────────────────────────────────────────────────────────

const fieldOf = (data: Data, field: string) => field.split('.').reduce<unknown>((v, k) => (v as Data | undefined)?.[k], data);

function compare(a: unknown, b: unknown): number {
  const norm = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : v);
  const x = norm(a) as string | number;
  const y = norm(b) as string | number;
  return x < y ? -1 : x > y ? 1 : 0;
}

function matches(data: Data, c: Extract<Constraint, { kind: 'where' }>): boolean {
  const v = fieldOf(data, c.field);
  switch (c.op) {
    case '==': return v !== undefined && sameValue(v, c.value);
    case '!=': return v !== undefined && !sameValue(v, c.value);
    case 'array-contains': return Array.isArray(v) && v.some((x) => sameValue(x, c.value));
    case 'array-contains-any': return Array.isArray(v) && (c.value as unknown[]).some((y) => v.some((x) => sameValue(x, y)));
    case 'in': return (c.value as unknown[]).some((y) => sameValue(v, y));
  }
  if (v === undefined || v === null || typeof v !== typeof c.value && !(v instanceof Timestamp)) return false;
  const r = compare(v, c.value);
  return c.op === '<' ? r < 0 : c.op === '<=' ? r <= 0 : c.op === '>' ? r > 0 : r >= 0;
}

function docSnap(path: string, data: Data | undefined) {
  const copy = data && clone(data);
  return {
    id: path.split('/').pop()!,
    ref: { kind: 'document', path, id: path.split('/').pop()! } as DocRef,
    exists: () => copy !== undefined,
    data: () => copy,
    get: (field: string) => copy && fieldOf(copy, field),
  };
}

function run(q: Query) {
  const constraints = q.kind === 'query' ? q.constraints : [];
  let rows = store.list(q.path);
  for (const c of constraints) {
    if (c.kind === 'where') rows = rows.filter(([, d]) => matches(d, c));
    if (c.kind === 'orderBy') rows = rows.filter(([, d]) => fieldOf(d, c.field) !== undefined);
  }
  const orders = constraints.filter((c) => c.kind === 'orderBy');
  rows.sort(([pa, a], [pb, b]) => {
    for (const o of orders) {
      const r = compare(fieldOf(a, o.field), fieldOf(b, o.field));
      if (r) return o.dir === 'desc' ? -r : r;
    }
    return pa < pb ? -1 : 1;
  });
  const max = constraints.find((c) => c.kind === 'limit');
  if (max) rows = rows.slice(0, max.n);
  const docs = rows.map(([p, d]) => docSnap(p, d));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn: (d: (typeof docs)[number]) => void) => docs.forEach(fn) };
}

export const getDoc = async (ref: DocRef) => docSnap(ref.path, store.get(ref.path));
export const getDocs = async (q: Query) => run(q);

type Snap = ReturnType<typeof run> | ReturnType<typeof docSnap>;
export function onSnapshot(target: DocRef | Query, next: (snap: never) => void, _error?: (e: Error) => void): Unsubscribe {
  const read = (): Snap => (target.kind === 'document' ? docSnap(target.path, store.get(target.path)) : run(target));
  const raw = (s: Snap) => ('docs' in s ? s.docs.map((d) => [d.id, d.data()]) : s.data());
  let last: unknown;
  let active = true;
  const emit = () => {
    if (!active) return;
    const snap = read();
    if (last !== undefined && sameValue(raw(snap), last)) return;
    last = raw(snap);
    (next as (s: Snap) => void)(snap);
  };
  queueMicrotask(emit);
  const unsubscribe = store.subscribe(emit);
  return () => {
    active = false;
    unsubscribe();
  };
}

// ── Writes ─────────────────────────────────────────────────────────────────

const SERVER_TIMESTAMP = Symbol('serverTimestamp');
const DELETE_FIELD = Symbol('deleteField');
export const serverTimestamp = () => SERVER_TIMESTAMP as unknown as Timestamp;
export const deleteField = () => DELETE_FIELD as unknown;

function resolve(value: unknown): unknown {
  if (value === SERVER_TIMESTAMP) return Timestamp.now();
  if (value instanceof Timestamp || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(resolve);
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== DELETE_FIELD).map(([k, v]) => [k, resolve(v)]));
}

// Mirrors functions/index.js: one audit row per write to a practice collection.
const AUDITED = new Set(['clients', 'households', 'dogs', 'clientDogs', 'assessmentTemplates', 'assessmentTemplateVersions', 'assessments', 'consultations', 'trainingPlans', 'goals', 'progressObservations', 'appointments', 'followUps', 'reportDrafts', 'dogDocuments']);

type Op = { type: 'set'; path: string; data: Data; merge?: boolean } | { type: 'update'; path: string; data: Data } | { type: 'delete'; path: string };

function commit(ops: Op[]) {
  if (!auth.currentUser) throw new FirestoreError('permission-denied', 'Signed out.');
  if (auth.currentUser.uid !== DEMO_UID) throw new FirestoreError('permission-denied', 'This account has no access.');
  for (const op of ops) {
    if (op.type === 'update' && !store.get(op.path)) throw new FirestoreError('not-found', `No document to update: ${op.path}`);
  }
  store.write((docs) => {
    for (const op of ops) {
      const before = docs.get(op.path);
      let after: Data | undefined;
      if (op.type === 'delete') {
        docs.delete(op.path);
      } else {
        after = op.type === 'set' && !op.merge ? {} : { ...before };
        for (const [key, value] of Object.entries(op.data)) {
          const parts = op.type === 'update' ? key.split('.') : [key];
          let target = after;
          for (const p of parts.slice(0, -1)) target = (target[p] = { ...(target[p] as Data) }) as Data;
          const last = parts[parts.length - 1];
          if (value === DELETE_FIELD) delete target[last];
          else if (value !== undefined) target[last] = resolve(value);
        }
        docs.set(op.path, after);
      }
      const [col, docId, ...rest] = op.path.split('/');
      if (rest.length || !AUDITED.has(col)) continue;
      const action = !before ? 'create' : !after ? 'delete' : 'update';
      const changedFields = action === 'update'
        ? [...new Set([...Object.keys(after!), ...Object.keys(before!)])].filter((k) => k !== 'updatedAt' && k !== 'updatedBy' && !sameValue(after![k], before![k]))
        : [];
      docs.set(`auditEvents/${autoId()}`, { collection: col, docId, action, actor: (after ?? before)?.updatedBy ?? null, changedFields, at: Timestamp.now() });
    }
  });
}

export const setDoc = async (ref: DocRef, data: Data, options?: { merge?: boolean }) => commit([{ type: 'set', path: ref.path, data, merge: options?.merge }]);
export const updateDoc = async (ref: DocRef, data: Data) => commit([{ type: 'update', path: ref.path, data }]);
export const deleteDoc = async (ref: DocRef) => commit([{ type: 'delete', path: ref.path }]);

export function writeBatch(_db: Db) {
  const ops: Op[] = [];
  const batch = {
    set: (ref: DocRef, data: Data, options?: { merge?: boolean }) => (ops.push({ type: 'set', path: ref.path, data, merge: options?.merge }), batch),
    update: (ref: DocRef, data: Data) => (ops.push({ type: 'update', path: ref.path, data }), batch),
    delete: (ref: DocRef) => (ops.push({ type: 'delete', path: ref.path }), batch),
    commit: async () => commit(ops),
  };
  return batch;
}
