import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { ClipboardCheck, NotebookPen, Search as SearchIcon, Sprout, Eye } from 'lucide-react';
import { db } from '../lib/firebase';
import { usePractice } from '../stores/practice';
import { excerpt, matches, searchPractice } from '../lib/search';
import { Card, EmptyState, Loading, PageHeader, SectionTitle } from '../components/ui';
import { DogAvatar, ClientInitials } from '../components/DogAvatar';
import { CONSULT_TYPE } from '../lib/labels';
import { fmtDate } from '../lib/dates';
import type { Assessment, Consultation, Goal, ProgressObservation, TrainingPlan } from '../lib/types';

interface Corpus {
  consultations: Consultation[];
  plans: TrainingPlan[];
  goals: Goal[];
  observations: ProgressObservation[];
  assessments: Assessment[];
}

let cache: { at: number; data: Corpus } | null = null;

async function loadCorpus(): Promise<Corpus> {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const get = async <T,>(name: string) => (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  const [consultations, plans, goals, observations, assessments] = await Promise.all([
    get<Consultation>('consultations'),
    get<TrainingPlan>('trainingPlans'),
    get<Goal>('goals'),
    get<ProgressObservation>('progressObservations'),
    get<Assessment>('assessments'),
  ]);
  cache = { at: Date.now(), data: { consultations, plans, goals, observations, assessments } };
  return cache.data;
}

const answerText = (a: Assessment) =>
  Object.values(a.responses)
    .map((r) => (Array.isArray(r.value) ? r.value.join(' ') : String(r.value ?? '')) + ' ' + (r.note ?? ''))
    .join(' ') + ' ' + (a.privateNotes ?? '');

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const { dogs, clients, households } = usePractice();
  const dogMap = new Map(dogs.map((d) => [d.id, d]));

  useEffect(() => {
    void loadCorpus().then(setCorpus);
  }, []);

  const people = searchPractice(q, { dogs, clients, households }, 20);
  const sessions = corpus?.consultations.filter((c) => matches([c.observations, c.freeformNotes, c.homework, c.exercisesPracticed, c.changesSinceLast, c.nextSteps, c.privateNotes, c.location, c.dogIds.map((d) => dogMap.get(d)?.name).join(' ')].join(' '), q)) ?? [];
  const plans = corpus?.plans.filter((p) => matches([p.title, p.summary, p.management].join(' '), q)) ?? [];
  const goals = corpus?.goals.filter((g) => matches([g.title, g.why, g.homework, g.successCriteria.join(' '), g.exercises.map((e) => `${e.name} ${e.instructions}`).join(' ')].join(' '), q)) ?? [];
  const observations = corpus?.observations.filter((o) => matches(o.observation, q)) ?? [];
  const assessments = corpus?.assessments.filter((a) => matches(answerText(a), q)) ?? [];
  const total = people.length + sessions.length + plans.length + goals.length + observations.length + assessments.length;

  return (
    <div>
      <PageHeader title="Search" />
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ q: input.trim() });
        }}
        className="mb-6"
      >
        <label className="flex h-14 items-center gap-3 rounded-2xl border border-line bg-white px-4 focus-within:border-moss focus-within:ring-2 focus-within:ring-moss/20">
          <SearchIcon className="size-5 text-moss" aria-hidden />
          <span className="sr-only">Search everything</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search names, notes, homework, triggers…" className="h-full flex-1 bg-transparent text-lg outline-none" />
        </label>
      </form>
      {!q ? (
        <EmptyState title="Search every record">Dogs, people, session notes, assessment answers, goals, and progress observations.</EmptyState>
      ) : !corpus ? (
        <Loading label="Searching" />
      ) : total === 0 ? (
        <EmptyState title={`Nothing found for “${q}”`}>Try fewer or different words.</EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-fg-muted" role="status">
            {total} result{total === 1 ? '' : 's'} for “{q}”
          </p>
          {people.length ? (
            <section>
              <SectionTitle>Dogs & people</SectionTitle>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {people.map((h) => (
                  <li key={`${h.kind}${h.id}`}>
                    <Link to={`/${h.kind === 'dog' ? 'dogs' : 'clients'}/${h.id}`} className="flex items-center gap-3 rounded-card border border-line bg-card p-3 hover:border-moss/40">
                      {h.kind === 'dog' ? <DogAvatar dog={dogMap.get(h.id)!} size="sm" /> : <ClientInitials first={h.title.split(' ')[0]} last={h.title.split(' ').slice(-1)[0]} />}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{h.title}</span>
                        <span className="block truncate text-sm text-fg-muted">{h.subtitle}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <ResultGroup title="Sessions" icon={<NotebookPen className="size-4" />} items={sessions.sort((a, b) => b.date.localeCompare(a.date)).map((s) => ({ key: s.id, to: `/sessions/${s.id}`, title: `${s.dogIds.map((d) => dogMap.get(d)?.name).join(' & ')} · ${CONSULT_TYPE[s.type]}`, meta: fmtDate(s.date), text: excerpt([s.observations, s.freeformNotes, s.homework, s.exercisesPracticed, s.changesSinceLast, s.nextSteps, s.privateNotes].filter(Boolean).join(' · '), q) }))} />
          <ResultGroup title="Assessments" icon={<ClipboardCheck className="size-4" />} items={assessments.map((a) => ({ key: a.id, to: `/assessments/${a.id}`, title: `${dogMap.get(a.dogId)?.name} · ${a.mode === 'initial' ? 'Initial' : 'Follow-up'} assessment`, meta: fmtDate(a.date), text: excerpt(answerText(a), q) }))} />
          <ResultGroup title="Plans & goals" icon={<Sprout className="size-4" />} items={[...plans.map((p) => ({ key: p.id, to: `/plans/${p.id}`, title: `${dogMap.get(p.dogId)?.name} · ${p.title}`, meta: fmtDate(p.startDate), text: excerpt([p.summary, p.management].join(' '), q) })), ...goals.map((g) => ({ key: g.id, to: `/plans/${g.planId}`, title: `${dogMap.get(g.dogId)?.name} · ${g.title}`, meta: 'Goal', text: excerpt([g.why, g.homework, g.successCriteria.join(' · '), g.exercises.map((e) => `${e.name}: ${e.instructions}`).join(' · ')].join(' '), q) }))]} />
          <ResultGroup title="Progress observations" icon={<Eye className="size-4" />} items={observations.sort((a, b) => b.date.localeCompare(a.date)).map((o) => ({ key: o.id, to: `/plans/${o.planId}`, title: dogMap.get(o.dogId)?.name ?? '', meta: fmtDate(o.date), text: excerpt(o.observation, q) }))} />
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, icon, items }: { title: string; icon: React.ReactNode; items: { key: string; to: string; title: string; meta: string; text: string }[] }) {
  if (!items.length) return null;
  return (
    <section>
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {title} · {items.length}
        </span>
      </SectionTitle>
      <Card as="div" className="divide-y divide-line">
        {items.slice(0, 30).map((i) => (
          <Link key={i.key} to={i.to} className="block px-4 py-3 hover:bg-paper">
            <span className="flex justify-between gap-3">
              <span className="font-semibold">{i.title}</span>
              <span className="shrink-0 text-sm text-fg-muted">{i.meta}</span>
            </span>
            <span className="mt-0.5 block text-sm text-fg-muted">{i.text}</span>
          </Link>
        ))}
      </Card>
    </section>
  );
}
