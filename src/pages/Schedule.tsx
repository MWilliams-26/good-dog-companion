import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, deleteDoc, doc, limit, orderBy, query, where } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, ToggleGroup, cn } from '@mwilliams/ui';
import { CalendarClock, Check, ExternalLink, Flag, MapPin, NotebookPen, Plus, Trash2, Video } from 'lucide-react';
import { db } from '../lib/firebase';
import { createRecord, friendlyError, updateRecord, useQuery } from '../lib/db';
import { useOpenFollowUps, useUpcomingAppointments } from '../lib/queries';
import { usePractice, clientName } from '../stores/practice';
import { Button, ButtonLink, EmptyState, ErrorNote, PageHeader, SkeletonList, Tag } from '../components/ui';
import { SelectInput, TextArea, TextInput } from '../components/form';
import { DogAvatar } from '../components/DogAvatar';
import { CONSULT_TYPE, APPT_STATUS } from '../lib/labels';
import { fmtDate, fmtTime, isoDateOffset, relativeDay, todayISO } from '../lib/dates';
import { toast } from '../stores/toast';
import type { Appointment, FollowUp } from '../lib/types';

export const PUBLIC_BOOKING_URL = 'https://gooddogbehaviorconsultants.as.me/schedule.php';

export function SchedulePage() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(params.get('view') ?? (params.get('followup') ? 'followups' : 'upcoming'));
  const followUpOpen = params.get('followup') === 'new';

  return (
    <div>
      <PageHeader
        title="Schedule"
        eyebrow="Appointments & follow-ups"
        actions={
          <>
            <Button variant="secondary" onClick={() => setParams((p) => (p.set('followup', 'new'), p))}>
              <Flag className="size-4" aria-hidden />
              Follow-up
            </Button>
            <ButtonLink to="/schedule/new">
              <Plus className="size-4" aria-hidden />
              Appointment
            </ButtonLink>
          </>
        }
      />
      <div className="mb-5">
        <ToggleGroup
          legend="View"
          hideLegend
          value={view}
          onValueChange={(v) => {
            setView(v);
            setParams((p) => (p.set('view', v), p.delete('followup'), p), { replace: true });
          }}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'followups', label: 'Follow-ups' },
            { value: 'past', label: 'Past' },
          ]}
        />
      </div>
      {view === 'upcoming' ? <Upcoming /> : view === 'followups' ? <FollowUps /> : <Past />}
      <p className="mt-10 flex flex-wrap items-center gap-1 text-xs text-fg-muted">
        Clients still book through your public scheduler.
        <a href={PUBLIC_BOOKING_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-moss hover:underline">
          Open booking page <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
      <FollowUpDialog
        open={followUpOpen}
        onOpenChange={(o) => {
          if (!o) setParams((p) => (p.delete('followup'), p.delete('dog'), p.delete('client'), p), { replace: true });
        }}
        presetDog={params.get('dog') ?? undefined}
        presetClient={params.get('client') ?? undefined}
      />
    </div>
  );
}

export function AppointmentRow({ a }: { a: Appointment }) {
  const { dogs, clients } = usePractice();
  const ds = a.dogIds.map((id) => dogs.find((d) => d.id === id)).filter(Boolean);
  const who = ds.length ? ds.map((d) => d!.name).join(' & ') : a.clientIds.map((c) => clientName(clients.find((x) => x.id === c))).join(', ');
  const isPast = a.start < new Date().toISOString();
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-16 shrink-0 text-center">
        <p className="text-[0.9375rem] font-bold text-olive">{fmtTime(a.start).replace(' ', '\u202f')}</p>
        <p className="text-xs text-fg-muted">{a.durationMinutes} min</p>
      </div>
      <div className="flex -space-x-3">
        {ds.slice(0, 2).map((d) => (
          <DogAvatar key={d!.id} dog={d!} size="sm" className="ring-2 ring-card" />
        ))}
      </div>
      <Link to={`/schedule/${a.id}`} className="min-w-0 flex-1 hover:underline">
        <p className="truncate font-semibold">{who || 'Unassigned'}</p>
        <p className="flex items-center gap-1 truncate text-sm text-fg-muted">
          {a.type === 'virtual' ? <Video className="size-3.5 shrink-0" aria-hidden /> : <MapPin className="size-3.5 shrink-0" aria-hidden />}
          {CONSULT_TYPE[a.type]}
          {a.location ? ` · ${a.location}` : ''}
        </p>
      </Link>
      {a.status === 'scheduled' && a.type !== 'discoveryCall' ? (
        <ButtonLink to={`/sessions/new?appointment=${a.id}`} variant={isPast ? 'primary' : 'secondary'} size="sm" aria-label={`Start notes for ${who}`}>
          <NotebookPen className="size-4" aria-hidden />
          <span className="hidden sm:inline">Notes</span>
        </ButtonLink>
      ) : a.status !== 'scheduled' ? (
        <Tag tone={a.status === 'completed' ? 'moss' : 'neutral'}>{APPT_STATUS[a.status]}</Tag>
      ) : null}
    </li>
  );
}

function groupByDay(items: Appointment[]) {
  const map = new Map<string, Appointment[]>();
  for (const a of items) {
    const day = fmtDate(a.start, 'yyyy-MM-dd');
    map.set(day, [...(map.get(day) ?? []), a]);
  }
  return [...map.entries()];
}

function Upcoming() {
  const start = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const { data, loading, error } = useUpcomingAppointments(start, 60);
  if (error) return <ErrorNote>{friendlyError(error)}</ErrorNote>;
  if (loading) return <SkeletonList />;
  if (!data.length) return <EmptyState icon={<CalendarClock className="size-8" />} title="Nothing scheduled" action={<ButtonLink to="/schedule/new">Add an appointment</ButtonLink>} />;
  return (
    <div className="flex flex-col gap-5">
      {groupByDay(data).map(([day, items]) => (
        <section key={day} aria-label={fmtDate(day, 'EEEE, MMMM d')}>
          <h2 className="mb-2 flex items-baseline gap-2">
            <span className="font-serif text-xl font-medium">{relativeDay(day)}</span>
            <span className="text-sm text-fg-muted">{fmtDate(day, 'EEEE, MMM d')}</span>
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {items.map((a) => (
              <AppointmentRow key={a.id} a={a} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Past() {
  const [max, setMax] = useState(30);
  const now = useMemo(() => new Date().toISOString(), []);
  const { data, loading } = useQuery<Appointment>(query(collection(db, 'appointments'), where('start', '<', now), orderBy('start', 'desc'), limit(max)), `past-${max}`);
  if (loading && !data.length) return <SkeletonList />;
  if (!data.length) return <EmptyState title="No past appointments" />;
  return (
    <div className="flex flex-col gap-5">
      {groupByDay(data).map(([day, items]) => (
        <section key={day} aria-label={fmtDate(day, 'EEEE, MMMM d')}>
          <h2 className="mb-2 text-sm font-semibold text-fg-muted">{fmtDate(day, 'EEEE, MMM d, yyyy')}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {items.map((a) => (
              <AppointmentRow key={a.id} a={a} />
            ))}
          </ul>
        </section>
      ))}
      {data.length >= max ? (
        <button type="button" onClick={() => setMax((m) => m + 30)} className="mx-auto rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold">
          Load older
        </button>
      ) : null}
    </div>
  );
}

export function FollowUpItem({ f, compact = false }: { f: FollowUp; compact?: boolean }) {
  const { dogs, clients } = usePractice();
  const dog = dogs.find((d) => d.id === f.dogId);
  const client = clients.find((c) => c.id === f.clientId);
  const overdue = f.status === 'open' && f.dueDate < todayISO();
  const toggle = async () => {
    try {
      await updateRecord<FollowUp>('followUps', f.id, f.status === 'open' ? { status: 'done', completedAt: new Date().toISOString() } : { status: 'open', completedAt: null });
      toast(f.status === 'open' ? 'Marked done' : 'Reopened');
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={f.status === 'open' ? `Mark “${f.title}” done` : `Reopen “${f.title}”`}
        className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors', f.status === 'done' ? 'border-moss bg-moss text-paper' : overdue ? 'border-clay hover:bg-clay-soft' : 'border-line-strong hover:bg-mist')}
      >
        {f.status === 'done' ? <Check className="size-3.5" aria-hidden /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('font-semibold', f.status === 'done' && 'text-fg-muted line-through')}>{f.title}</p>
        <p className="text-sm text-fg-muted">
          <span className={cn(overdue && 'font-semibold text-clay')}>{overdue ? `Overdue · ${relativeDay(f.dueDate)}` : f.status === 'done' ? 'Done' : `Due ${relativeDay(f.dueDate)}`}</span>
          {dog ? (
            <>
              {' · '}
              <Link to={`/dogs/${dog.id}`} className="hover:underline">
                {dog.name}
              </Link>
            </>
          ) : null}
          {client && !compact ? (
            <>
              {' · '}
              <Link to={`/clients/${client.id}`} className="hover:underline">
                {clientName(client)}
              </Link>
            </>
          ) : null}
        </p>
        {f.notes && !compact ? <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{f.notes}</p> : null}
      </div>
      {!compact ? (
        <button
          type="button"
          aria-label={`Delete “${f.title}”`}
          className="rounded-full p-2 text-fg-muted hover:bg-clay-soft hover:text-clay"
          onClick={async () => {
            if (!confirm('Delete this follow-up?')) return;
            await deleteDoc(doc(db, 'followUps', f.id));
            toast('Follow-up deleted');
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

function FollowUps() {
  const { data, loading, error } = useOpenFollowUps();
  const done = useQuery<FollowUp>(query(collection(db, 'followUps'), where('status', '==', 'done'), orderBy('dueDate', 'desc'), limit(15)), 'done-followups');
  const today = todayISO();
  const week = isoDateOffset(7);
  const groups = [
    { title: 'Overdue', items: data.filter((f) => f.dueDate < today) },
    { title: 'This week', items: data.filter((f) => f.dueDate >= today && f.dueDate <= week) },
    { title: 'Later', items: data.filter((f) => f.dueDate > week) },
    { title: 'Recently done', items: done.data },
  ];
  if (error) return <ErrorNote>{friendlyError(error)}</ErrorNote>;
  if (loading) return <SkeletonList />;
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) =>
        g.items.length ? (
          <section key={g.title} aria-label={g.title}>
            <h2 className={cn('mb-2 text-xs font-bold tracking-[0.12em] uppercase', g.title === 'Overdue' ? 'text-clay' : 'text-moss-soft')}>
              {g.title} · {g.items.length}
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
              {g.items.map((f) => (
                <FollowUpItem key={f.id} f={f} />
              ))}
            </ul>
          </section>
        ) : null,
      )}
      {!data.length && !done.data.length ? <EmptyState icon={<Flag className="size-8" />} title="No follow-ups" /> : null}
    </div>
  );
}

const followUpSchema = z.object({
  title: z.string().trim().min(1, 'What needs to happen?').max(300),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a due date.'),
  dogId: z.string().optional(),
  clientId: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

export function FollowUpDialog({ open, onOpenChange, presetDog, presetClient }: { open: boolean; onOpenChange: (o: boolean) => void; presetDog?: string; presetClient?: string }) {
  const { dogs, clients, links } = usePractice();
  const form = useForm<z.input<typeof followUpSchema>>({ resolver: zodResolver(followUpSchema) });
  useEffect(() => {
    if (!open) return;
    const clientFromDog = presetDog ? links.find((l) => l.dogId === presetDog && !l.endDate && l.isPrimary)?.clientId : undefined;
    form.reset({ title: '', dueDate: isoDateOffset(3), dogId: presetDog ?? '', clientId: presetClient ?? clientFromDog ?? '', notes: '' });
  }, [open, presetDog, presetClient, links, form]);

  const submit = form.handleSubmit(async (v) => {
    try {
      await createRecord<FollowUp>('followUps', { title: v.title, dueDate: v.dueDate, status: 'open', dogId: v.dogId || null, clientId: v.clientId || null, notes: v.notes || undefined, consultationId: null });
      toast('Follow-up added');
      onOpenChange(false);
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New follow-up"
      description="A reminder for you. Nothing is sent to the client."
      className="bg-paper"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} busy={form.formState.isSubmitting}>
            Add follow-up
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextInput label="Reminder" required data-autofocus placeholder="e.g. Email Priya about muzzle progress" error={form.formState.errors.title?.message} {...form.register('title')} />
        <TextInput label="Due" type="date" required error={form.formState.errors.dueDate?.message} {...form.register('dueDate')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput label="Dog" placeholder="—" options={dogs.filter((d) => !d.archived).sort((a, b) => a.name.localeCompare(b.name)).map((d) => ({ value: d.id, label: d.name }))} {...form.register('dogId')} />
          <SelectInput label="Client" placeholder="—" options={clients.filter((c) => !c.archived).sort((a, b) => a.lastName.localeCompare(b.lastName)).map((c) => ({ value: c.id, label: clientName(c) }))} {...form.register('clientId')} />
        </div>
        <TextArea label="Notes" rows={2} {...form.register('notes')} />
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}
