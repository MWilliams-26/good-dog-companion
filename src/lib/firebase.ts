import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type FirestoreSettings,
} from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const env = import.meta.env;

export const usingEmulators = env.VITE_USE_EMULATORS === 'true';

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: env.VITE_FIREBASE_APP_ID,
});

if (usingEmulators && !String(env.VITE_FIREBASE_PROJECT_ID).startsWith('demo-')) {
  throw new Error('Emulator mode requires a demo-* project id so real data can never be touched.');
}

export const auth = getAuth(app);
void setPersistence(auth, browserLocalPersistence);

// Offline-capable cache so the installed app keeps working on spotty
// connections (subway, basements). It is cleared on sign-out.
const settings: FirestoreSettings = {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
};

if (usingEmulators) {
  // The dev/preview server proxies emulator traffic on the same origin
  // (see vite.config.ts), which also works behind an HTTPS preview proxy.
  settings.host = window.location.host;
  settings.ssl = window.location.protocol === 'https:';
}

export const db = initializeFirestore(app, settings);
export const storage = getStorage(app);

if (usingEmulators) {
  connectAuthEmulator(auth, window.location.origin, { disableWarnings: true });
  connectStorageEmulator(storage, window.location.hostname, Number(window.location.port) || (window.location.protocol === 'https:' ? 443 : 80));
  // Same-origin proxy: match the page's scheme instead of the SDK's http default.
  (storage as unknown as { _protocol: string })._protocol = window.location.protocol.replace(':', '');
  (storage as unknown as { host: string }).host = window.location.host;
}
