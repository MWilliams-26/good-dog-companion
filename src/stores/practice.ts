// Live, in-memory copies of the small core collections (clients, households,
// dogs, relationships). A solo practice has hundreds of these at most, so
// keeping them live gives instant search and cross-linking everywhere.
import { create } from 'zustand';
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Client, ClientDogRelationship, Dog, Household } from '../lib/types';

interface PracticeState {
  ready: boolean;
  error: string | null;
  clients: Client[];
  households: Household[];
  dogs: Dog[];
  links: ClientDogRelationship[];
}

export const usePractice = create<PracticeState>(() => ({
  ready: false,
  error: null,
  clients: [],
  households: [],
  dogs: [],
  links: [],
}));

let unsubs: Unsubscribe[] = [];

export function startPracticeSync() {
  if (unsubs.length) return;
  const loaded = new Set<string>();
  const watch = <K extends 'clients' | 'households' | 'dogs' | 'links'>(key: K, name: string) =>
    onSnapshot(
      collection(db, name),
      (snap) => {
        loaded.add(key);
        usePractice.setState({
          [key]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          ready: loaded.size === 4,
        } as Partial<PracticeState>);
      },
      () => usePractice.setState({ error: 'Could not load practice records.', ready: true }),
    );
  unsubs = [watch('clients', 'clients'), watch('households', 'households'), watch('dogs', 'dogs'), watch('links', 'clientDogs')];
}

export function stopPracticeSync() {
  unsubs.forEach((u) => u());
  unsubs = [];
}

// ── Selectors ─────────────────────────────────────────────────────────────

export const clientName = (c: Pick<Client, 'firstName' | 'lastName'> | undefined) =>
  c ? `${c.firstName} ${c.lastName}`.trim() : 'Unknown client';

export function useClientMap() {
  const clients = usePractice((s) => s.clients);
  return new Map(clients.map((c) => [c.id, c]));
}

export function useDogMap() {
  const dogs = usePractice((s) => s.dogs);
  return new Map(dogs.map((d) => [d.id, d]));
}

/** Current (not ended) relationships for a dog, primary first. */
export function currentLinksForDog(links: ClientDogRelationship[], dogId: string) {
  return links
    .filter((l) => l.dogId === dogId && !l.endDate)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

export function currentLinksForClient(links: ClientDogRelationship[], clientId: string) {
  return links.filter((l) => l.clientId === clientId && !l.endDate);
}
