import type { Client, Dog, Household } from './types';

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9@.\s-]/g, ' ');
}

/** Every query word must appear somewhere in the haystack (prefix match on words). */
export function matches(haystack: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const hay = normalize(haystack);
  const digits = hay.replace(/\D/g, '');
  return words.every((w) => hay.includes(w) || (/^\d{3,}$/.test(w) && digits.includes(w)));
}

/** Higher is better. Name-start matches win, then word-start, then anywhere. */
export function score(primary: string, haystack: string, query: string): number {
  if (!matches(haystack, query)) return 0;
  const p = normalize(primary);
  const q = normalize(query).trim();
  if (p.startsWith(q)) return 3;
  if (p.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  return 1;
}

export interface SearchHit {
  kind: 'dog' | 'client';
  id: string;
  title: string;
  subtitle: string;
  score: number;
}

export function searchPractice(query: string, data: { dogs: Dog[]; clients: Client[]; households: Household[] }, limit = 12): SearchHit[] {
  if (!query.trim()) return [];
  const households = new Map(data.households.map((h) => [h.id, h]));
  const hits: SearchHit[] = [];
  for (const d of data.dogs) {
    const hh = households.get(d.householdId);
    const hay = [d.name, d.breed, d.coat, d.concerns.join(' '), d.summary, hh?.name, hh?.neighborhood, d.rescueOrg].filter(Boolean).join(' ');
    const s = score(d.name, hay, query);
    if (s) hits.push({ kind: 'dog', id: d.id, title: d.name, subtitle: [d.breed, hh?.name].filter(Boolean).join(' · '), score: s + (d.archived ? -0.5 : 0) });
  }
  for (const c of data.clients) {
    const name = `${c.firstName} ${c.lastName}`;
    const hh = households.get(c.householdId);
    const hay = [name, c.email, c.phone, hh?.name, hh?.neighborhood, c.referralSource].filter(Boolean).join(' ');
    const s = score(name, hay, query);
    if (s) hits.push({ kind: 'client', id: c.id, title: name, subtitle: [hh?.neighborhood, c.email].filter(Boolean).join(' · '), score: s + (c.archived ? -0.5 : 0) });
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

/** Short excerpt around the first query word, for note search results. */
export function excerpt(text: string, query: string, radius = 70): string {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const lower = normalize(text);
  const idx = Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0));
  if (!Number.isFinite(idx)) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, idx + radius).trim()}${idx + radius < text.length ? '…' : ''}`;
}
