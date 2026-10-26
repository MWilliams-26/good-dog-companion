import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Tabs, cn } from '@mwilliams/ui';
import {
  CalendarClock,
  Camera,
  ClipboardCheck,
  FileText,
  Flag,
  Footprints,
  Home as HomeIcon,
  NotebookPen,
  Paperclip,
  Pencil,
  ShieldAlert,
  Sprout,
  Trash2,
  UserRound,
  Eye,
  CalendarPlus,
  FileOutput,
} from 'lucide-react';
import { usePractice, clientName } from '../stores/practice';
import { useDogRecords } from '../lib/queries';
import { Button, ButtonLink, Card, Detail, EmptyState, ErrorNote, NotFound, Prose, SectionTitle, SkeletonList, Tag } from '../components/ui';
import { DogAvatar } from '../components/DogAvatar';
import { ageFrom, fmtDate, relativeDay, todayISO } from '../lib/dates';
import { CONSULT_TYPE, DOG_STATUS, GOAL_STATUS, PLAN_STATUS, titleCase } from '../lib/labels';
import { ACCEPTED, openDogFile, removeDogFile, uploadDogFile } from '../lib/files';
import { toast } from '../stores/toast';
import { friendlyError } from '../lib/db';
import type { Dog } from '../lib/types';

export function DogProfilePage() {
  const { id } = useParams();
  const { dogs, clients, households, links } = usePractice();
  const dog = dogs.find((d) => d.id === id);
  const records = useDogRecords(dog?.id);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';

  if (!dog) return <NotFound what="Dog" back={{ to: '/dogs', label: 'Dogs' }} />;

  const household = households.find((h) => h.id === dog.householdId);
  const dogLinks = links.filter((l) => l.dogId === dog.id);
  const current = dogLinks.filter((l) => !l.endDate).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const housemates = dog.householdId ? dogs.filter((d) => d.householdId === dog.householdId && d.id !== dog.id && !d.archived) : [];
  const activePlan = records.plans.find((p) => p.status === 'active');
  const latestAssessment = records.assessments[0];
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const nextAppt = [...records.appointments].reverse().find((a) => a.status === 'scheduled' && a.start >= startOfToday);
  const openFollowUps = records.followUps.filter((f) => f.status === 'open');
  const completeAssessments = records.assessments.filter((a) => a.status === 'complete');

  return (
    <div>
      <Link to="/dogs" className="no-print -ms-1 mb-4 inline-flex items-center gap-1 rounded-control py-1 pe-2 text-sm font-medium text-fg-muted hover:text-olive">
        ← Dogs
      </Link>

      {/* Portrait header */}
      <section aria-labelledby="dog-name" className="relative mb-5 overflow-hidden rounded-[1.75rem] bg-olive text-cream">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgb(175_186_166/0.18),transparent_60%)]" />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-7">
          <PhotoControl dog={dog} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.16em] text-sage uppercase">{DOG_STATUS[dog.status]}</p>
            <h1 id="dog-name" className="mt-1 font-serif text-[2.75rem] leading-none font-medium sm:text-[3.25rem]">
              {dog.name}
            </h1>
            <p className="mt-2 text-[0.9375rem] text-cream/80">
              {[dog.breed, ageFrom(dog.birthDate, dog.ageNote), dog.sex !== 'unknown' ? `${titleCase(dog.sex)}${dog.altered ? (dog.sex === 'female' ? ', spayed' : ', neutered') : ''}` : null, dog.weightLbs ? `${dog.weightLbs} lb` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {current.map((l) => (
                <Link key={l.id} to={`/clients/${l.clientId}`} className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 font-medium text-cream hover:bg-cream/20">
                  <UserRound className="size-3.5" aria-hidden />
                  {clientName(clientMap.get(l.clientId))}
                  <span className="text-cream/60">· {l.role}</span>
                </Link>
              ))}
              {household?.neighborhood ? (
                <span className="inline-flex items-center gap-1.5 text-cream/70">
                  <HomeIcon className="size-3.5" aria-hidden />
                  {household.neighborhood}
                </span>
              ) : null}
            </p>
          </div>
          <div className="no-print flex gap-2 sm:self-start">
            <ButtonLink to={`/dogs/${dog.id}/edit`} variant="secondary" size="sm" className="border-cream/20 bg-cream/10 text-cream hover:bg-cream/20">
              <Pencil className="size-4" aria-hidden />
              Edit
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Safety first */}
      {dog.safetyNotes.length ? (
        <section aria-labelledby="safety-title" className="mb-5 rounded-card border border-clay/30 bg-clay-soft/50 p-4 sm:p-5">
          <h2 id="safety-title" className="mb-2 flex items-center gap-2 text-sm font-bold tracking-[0.08em] text-[#7f3219] uppercase">
            <ShieldAlert className="size-4" aria-hidden />
            Know before you meet
          </h2>
          <ul className="flex flex-col gap-1.5">
            {dog.safetyNotes.map((n, i) => (
              <li key={i} className="flex gap-2 text-[0.9375rem] text-[#5e2a17]">
                <span className={cn('mt-2 size-1.5 shrink-0 rounded-full', n.level === 'important' ? 'bg-clay' : 'bg-clay/50')} aria-hidden />
                <span>
                  {n.level === 'important' ? <strong className="font-semibold">Important: </strong> : null}
                  {n.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Next steps */}
      <div className="no-print mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <QuickAction to={`/sessions/new?dog=${dog.id}`} icon={<NotebookPen />} label="Session notes" />
        <QuickAction
          to={`/assessments/new?dog=${dog.id}&mode=${completeAssessments.length ? 'followUp' : 'initial'}`}
          icon={<ClipboardCheck />}
          label={completeAssessments.length ? 'Follow-up assessment' : 'Start assessment'}
        />
        <QuickAction to={activePlan ? `/plans/${activePlan.id}` : `/plans/new?dog=${dog.id}`} icon={<Sprout />} label={activePlan ? 'Training plan' : 'New training plan'} />
        <QuickAction to={`/schedule/new?dog=${dog.id}`} icon={<CalendarPlus />} label="Schedule" />
        <QuickAction to={`/schedule?followup=new&dog=${dog.id}`} icon={<Flag />} label="Follow-up" className="col-span-2 sm:col-span-1" />
      </div>

      {records.error ? <ErrorNote>Some records couldn’t be loaded. {friendlyError(records.error)}</ErrorNote> : null}

      <Tabs
        label={`${dog.name}’s records`}
        variant="pills"
        value={tab}
        onValueChange={(v) => setParams((p) => (p.set('tab', v), p), { replace: true })}
        items={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <div className="grid gap-5 pt-5 [&>*]:min-w-0 lg:grid-cols-[1.4fr_1fr]">
                <div className="flex flex-col gap-5">
                  <Card className="p-5">
                    <SectionTitle>In brief</SectionTitle>
                    {dog.summary ? <Prose>{dog.summary}</Prose> : <p className="text-sm text-fg-muted">No summary yet. Add one from Edit.</p>}
                    {dog.concerns.length ? (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {dog.concerns.map((c) => (
                          <Tag key={c} tone="moss">
                            {c}
                          </Tag>
                        ))}
                      </div>
                    ) : null}
                  </Card>

                  <Card className="p-5">
                    <SectionTitle action={activePlan ? <Link className="text-sm font-semibold text-moss hover:underline" to={`/plans/${activePlan.id}`}>Open plan</Link> : null}>Current goals</SectionTitle>
                    {records.loading ? (
                      <SkeletonList rows={2} />
                    ) : activePlan ? (
                      <ol className="flex flex-col gap-3">
                        {records.goals
                          .filter((g) => g.planId === activePlan.id)
                          .map((g) => {
                            const last = records.observations.find((o) => o.goalId === g.id);
                            const reached = g.milestones.filter((m) => m.reachedOn).length;
                            return (
                              <li key={g.id} className="rounded-2xl bg-paper p-3.5">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="font-semibold text-olive">{g.title}</p>
                                  <Tag tone={GOAL_STATUS[g.status].tone}>{GOAL_STATUS[g.status].label}</Tag>
                                </div>
                                {g.milestones.length ? (
                                  <p className="mt-1 text-sm text-fg-muted">
                                    {reached} of {g.milestones.length} milestones reached
                                    {g.milestones.find((m) => !m.reachedOn) ? ` · next: ${g.milestones.find((m) => !m.reachedOn)!.label}` : ''}
                                  </p>
                                ) : null}
                                {last ? (
                                  <p className="mt-2 border-s-2 border-sage ps-3 text-sm text-olive/90">
                                    <span className="text-fg-muted">{fmtDate(last.date, 'MMM d')}: </span>
                                    {last.observation}
                                  </p>
                                ) : null}
                              </li>
                            );
                          })}
                      </ol>
                    ) : (
                      <EmptyState title="No active plan" action={<ButtonLink size="sm" to={`/plans/new?dog=${dog.id}`}>Create a training plan</ButtonLink>}>
                        Plans hold prioritized goals, exercises and homework.
                      </EmptyState>
                    )}
                  </Card>

                  <Card className="p-5">
                    <SectionTitle>Background</SectionTitle>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <Detail label="Came from">{dog.acquisition}</Detail>
                      <Detail label="Joined family">{fmtDate(dog.acquisitionDate)}</Detail>
                      <Detail label="Rescue">{dog.rescueOrg}</Detail>
                      <Detail label="Vet">{dog.vetClinic}</Detail>
                      <Detail label="Coat">{dog.coat}</Detail>
                      <Detail label="Birthday">{fmtDate(dog.birthDate)}</Detail>
                    </dl>
                  </Card>
                </div>

                <div className="flex flex-col gap-5">
                  <Card className="p-5">
                    <SectionTitle>Coming up</SectionTitle>
                    <ul className="flex flex-col gap-3 text-[0.9375rem]">
                      <li className="flex items-start gap-3">
                        <CalendarClock className="mt-0.5 size-4 text-moss" aria-hidden />
                        {nextAppt ? (
                          <Link to={`/schedule/${nextAppt.id}`} className="hover:underline">
                            <span className="font-semibold">{relativeDay(nextAppt.start.slice(0, 10))}</span> · {CONSULT_TYPE[nextAppt.type]}
                          </Link>
                        ) : (
                          <span className="text-fg-muted">No appointment scheduled</span>
                        )}
                      </li>
                      {openFollowUps.map((f) => (
                        <li key={f.id} className="flex items-start gap-3">
                          <Flag className={cn('mt-0.5 size-4', f.dueDate < todayISO() ? 'text-clay' : 'text-honey')} aria-hidden />
                          <span>
                            {f.title}
                            <span className={cn('block text-sm', f.dueDate < todayISO() ? 'font-semibold text-clay' : 'text-fg-muted')}>
                              {f.dueDate < todayISO() ? 'Overdue · ' : 'Due '}
                              {relativeDay(f.dueDate)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <Card className="p-5">
                    <SectionTitle>People & home</SectionTitle>
                    {dogLinks.length === 0 ? (
                      <div className="text-[0.9375rem] text-fg-muted">
                        <p>No people linked yet.</p>
                        <div className="no-print mt-3 flex flex-wrap gap-2">
                          <ButtonLink to={`/clients/new?dog=${dog.id}`} size="sm">
                            New client for {dog.name}
                          </ButtonLink>
                          <ButtonLink to={`/dogs/${dog.id}/edit`} variant="secondary" size="sm">
                            Link an existing client
                          </ButtonLink>
                        </div>
                      </div>
                    ) : null}
                    <ul className="flex flex-col gap-2">
                      {dogLinks
                        .sort((a, b) => Number(!!a.endDate) - Number(!!b.endDate))
                        .map((l) => (
                          <li key={l.id} className={cn('text-[0.9375rem]', l.endDate && 'text-fg-muted')}>
                            <Link to={`/clients/${l.clientId}`} className="font-semibold hover:underline">
                              {clientName(clientMap.get(l.clientId))}
                            </Link>{' '}
                            · {l.role}
                            {l.isPrimary && !l.endDate ? ' (primary)' : ''}
                            <span className="block text-xs text-fg-muted">
                              since {fmtDate(l.startDate)}
                              {l.endDate ? ` · ended ${fmtDate(l.endDate)}` : ''}
                            </span>
                          </li>
                        ))}
                    </ul>
                    {household ? (
                      <div className="mt-4 border-t border-line pt-4 text-sm text-fg-muted">
                        <p className="font-semibold text-olive">{household.name}</p>
                        {household.homeType ? <p>{household.homeType}</p> : null}
                        {household.members.length ? <p>{household.members.map((m) => `${m.name} (${m.relationship})`).join(', ')}</p> : null}
                        {household.otherAnimals ? <p>Other animals: {household.otherAnimals}</p> : null}
                      </div>
                    ) : null}
                    {housemates.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {housemates.map((h) => (
                          <Link key={h.id} to={`/dogs/${h.id}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper py-1 ps-1 pe-3 text-sm font-semibold hover:border-moss/40">
                            <DogAvatar dog={h} size="sm" className="size-7 rounded-full text-sm" />
                            {h.name}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </Card>

                  {latestAssessment ? (
                    <Card className="p-5">
                      <SectionTitle>Latest assessment</SectionTitle>
                      <Link to={`/assessments/${latestAssessment.id}`} className="block rounded-2xl bg-paper p-3.5 hover:bg-mist/60">
                        <p className="font-semibold">{latestAssessment.mode === 'initial' ? 'Initial assessment' : 'Follow-up assessment'}</p>
                        <p className="text-sm text-fg-muted">
                          {fmtDate(latestAssessment.date)} · {latestAssessment.status === 'draft' ? 'Draft in progress' : 'Complete'}
                        </p>
                      </Link>
                    </Card>
                  ) : null}
                </div>
              </div>
            ),
          },
          { id: 'timeline', label: 'Timeline', content: <div className="pt-5"><DogTimeline dog={dog} records={records} /></div> },
          {
            id: 'assessments',
            label: `Assessments${records.assessments.length ? ` (${records.assessments.length})` : ''}`,
            content: (
              <div className="flex flex-col gap-3 pt-5">
                {records.assessments.map((a) => (
                  <Link key={a.id} to={`/assessments/${a.id}`} className="flex items-center gap-4 rounded-card border border-line bg-card p-4 hover:border-moss/40">
                    <ClipboardCheck className="size-5 text-moss" aria-hidden />
                    <span className="flex-1">
                      <span className="block font-semibold">{a.mode === 'initial' ? 'Initial assessment' : 'Follow-up assessment'}</span>
                      <span className="block text-sm text-fg-muted">
                        {fmtDate(a.date)} · template v{a.templateVersion}
                        {a.revision > 1 ? ` · revision ${a.revision}` : ''}
                      </span>
                    </span>
                    <Tag tone={a.status === 'draft' ? 'honey' : 'moss'}>{a.status === 'draft' ? 'Draft' : 'Complete'}</Tag>
                  </Link>
                ))}
                {!records.assessments.length && !records.loading ? (
                  <EmptyState title="No assessments yet" action={<ButtonLink to={`/assessments/new?dog=${dog.id}&mode=initial`}>Start the initial assessment</ButtonLink>} />
                ) : null}
              </div>
            ),
          },
          {
            id: 'plans',
            label: 'Plans & sessions',
            content: (
              <div className="grid gap-5 pt-5 [&>*]:min-w-0 lg:grid-cols-2">
                <div>
                  <SectionTitle action={<Link to={`/plans/new?dog=${dog.id}`} className="text-sm font-semibold text-moss hover:underline">New plan</Link>}>Training plans</SectionTitle>
                  <ul className="flex flex-col gap-2">
                    {records.plans.map((p) => (
                      <li key={p.id}>
                        <Link to={`/plans/${p.id}`} className="block rounded-card border border-line bg-card p-4 hover:border-moss/40">
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{p.title}</span>
                            <Tag tone={p.status === 'active' ? 'moss' : 'neutral'}>{PLAN_STATUS[p.status]}</Tag>
                          </span>
                          <span className="text-sm text-fg-muted">Started {fmtDate(p.startDate)} · {records.goals.filter((g) => g.planId === p.id).length} goals</span>
                        </Link>
                      </li>
                    ))}
                    {!records.plans.length ? <p className="text-sm text-fg-muted">No plans yet.</p> : null}
                  </ul>
                </div>
                <div>
                  <SectionTitle action={<Link to={`/sessions/new?dog=${dog.id}`} className="text-sm font-semibold text-moss hover:underline">New session</Link>}>Sessions</SectionTitle>
                  <ul className="flex flex-col gap-2">
                    {records.consultations.map((c) => (
                      <li key={c.id}>
                        <Link to={`/sessions/${c.id}`} className="block rounded-card border border-line bg-card p-4 hover:border-moss/40">
                          <span className="font-semibold">{CONSULT_TYPE[c.type]}</span>
                          <span className="block text-sm text-fg-muted">
                            {fmtDate(c.date)}
                            {c.format === 'freeform' ? ' · quick notes' : ''}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {!records.consultations.length ? <p className="text-sm text-fg-muted">No sessions recorded yet.</p> : null}
                  </ul>
                </div>
                <div className="lg:col-span-2">
                  <SectionTitle>Reports</SectionTitle>
                  <ul className="flex flex-col gap-2">
                    {records.reports.map((r) => (
                      <li key={r.id}>
                        <Link to={`/reports/${r.id}`} className="flex items-center gap-3 rounded-card border border-line bg-card p-4 hover:border-moss/40">
                          <FileOutput className="size-5 text-moss" aria-hidden />
                          <span className="flex-1 font-semibold">{r.title}</span>
                          <Tag tone={r.status === 'final' ? 'moss' : 'honey'}>{r.status === 'final' ? 'Final' : 'Draft'}</Tag>
                        </Link>
                      </li>
                    ))}
                    {!records.reports.length ? <p className="text-sm text-fg-muted">Generate a report from a session, assessment, or training plan.</p> : null}
                  </ul>
                </div>
              </div>
            ),
          },
          { id: 'files', label: `Files${records.documents.length ? ` (${records.documents.length})` : ''}`, content: <div className="pt-5"><DogFiles dog={dog} documents={records.documents} /></div> },
        ]}
      />
    </div>
  );
}

function QuickAction({ to, icon, label, className }: { to: string; icon: ReactNode; label: string; className?: string }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5 rounded-2xl border border-line bg-card px-3.5 py-3 text-sm font-semibold text-olive transition-colors hover:border-moss/40 hover:bg-white [&_svg]:size-[1.125rem] [&_svg]:text-moss', className)}>
      {icon}
      {label}
    </Link>
  );
}

function PhotoControl({ dog }: { dog: Dog }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="relative w-fit">
      <DogAvatar dog={dog} size="xl" className="ring-4 ring-cream/10" />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="no-print absolute -end-2 -bottom-2 inline-flex size-10 items-center justify-center rounded-full bg-cream text-olive shadow-md hover:bg-white"
        aria-label={dog.photoPath ? `Change ${dog.name}’s photo` : `Add a photo of ${dog.name}`}
      >
        <Camera className={cn('size-5', busy && 'animate-pulse')} aria-hidden />
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            await uploadDogFile(dog, file, 'photo');
            toast('Photo updated');
          } catch (err) {
            toast(err instanceof Error && !('code' in err) ? err.message : friendlyError(err), 'error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function DogFiles({ dog, documents }: { dog: Dog; documents: ReturnType<typeof useDogRecords>['documents'] }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">Vet records, intake forms, rescue paperwork, photos. Private to the practice.</p>
        <Button variant="secondary" size="sm" busy={busy} onClick={() => input.current?.click()}>
          <Paperclip className="size-4" aria-hidden />
          Attach file
        </Button>
        <input
          ref={input}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          tabIndex={-1}
          aria-label="Attach a file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            try {
              await uploadDogFile(dog, file, 'document');
              toast('File attached');
            } catch (err) {
              toast(err instanceof Error && !('code' in err) ? err.message : friendlyError(err), 'error');
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {documents.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-card">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="size-5 shrink-0 text-moss" aria-hidden />
              <button type="button" className="min-w-0 flex-1 truncate text-start font-medium hover:underline" onClick={() => void openDogFile(d)}>
                {d.name}
              </button>
              <span className="hidden text-xs text-fg-muted sm:inline">
                {d.kind === 'photo' ? 'Photo' : 'Document'} · {Math.max(1, Math.round(d.size / 1024))} KB
              </span>
              <button
                type="button"
                aria-label={`Remove ${d.name}`}
                className="rounded-full p-2 text-fg-muted hover:bg-clay-soft hover:text-clay"
                onClick={async () => {
                  if (!confirm(`Remove ${d.name}? This deletes the file.`)) return;
                  try {
                    await removeDogFile(d);
                    toast('File removed');
                  } catch (err) {
                    toast(friendlyError(err), 'error');
                  }
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No files yet" icon={<Paperclip className="size-7" />} />
      )}
    </div>
  );
}

interface TimelineEntry {
  date: string;
  icon: ReactNode;
  title: string;
  detail?: string;
  to?: string;
  tone?: 'clay' | 'moss' | 'honey';
}

function DogTimeline({ dog, records }: { dog: Dog; records: ReturnType<typeof useDogRecords> }) {
  const navigate = useNavigate();
  const { links, clients } = usePractice();
  const [filter, setFilter] = useState('all');
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const goals = new Map(records.goals.map((g) => [g.id, g]));
  const entries: (TimelineEntry & { kind: string })[] = [
    ...records.assessments.map((a) => ({
      kind: 'assessments',
      date: a.date,
      icon: <ClipboardCheck />,
      title: `${a.mode === 'initial' ? 'Initial' : 'Follow-up'} assessment${a.status === 'draft' ? ' (draft)' : ''}`,
      to: `/assessments/${a.id}`,
    })),
    ...records.consultations.map((c) => ({
      kind: 'sessions',
      date: c.date,
      icon: <NotebookPen />,
      title: CONSULT_TYPE[c.type],
      detail: (c.format === 'freeform' ? c.freeformNotes : c.observations)?.slice(0, 180),
      to: `/sessions/${c.id}`,
    })),
    ...records.plans.map((p) => ({ kind: 'plans', date: p.startDate, icon: <Sprout />, title: `Training plan started: ${p.title}`, to: `/plans/${p.id}` })),
    ...records.observations.map((o) => ({
      kind: 'progress',
      date: o.date,
      icon: o.milestone ? <Flag /> : <Eye />,
      tone: o.milestone ? ('moss' as const) : undefined,
      title: o.milestone ? `Milestone: ${o.milestone}` : `Progress · ${goals.get(o.goalId)?.title ?? 'goal'}`,
      detail: `${o.source === 'observed' ? 'Observed' : 'Reported'}: ${o.observation}`,
      to: `/plans/${o.planId}`,
    })),
    ...records.appointments
      .filter((a) => a.status !== 'completed')
      .map((a) => ({
        kind: 'schedule',
        date: a.start.slice(0, 10),
        icon: <CalendarClock />,
        tone: a.status === 'scheduled' ? ('honey' as const) : undefined,
        title: `${CONSULT_TYPE[a.type]} · ${a.status === 'scheduled' ? 'scheduled' : a.status === 'noShow' ? 'no-show' : a.status}`,
        to: `/schedule/${a.id}`,
      })),
    ...records.followUps.map((f) => ({ kind: 'schedule', date: f.dueDate, icon: <Flag />, title: `Follow-up: ${f.title}`, detail: f.status === 'done' ? 'Done' : 'Open' })),
    ...links
      .filter((l) => l.dogId === dog.id)
      .flatMap((l) => [
        { kind: 'people', date: l.startDate, icon: <UserRound />, title: `${clientName(clientMap.get(l.clientId))} became ${l.role}`, to: `/clients/${l.clientId}` },
        ...(l.endDate ? [{ kind: 'people', date: l.endDate, icon: <UserRound />, title: `${clientName(clientMap.get(l.clientId))} no longer ${l.role}`, to: `/clients/${l.clientId}` }] : []),
      ]),
    ...records.documents.map((d) => ({ kind: 'files', date: d.createdAt?.toDate().toISOString().slice(0, 10) ?? '', icon: <Paperclip />, title: `File added: ${d.name}` })),
    ...(dog.acquisitionDate ? [{ kind: 'people', date: dog.acquisitionDate, icon: <Footprints />, title: `Joined the family${dog.acquisition ? ` (${dog.acquisition.toLowerCase()})` : ''}` }] : []),
  ]
    .filter((e) => e.date && (filter === 'all' || e.kind === filter))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (records.loading) return <SkeletonList />;

  return (
    <div>
      <label className="mb-4 flex items-center gap-2 text-sm text-fg-muted">
        Show
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-control border border-line bg-white px-2 text-sm text-olive">
          <option value="all">Everything</option>
          <option value="sessions">Sessions</option>
          <option value="assessments">Assessments</option>
          <option value="progress">Progress</option>
          <option value="plans">Plans</option>
          <option value="schedule">Schedule & follow-ups</option>
          <option value="people">People & household</option>
          <option value="files">Files</option>
        </select>
      </label>
      {entries.length ? (
        <ol className="trail flex flex-col gap-1">
          {entries.map((e, i) => (
            <li key={i} className="relative flex gap-4 ps-0">
              <span
                className={cn(
                  'relative z-[1] mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-paper [&_svg]:size-3.5',
                  e.tone === 'moss' ? 'bg-moss text-paper' : e.tone === 'honey' ? 'bg-honey-soft text-honey' : 'bg-mist text-moss',
                )}
                aria-hidden
              >
                {e.icon}
              </span>
              <div
                className={cn('min-w-0 flex-1 rounded-2xl px-3 py-2', e.to && 'cursor-pointer hover:bg-card')}
                onClick={e.to ? () => navigate(e.to!) : undefined}
              >
                <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{fmtDate(e.date)}</p>
                {e.to ? (
                  <Link to={e.to} className="font-semibold text-olive hover:underline" onClick={(ev) => ev.stopPropagation()}>
                    {e.title}
                  </Link>
                ) : (
                  <p className="font-semibold text-olive">{e.title}</p>
                )}
                {e.detail ? <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">{e.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="Nothing recorded yet" />
      )}
    </div>
  );
}
