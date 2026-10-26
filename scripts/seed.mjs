#!/usr/bin/env node
// Seeds the Firebase EMULATOR with the fictional demo practice from
// src/demo/demoData.ts. Refuses to run against anything other than a demo-*
// project on the emulator.
//
//   npm run seed            (emulators must be running: npm run emulators)
//   npm run seed -- --reset (wipe emulator data first)
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { DEMO_USERS, buildDemoData } from '../src/demo/demoData.ts';

const PROJECT = process.env.GCLOUD_PROJECT ?? 'demo-good-dog';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
if (!PROJECT.startsWith('demo-')) {
  console.error('Refusing to seed: project id must start with demo- (emulator only).');
  process.exit(1);
}

initializeApp({ projectId: PROJECT });
const auth = getAuth();
const db = getFirestore();

async function reset() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

async function ensureUser({ email, password, displayName }) {
  try {
    return (await auth.getUserByEmail(email)).uid;
  } catch {
    return (await auth.createUser({ email, password, displayName, emailVerified: true })).uid;
  }
}

if (process.argv.includes('--reset')) await reset();

const uid = await ensureUser(DEMO_USERS.haley);
await ensureUser(DEMO_USERS.intruder);
await db.doc(`authorizedUsers/${uid}`).set({ email: DEMO_USERS.haley.email, displayName: DEMO_USERS.haley.displayName, role: 'owner', active: true });

const writes = buildDemoData({ uid, timestamp: (date) => Timestamp.fromDate(date) });

// Commit in batches of 400.
for (let i = 0; i < writes.length; i += 400) {
  const batch = db.batch();
  for (const [path, data] of writes.slice(i, i + 400)) batch.set(db.doc(path), data);
  await batch.commit();
}

const count = (col) => writes.filter(([path]) => path.startsWith(`${col}/`)).length;
console.log(`Seeded ${count('clients')} clients, ${count('dogs')} dogs, ${count('households')} households, ${writes.length} documents.`);
console.log(`Sign in: ${DEMO_USERS.haley.email} / ${DEMO_USERS.haley.password}`);
process.exit(0);
