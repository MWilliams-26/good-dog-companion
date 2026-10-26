import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToggleGroup } from '@mwilliams/ui';
import { Search, Users } from 'lucide-react';
import { usePractice, currentLinksForClient } from '../stores/practice';
import { ButtonLink, EmptyState, PageHeader, Tag } from '../components/ui';
import { ClientInitials } from '../components/DogAvatar';
import { CLIENT_STATUS } from '../lib/labels';
import { matches } from '../lib/search';
import type { ClientStatus } from '../lib/types';

const PAGE = 30;

export function ClientsPage() {
  const { clients, dogs, households, links } = usePractice();
  const [status, setStatus] = useState<string>('current');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const dogMap = useMemo(() => new Map(dogs.map((d) => [d.id, d])), [dogs]);
  const hhMap = useMemo(() => new Map(households.map((h) => [h.id, h])), [households]);

  const inStatus = (s: ClientStatus, archived?: boolean) => {
    if (status === 'archived') return !!archived;
    if (archived) return false;
    if (status === 'current') return s !== 'inactive';
    if (status === 'all') return true;
    return s === status;
  };

  const list = clients
    .filter((c) => inStatus(c.status, c.archived))
    .filter((c) => {
      if (!q.trim()) return true;
      const dogNames = currentLinksForClient(links, c.id).map((l) => dogMap.get(l.dogId)?.name).join(' ');
      return matches([c.firstName, c.lastName, c.email, c.phone, hhMap.get(c.householdId)?.neighborhood, dogNames].join(' '), q);
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

  const count = (s: string) => clients.filter((c) => (s === 'current' ? !c.archived && c.status !== 'inactive' : s === 'all' ? true : s === 'archived' ? c.archived : !c.archived && c.status === s)).length;

  return (
    <div>
      <PageHeader
        title="Clients"
        eyebrow={`${count('active')} active · ${count('inquiry')} inquiries`}
        actions={
          <>
            <ButtonLink to="/clients/new?inquiry=1" variant="secondary">
              Log inquiry
            </ButtonLink>
            <ButtonLink to="/clients/new">New client</ButtonLink>
          </>
        }
      />
      <div className="mb-5 flex flex-col gap-3">
        <label className="flex h-11 items-center gap-2 rounded-control border border-line bg-white px-3.5 focus-within:border-moss focus-within:ring-2 focus-within:ring-moss/20">
          <Search className="size-4 text-fg-muted" aria-hidden />
          <span className="sr-only">Filter clients</span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Filter by name, dog, phone, neighborhood…" className="h-full flex-1 bg-transparent text-[0.9375rem] outline-none" />
        </label>
        <ToggleGroup
          legend="Client status"
          hideLegend
          variant="chips"
          size="sm"
          scrollOnPhones
          countLabel="clients"
          value={status}
          onValueChange={(v) => { setStatus(v); setShown(PAGE); }}
          options={[
            { value: 'current', label: 'Current' },
            { value: 'inquiry', label: 'Inquiries' },
            { value: 'new', label: 'New' },
            { value: 'active', label: 'Active' },
            { value: 'returning', label: 'Returning' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'archived', label: 'Archived' },
          ].map((o) => ({ ...o, count: count(o.value) }))}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} title={clients.length ? 'No clients match' : 'No clients yet'} action={<ButtonLink to="/clients/new">New client</ButtonLink>} />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-card" aria-label="Clients">
            {list.slice(0, shown).map((c) => {
              const dogNames = currentLinksForClient(links, c.id)
                .map((l) => dogMap.get(l.dogId)?.name)
                .filter(Boolean);
              return (
                <li key={c.id}>
                  <Link to={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper">
                    <ClientInitials first={c.firstName} last={c.lastName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-olive">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="block truncate text-sm text-fg-muted">
                        {[dogNames.length ? dogNames.join(', ') : 'No dog yet', hhMap.get(c.householdId)?.neighborhood].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <Tag tone={CLIENT_STATUS[c.status].tone}>{CLIENT_STATUS[c.status].label}</Tag>
                  </Link>
                </li>
              );
            })}
          </ul>
          {list.length > shown ? (
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => setShown((s) => s + PAGE)} className="rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-olive hover:border-line-strong">
                Show more ({list.length - shown})
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
