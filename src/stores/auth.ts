import { create } from 'zustand';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from 'firebase/auth';
import { clearIndexedDbPersistence, doc, getDoc, terminate } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { AuthorizedUser } from '../lib/types';

type Status = 'loading' | 'signedOut' | 'unauthorized' | 'authorized';

interface AuthState {
  status: Status;
  user: User | null;
  profile: AuthorizedUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>(() => ({
  status: 'loading',
  user: null,
  profile: null,
  async signIn(email, password) {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  },
  async signOut() {
    await fbSignOut(auth);
    // Remove the offline copy of practice records from this device.
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch {
      // Another tab may still hold the cache; it is cleared on its next sign-out.
    }
    window.location.assign('/');
  },
}));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    useAuth.setState({ status: 'signedOut', user: null, profile: null });
    return;
  }
  try {
    const snap = await getDoc(doc(db, 'authorizedUsers', user.uid));
    const profile = snap.exists() ? ({ id: snap.id, ...snap.data() } as AuthorizedUser) : null;
    useAuth.setState(profile?.active ? { status: 'authorized', user, profile } : { status: 'unauthorized', user, profile: null });
  } catch {
    useAuth.setState({ status: 'unauthorized', user, profile: null });
  }
});
