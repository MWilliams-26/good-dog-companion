import { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { ToggleGroup } from '@mwilliams/ui';
import { NotebookPen, Zap } from 'lucide-react';
import { db } from '../lib/firebase';
import { useQuery, friendlyError } from '../lib/db';
import { usePractice } from '../stores/practice';
import { ButtonLink, EmptyState, ErrorNote, PageHeader, SkeletonList, Tag } from '../components/ui';
import { DogAvatar } from '../components/DogAvatar';
import { CONSULT_TYPE_SHORT } from '../lib/labels';
import { fmtDate } from '../lib/dates';
import type { Consultation } from '../lib/types';

const PAGE = 25;

export function SessionsPage() {
  const [type, setType] = useState('all');
  const [max, setMax] = useState(PAGE);
  const dogs = usePractice((s) => s.dogs);
  const dogMap = new Map(dogs.map((d) => [d.id, d]));
  const q =
    type === 'all'
      ? query(collection(db, 'consultations'), orderBy('date', 'desc'), limit(max))
      : query(collection(db, 'consultations'), where('type', '==', type), orderBy('date', 'desc'), limit(max));
  const { data, loading, error } = useQuery<Consultation>(q, `sessions-${type}-${max}`);

  // Group by month for scanning.
  const groups = new Map<string, Consultation[]>();
  for (const s of data) {
    const k = fmtDate(s.date, 'MMMM yyyy');
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }

  return (
    <div>
      <PageHeader
        title="Sessions"
        eyebrow="Consultation notes"
        actions={
          <>
            <ButtonLink to="/sessions/new?format=freeform" variant="secondary">
              <Zap className="size-4" aria-hidden />
              Quick note
            </ButtonLink>
            <ButtonLink to="/sessions/new">New session</ButtonLink>
          </>
        }
      />
      <div className="mb-5">
        <ToggleGroup
          legend="Session type"
          hideLegend
          variant="chips"
          size="sm"
          scrollOnPhones
          value={type}
          onValueChange={(v) => {
            setType(v);
            setMax(PAGE);
          }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'initial', label: 'Initial' },
            { value: 'followUp', label: 'Follow-up' },
            { value: 'virtual', label: 'Virtual' },
            { value: 'checkIn', label: 'Check-in' },
          ]}
        />
      </div>
      {error ? <ErrorNote>{friendlyError(error)}</ErrorNote> : null}
      {loading && !data.length ? (
        <SkeletonList />
      ) : data.length === 0 ? (
        <EmptyState icon={<NotebookPen className="size-8" />} title="No sessions yet" action={<ButtonLink to="/sessions/new">Write session notes</ButtonLink>} />
      ) : (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([month, items]) => (
            <section key={month} aria-label={month}>
              <h2 className="mb-2 text-xs font-bold tracking-[0.12em] text-moss-soft uppercase">{month}</h2>
              <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
                {items.map((s) => {
                  const ds = s.dogIds.map((id) => dogMap.get(id)).filter(Boolean);
                  const text = s.format === 'freeform' ? s.freeformNotes : s.observations || s.changesSinceLast;
                  return (
                    <li key={s.id}>
                      <Link to={`/sessions/${s.id}`} className="flex gap-3 px-4 py-3.5 hover:bg-paper">
                        <div className="flex -space-x-3">
                          {ds.slice(0, 2).map((d) => (
                            <DogAvatar key={d!.id} dog={d!} size="sm" className="ring-2 ring-card" />
                          ))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-semibold">{ds.map((d) => d!.name).join(' & ')}</p>
                            <span className="shrink-0 text-sm text-fg-muted">{fmtDate(s.date, 'EEE, MMM d')}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Tag tone={s.type === 'initial' ? 'sky' : s.type === 'virtual' ? 'honey' : 'moss'}>{CONSULT_TYPE_SHORT[s.type]}</Tag>
                            {s.format === 'freeform' ? <Tag>Quick notes</Tag> : null}
                          </div>
                          {text ? <p className="mt-1.5 line-clamp-2 text-sm text-fg-muted">{text}</p> : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {data.length >= max ? (
            <div className="flex justify-center">
              <button type="button" onClick={() => setMax((m) => m + PAGE)} className="rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold hover:border-line-strong">
                Load older sessions
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
