import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToggleGroup } from '@mwilliams/ui';
import { Dog as DogIcon, ShieldAlert, Search } from 'lucide-react';
import { usePractice, currentLinksForDog, clientName } from '../stores/practice';
import { ButtonLink, EmptyState, PageHeader, Tag } from '../components/ui';
import { DogAvatar } from '../components/DogAvatar';
import { ageFrom } from '../lib/dates';
import { matches } from '../lib/search';
import { DOG_STATUS } from '../lib/labels';
import type { Dog } from '../lib/types';

const FILTERS = [
  { value: 'active', label: 'Working together' },
  { value: 'safety', label: 'Safety notes' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'all', label: 'All' },
];

export function DogsPage() {
  const { dogs, clients, households, links } = usePractice();
  const [filter, setFilter] = useState('active');
  const [q, setQ] = useState('');
  const [concern, setConcern] = useState<string>('');

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const hhMap = useMemo(() => new Map(households.map((h) => [h.id, h])), [households]);
  const concerns = useMemo(() => [...new Set(dogs.flatMap((d) => d.concerns))].sort(), [dogs]);

  const list = dogs
    .filter((d) => {
      if (filter === 'active') return !d.archived && (d.status === 'active' || d.status === 'paused');
      if (filter === 'safety') return !d.archived && d.safetyNotes.length > 0;
      if (filter === 'graduated') return d.status === 'graduated';
      return true;
    })
    .filter((d) => !concern || d.concerns.includes(concern))
    .filter((d) => !q.trim() || matches([d.name, d.breed, hhMap.get(d.householdId)?.name, d.concerns.join(' ')].join(' '), q))
    .sort((a, b) => a.name.localeCompare(b.name));

  const counts = {
    active: dogs.filter((d) => !d.archived && (d.status === 'active' || d.status === 'paused')).length,
    safety: dogs.filter((d) => !d.archived && d.safetyNotes.length > 0).length,
    graduated: dogs.filter((d) => d.status === 'graduated').length,
    all: dogs.length,
  } as Record<string, number>;

  return (
    <div>
      <PageHeader title="Dogs" eyebrow={`${counts.active} working together`} actions={<ButtonLink to="/dogs/new">Add dog</ButtonLink>} />
      <div className="mb-5 flex flex-col gap-3">
        <label className="flex h-11 items-center gap-2 rounded-control border border-line bg-white px-3.5 focus-within:border-moss focus-within:ring-2 focus-within:ring-moss/20">
          <Search className="size-4 text-fg-muted" aria-hidden />
          <span className="sr-only">Filter dogs</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, breed, household…" className="h-full flex-1 bg-transparent text-[0.9375rem] outline-none" />
        </label>
        <ToggleGroup legend="Show" hideLegend variant="chips" size="sm" scrollOnPhones options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))} value={filter} onValueChange={setFilter} countLabel="dogs" />
        {concerns.length ? (
          <label className="flex items-center gap-2 text-sm text-fg-muted">
            Concern
            <select value={concern} onChange={(e) => setConcern(e.target.value)} className="h-9 rounded-control border border-line bg-white px-2 text-sm text-olive">
              <option value="">Any</option>
              {concerns.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<DogIcon className="size-8" />} title={dogs.length ? 'No dogs match' : 'No dogs yet'} action={<ButtonLink to="/clients/new">Start an intake</ButtonLink>}>
          {dogs.length ? 'Try a different filter.' : 'Add a client and their dog to begin.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Dogs">
          {list.map((d) => (
            <DogCard key={d.id} dog={d} people={currentLinksForDog(links, d.id).map((l) => clientName(clientMap.get(l.clientId)).split(' ')[0])} household={hhMap.get(d.householdId)?.name} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DogCard({ dog, people, household }: { dog: Dog; people: string[]; household?: string }) {
  return (
    <li>
      <Link to={`/dogs/${dog.id}`} className="group flex h-full gap-4 rounded-card border border-line/80 bg-card p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-moss/40 hover:shadow-card">
        <DogAvatar dog={dog} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-serif text-xl leading-tight font-medium text-olive group-hover:text-moss">{dog.name}</p>
            {dog.safetyNotes.length ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-clay-soft px-2 py-0.5 text-[0.6875rem] font-bold text-[#7f3219]" title="Has safety notes">
                <ShieldAlert className="size-3.5" aria-hidden />
                <span className="sr-only">Has safety notes</span>
                Safety
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-fg-muted">{[dog.breed, ageFrom(dog.birthDate, dog.ageNote), dog.sex !== 'unknown' ? dog.sex : null].filter(Boolean).join(' · ')}</p>
          <p className="mt-0.5 truncate text-sm text-fg-muted">{people.length ? `with ${people.join(' & ')}` : household}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {dog.status !== 'active' ? <Tag tone="honey">{DOG_STATUS[dog.status]}</Tag> : null}
            {dog.concerns.slice(0, 3).map((c) => (
              <Tag key={c}>{c}</Tag>
            ))}
            {dog.concerns.length > 3 ? <Tag>+{dog.concerns.length - 3}</Tag> : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
