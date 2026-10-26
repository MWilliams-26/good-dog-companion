// Demo-build stand-in for `firebase/auth`. Only the fictional demo accounts
// can sign in; the "intruder" account signs in but has no practice access.
import { DEMO_USERS } from '../demoData';
import { DEMO_UID } from '../store';

export type User = { uid: string; email: string; displayName: string };

const USER_KEY = 'gooddog-demo:user';
const accounts: (User & { password: string })[] = [
  { uid: DEMO_UID, ...DEMO_USERS.haley },
  { uid: 'demo-intruder', ...DEMO_USERS.intruder },
];

const listeners = new Set<(user: User | null) => void>();
const publicUser = (uid: string | null): User | null => {
  const a = accounts.find((x) => x.uid === uid);
  return a ? { uid: a.uid, email: a.email, displayName: a.displayName } : null;
};

export const auth = { currentUser: publicUser(localStorage.getItem(USER_KEY)) };

function setUser(user: User | null) {
  auth.currentUser = user;
  if (user) localStorage.setItem(USER_KEY, user.uid);
  else localStorage.removeItem(USER_KEY);
  listeners.forEach((fn) => fn(user));
}

export const getAuth = (..._args: unknown[]) => auth;
export const browserLocalPersistence = {};
export const setPersistence = async (..._args: unknown[]) => undefined;
export const connectAuthEmulator = (..._args: unknown[]) => undefined;

export function onAuthStateChanged(_auth: typeof auth, fn: (user: User | null) => void) {
  listeners.add(fn);
  queueMicrotask(() => listeners.has(fn) && fn(auth.currentUser));
  return () => void listeners.delete(fn);
}

export async function signInWithEmailAndPassword(_auth: typeof auth, email: string, password: string) {
  const account = accounts.find((a) => a.email === email.toLowerCase() && a.password === password);
  if (!account) throw Object.assign(new Error('Invalid credentials'), { code: 'auth/invalid-credential' });
  const user = publicUser(account.uid);
  setUser(user);
  return { user };
}

export async function signOut(_auth: typeof auth) {
  setUser(null);
}
