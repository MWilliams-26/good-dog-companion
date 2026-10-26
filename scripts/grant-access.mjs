#!/usr/bin/env node
// Authorize (or revoke) an existing Firebase Auth account for practice records.
// authorizedUsers is writable only through the Admin SDK, never from the app.
//
//   Emulator:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//               node scripts/grant-access.mjs haley@example.com --name "Haley Wilson" --project demo-good-dog
//   Production: GOOGLE_APPLICATION_CREDENTIALS=service-account.json \
//               node scripts/grant-access.mjs haley@example.com --name "Haley Wilson" --project your-project-id
//   Revoke:     node scripts/grant-access.mjs someone@example.com --revoke --project …
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const email = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--revoke'));
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const projectId = flag('project') ?? process.env.GCLOUD_PROJECT;
if (!email || !projectId) {
  console.error('Usage: node scripts/grant-access.mjs <email> --project <id> [--name "Display Name"] [--role owner|staff] [--revoke]');
  process.exit(1);
}

initializeApp({ projectId });
const user = await getAuth().getUserByEmail(email);
const ref = getFirestore().collection('authorizedUsers').doc(user.uid);
if (args.includes('--revoke')) {
  await ref.set({ active: false }, { merge: true });
  await getAuth().revokeRefreshTokens(user.uid);
  console.log(`Revoked access for ${email}.`);
} else {
  await ref.set({ email, displayName: flag('name') ?? user.displayName ?? email, role: flag('role') ?? 'owner', active: true });
  console.log(`Authorized ${email} (${user.uid}).`);
}
