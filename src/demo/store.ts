// Browser-only practice data for the public demo build (`npm run build:demo`).
// The demo build swaps the Firebase SDK for the small stand-ins in
// ./firebase/, which read and write this store. Records live in this
// browser's localStorage and are seeded with the fictional practice from
// demoData.ts, so nothing a visitor types ever leaves their device.
import { DEMO_USERS, buildDemoData } from './demoData';

export class Timestamp {
  constructor(
    readonly seconds: number,
    readonly nanoseconds: number,
  ) {}
  static fromMillis(ms: number) {
    return new Timestamp(Math.floor(ms / 1000), Math.round((ms % 1000) * 1e6));
  }
  static fromDate(date: Date) {
    return Timestamp.fromMillis(date.getTime());
  }
  static now() {
    return Timestamp.fromMillis(Date.now());
  }
  toMillis() {
    return this.seconds * 1000 + this.nanoseconds / 1e6;
  }
  toDate() {
    return new Date(this.toMillis());
  }
  isEqual(other: Timestamp) {
    return other instanceof Timestamp && other.toMillis() === this.toMillis();
  }
  valueOf() {
    return String(this.toMillis()).padStart(16, '0');
  }
}

export type Data = Record<string, unknown>;

export const DEMO_UID = 'demo-haley';
const DOCS_KEY = 'gooddog-demo:docs:v1';

/** JSON-safe form that keeps Timestamps; also used to deep-copy records. */
function encode(value: unknown): unknown {
  if (value instanceof Timestamp) return { __ts: value.toMillis() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    const o = value as Data;
    if (typeof o.__ts === 'number' && Object.keys(o).length === 1) return Timestamp.fromMillis(o.__ts);
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

export const clone = <T>(value: T): T => decode(encode(value)) as T;
export const sameValue = (a: unknown, b: unknown) => JSON.stringify(encode(a)) === JSON.stringify(encode(b));

function seedDocs(): Map<string, Data> {
  const docs = new Map<string, Data>(buildDemoData({ uid: DEMO_UID, timestamp: Timestamp.fromDate }) as [string, Data][]);
  docs.set(`authorizedUsers/${DEMO_UID}`, { email: DEMO_USERS.haley.email, displayName: DEMO_USERS.haley.displayName, role: 'owner', active: true });
  return docs;
}

function loadDocs(): Map<string, Data> {
  try {
    const saved = localStorage.getItem(DOCS_KEY);
    if (saved) return new Map(Object.entries(decode(JSON.parse(saved)) as Record<string, Data>));
  } catch {
    // Unreadable or blocked storage: start from a fresh demo practice.
  }
  return seedDocs();
}

const docs = loadDocs();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let notifyQueued = false;

function save() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(encode(Object.fromEntries(docs))));
  } catch {
    // Storage full or blocked: keep working in memory for this visit.
  }
}
addEventListener('pagehide', () => saveTimer && save());

function changed() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    listeners.forEach((fn) => fn());
  });
}

export const store = {
  get: (path: string) => docs.get(path),
  /** Direct children of a collection path, e.g. `dogs` or `assessments/a1/revisions`. */
  list(collectionPath: string) {
    const prefix = `${collectionPath}/`;
    const depth = prefix.split('/').length;
    return [...docs.entries()].filter(([p]) => p.startsWith(prefix) && p.split('/').length === depth);
  },
  write(apply: (docs: Map<string, Data>) => void) {
    apply(docs);
    changed();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};

/** Throws away every change on this device and restores the fictional practice. */
export async function resetDemo() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  localStorage.removeItem(DOCS_KEY);
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('gooddog-demo-files');
    req.onsuccess = req.onerror = req.onblocked = resolve;
  });
  location.assign('/');
}
