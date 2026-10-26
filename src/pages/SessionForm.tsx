import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, query, where } from 'firebase/firestore';
import { ToggleGroup, cn } from '@mwilliams/ui';
import { db } from '../lib/firebase';
import { batchWriter, friendlyError, newId, useQuery, useRecord } from '../lib/db';
import { usePractice, currentLinksForDog } from '../stores/practice';
import { Button, Card, Loading, NotFound, PageHeader, PrivateLabel, SectionTitle } from '../components/ui';
import { Checkbox, FormActions, SelectInput, TextArea, TextInput, controlClass, AutoGrow } from '../components/form';
import { DogAvatar } from '../components/DogAvatar';
import { CONSULT_TYPE } from '../lib/labels';
import { isoDateOffset, todayISO } from '../lib/dates';
import { toast } from '../stores/toast';
import type { Appointment, Consultation, ConsultationType, FollowUp, Goal, ProgressObservation, TrainingPlan } from '../lib/types';

const schema = z.object({
  dogIds: z.array(z.string()).min(1, 'Choose at least one dog.'),
  type: z.enum(['initial', 'followUp', 'virtual', 'checkIn']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.'),
  durationMinutes: z.union([z.coerce.number().int().min(0).max(600), z.literal('')]).optional(),
  location: z.string().max(200).optional(),
  format: z.enum(['structured', 'freeform']),
  observations: z.string().max(50000).optional(),
  exercisesPracticed: z.string().max(20000).optional(),
  changesSinceLast: z.string().max(20000).optional(),
  homework: z.string().max(20000).optional(),
  nextSteps: z.string().max(20000).optional(),
  privateNotes: z.string().max(50000).optional(),
  freeformNotes: z.string().max(50000).optional(),
  followUp: z.boolean(),
  followUpTitle: z.string().max(300).optional(),
  followUpDate: z.string().optional(),
});
type Values = z.input<typeof schema>;

// Prompts change with the kind of session so the form reads naturally.
const PROMPTS: Record<ConsultationType, { observations: string; changes?: string; exercises: string }> = {
  initial: { observations: 'What you observed', exercises: 'Exercises introduced' },
  followUp: { observations: 'What you observed today', changes: 'Changes since last session', exercises: 'Exercises practiced' },
  virtual: { observations: 'What you observed on video', changes: 'Changes since last session', exercises: 'Exercises coached' },
  checkIn: { observations: 'How things are going', changes: 'What’s changed', exercises: 'Exercises discussed' },
};

interface GoalEntry {
  worked: boolean;
  observation: string;
  source: 'reported' | 'observed';
  milestone: string;
}

export function SessionFormPage() {
  const { id } = useParams();
  const existing = useRecord<Consultation>('consultations', id);
  if (id && existing.loading) return <Loading />;
  if (id && !existing.data) return <NotFound what="Session" back={{ to: '/sessions', label: 'Sessions' }} />;
  return <SessionForm key={id ?? 'new'} existing={existing.data ?? undefined} />;
}

function SessionForm({ existing }: { existing?: Consultation }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { dogs, links, households } = usePractice();
  const appointment = useRecord<Appointment>('appointments', params.get('appointment')).data;
  const presetDog = params.get('dog');

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? { ...existing, durationMinutes: existing.durationMinutes ?? '', followUp: false }
      : {
          dogIds: presetDog ? [presetDog] : [],
          type: 'followUp',
          date: todayISO(),
          durationMinutes: 60,
          format: params.get('format') === 'freeform' ? 'freeform' : 'structured',
          followUp: true,
          followUpDate: isoDateOffset(7),
        },
  });
  const { register, control, watch, setValue, formState } = form;
  const dogIds = watch('dogIds');
  const type = watch('type');
  const fmt = watch('format');
  const wantsFollowUp = watch('followUp');

  // Prefill from an appointment.
  useEffect(() => {
    if (!appointment || existing) return;
    setValue('dogIds', appointment.dogIds);
    if (appointment.type !== 'discoveryCall') setValue('type', appointment.type);
    setValue('date', appointment.start.slice(0, 10));
    setValue('durationMinutes', appointment.durationMinutes);
    if (appointment.location) setValue('location', appointment.location);
  }, [appointment, existing, setValue]);

  // Default location from the household.
  useEffect(() => {
    if (existing || form.getValues('location') || !dogIds.length) return;
    const dog = dogs.find((d) => d.id === dogIds[0]);
    const hh = households.find((h) => h.id === dog?.householdId);
    if (type === 'virtual') setValue('location', 'Video call');
    else if (hh?.neighborhood) setValue('location', `Home · ${hh.neighborhood}`);
  }, [dogIds, type, dogs, households, existing, setValue, form]);

  const firstDog = dogIds[0];
  const plans = useQuery<TrainingPlan>(firstDog ? query(collection(db, 'trainingPlans'), where('dogId', '==', firstDog)) : null, `sf-plans-${firstDog}`);
  const activePlan = plans.data.find((p) => p.status === 'active');
  const goalsQ = useQuery<Goal>(activePlan ? query(collection(db, 'goals'), where('planId', '==', activePlan.id)) : null, `sf-goals-${activePlan?.id}`);
  const goals = useMemo(() => [...goalsQ.data].filter((g) => g.status !== 'achieved' || existing?.goalIds.includes(g.id)).sort((a, b) => a.priority - b.priority), [goalsQ.data, existing]);
  const [entries, setEntries] = useState<Record<string, GoalEntry>>({});
  const entry = (gid: string): GoalEntry => entries[gid] ?? { worked: existing?.goalIds.includes(gid) ?? false, observation: '', source: 'observed', milestone: '' };
  const setEntry = (gid: string, p: Partial<GoalEntry>) => setEntries((e) => ({ ...e, [gid]: { ...entry(gid), ...p } }));

  const prompts = PROMPTS[type];
  const activeDogs = dogs.filter((d) => !d.archived || dogIds.includes(d.id)).sort((a, b) => a.name.localeCompare(b.name));

  const onSubmit = form.handleSubmit(async (raw) => {
    const v = schema.parse(raw);
    const clientIds = [...new Set(v.dogIds.flatMap((d) => currentLinksForDog(links, d).map((l) => l.clientId)))];
    const workedGoals = goals.filter((g) => entry(g.id).worked || entry(g.id).observation.trim());
    const record = {
      dogIds: v.dogIds,
      clientIds,
      type: v.type,
      date: v.date,
      durationMinutes: v.durationMinutes === '' || v.durationMinutes === undefined ? undefined : Number(v.durationMinutes),
      location: v.location || undefined,
      format: v.format,
      observations: v.observations || undefined,
      exercisesPracticed: v.exercisesPracticed || undefined,
      changesSinceLast: v.changesSinceLast || undefined,
      homework: v.homework || undefined,
      nextSteps: v.nextSteps || undefined,
      privateNotes: v.privateNotes || undefined,
      freeformNotes: v.freeformNotes || undefined,
      planId: activePlan?.id ?? existing?.planId ?? null,
      goalIds: [...new Set([...(existing?.goalIds ?? []), ...workedGoals.map((g) => g.id)])],
      appointmentId: existing?.appointmentId ?? appointment?.id ?? null,
    };
    try {
      const w = batchWriter();
      const sessionId = existing?.id ?? newId('consultations');
      if (existing) w.update<Consultation>('consultations', sessionId, record);
      else w.create<Consultation>('consultations', record, sessionId);

      for (const g of workedGoals) {
        const e = entry(g.id);
        if (e.observation.trim() || e.milestone) {
          w.create<ProgressObservation>('progressObservations', {
            goalId: g.id,
            planId: g.planId,
            dogId: g.dogId,
            date: v.date,
            observation: e.observation.trim() || `Milestone reached: ${e.milestone}`,
            source: e.source,
            consultationId: sessionId,
            milestone: e.milestone || null,
          });
        }
        const patch: Partial<Goal> = {};
        if (e.milestone) patch.milestones = g.milestones.map((m) => (m.label === e.milestone && !m.reachedOn ? { ...m, reachedOn: v.date } : m));
        if (g.status === 'notStarted') patch.status = 'inProgress';
        if (Object.keys(patch).length) w.update<Goal>('goals', g.id, patch);
      }
      if (v.followUp && v.followUpDate) {
        const dogName = dogs.find((d) => d.id === v.dogIds[0])?.name ?? '';
        w.create<FollowUp>('followUps', {
          title: v.followUpTitle?.trim() || `Check in on ${dogName}’s homework`,
          dueDate: v.followUpDate,
          status: 'open',
          dogId: v.dogIds[0],
          clientId: clientIds[0] ?? null,
          consultationId: sessionId,
          notes: v.homework,
        });
      }
      if (appointment && !existing && appointment.status === 'scheduled') {
        w.update<Appointment>('appointments', appointment.id, { status: 'completed', consultationId: sessionId });
      }
      await w.commit();
      toast(existing ? 'Session updated' : 'Session saved');
      navigate(`/sessions/${sessionId}`);
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  });

  return (
    <div>
      <PageHeader title={existing ? 'Edit session' : 'Session notes'} back={existing ? { to: `/sessions/${existing.id}`, label: 'Session' } : { to: '/sessions', label: 'Sessions' }} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Card className="p-5 sm:p-6">
          <Controller
            control={control}
            name="dogIds"
            render={({ field }) => (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">
                  Dog{field.value.length > 1 ? 's' : ''} <span className="text-clay">*</span>
                </legend>
                <div className="-mx-1 flex max-h-44 flex-wrap gap-2 overflow-y-auto px-1 py-1">
                  {activeDogs.map((d) => {
                    const on = field.value.includes(d.id);
                    return (
                      <label key={d.id} className={cn('inline-flex cursor-pointer items-center gap-2 rounded-full border py-1 ps-1 pe-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-moss/40', on ? 'border-moss bg-moss text-paper' : 'border-line bg-white hover:border-line-strong')}>
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => field.onChange(on ? field.value.filter((x) => x !== d.id) : [...field.value, d.id])} />
                        <DogAvatar dog={d} size="sm" className="size-7 rounded-full text-sm" />
                        {d.name}
                      </label>
                    );
                  })}
                </div>
                {formState.errors.dogIds ? <p className="mt-1 text-sm text-clay">{formState.errors.dogIds.message}</p> : null}
              </fieldset>
            )}
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            <SelectInput wrapClass="sm:col-span-2" label="Session type" options={(['initial', 'followUp', 'virtual', 'checkIn'] as const).map((t) => ({ value: t, label: CONSULT_TYPE[t] }))} {...register('type')} />
            <TextInput label="Date" type="date" required error={formState.errors.date?.message} {...register('date')} />
            <TextInput label="Minutes" type="number" inputMode="numeric" {...register('durationMinutes')} />
            <TextInput wrapClass="sm:col-span-4" label="Location" {...register('location')} />
          </div>
        </Card>

        <Controller
          control={control}
          name="format"
          render={({ field }) => (
            <ToggleGroup
              legend="Note style"
              hideLegend
              value={field.value}
              onValueChange={field.onChange}
              options={[
                { value: 'structured', label: 'Structured' },
                { value: 'freeform', label: 'Quick notes' },
              ]}
            />
          )}
        />

        {fmt === 'freeform' ? (
          <Card className="p-5 sm:p-6">
            <TextArea label="Notes" hint="Write it however it comes. You can always restructure later." rows={10} autoFocus {...register('freeformNotes')} />
            <div className="mt-4">
              <TextArea label="Consultant-only" badge={<PrivateLabel />} rows={2} {...register('privateNotes')} />
            </div>
          </Card>
        ) : (
          <Card className="flex flex-col gap-4 p-5 sm:p-6">
            {prompts.changes ? <TextArea label={prompts.changes} rows={3} {...register('changesSinceLast')} /> : null}
            <TextArea label={prompts.observations} rows={4} {...register('observations')} />
            <TextArea label={prompts.exercises} rows={3} {...register('exercisesPracticed')} />
            <TextArea label="Client homework" hint="Shareable — this goes in the client summary." rows={3} {...register('homework')} />
            <TextArea label="Next steps" rows={2} {...register('nextSteps')} />
            <TextArea label="Consultant-only notes" badge={<PrivateLabel />} hint="Hypotheses, handler notes, anything not for the client." rows={3} {...register('privateNotes')} />
          </Card>
        )}

        {activePlan && goals.length ? (
          <Card className="p-5 sm:p-6">
            <SectionTitle>Goals · {activePlan.title}</SectionTitle>
            <p className="-mt-1 mb-4 text-sm text-fg-muted">Note what you saw for any goal you worked on. Each note is saved as a dated progress observation.</p>
            <ul className="flex flex-col gap-3">
              {goals.map((g) => {
                const e = entry(g.id);
                const open = g.milestones.filter((m) => !m.reachedOn);
                return (
                  <li key={g.id} className={cn('rounded-2xl border p-4', e.worked ? 'border-moss/40 bg-[#f3f6ee]' : 'border-line')}>
                    <Checkbox checked={e.worked} onChange={(ev) => setEntry(g.id, { worked: ev.target.checked })} label={<span className="font-semibold">{g.title}</span>} />
                    {e.worked ? (
                      <div className="mt-3 flex flex-col gap-3 ps-8">
                        <AutoGrow aria-label={`Progress observation for ${g.title}`} rows={2} placeholder="What did you see? Be specific and observable." className={cn(controlClass, 'resize-none')} value={e.observation} onChange={(ev) => setEntry(g.id, { observation: ev.target.value })} />
                        <div className="flex flex-wrap gap-3">
                          <select aria-label="Source" value={e.source} onChange={(ev) => setEntry(g.id, { source: ev.target.value as GoalEntry['source'] })} className="h-10 rounded-control border border-line bg-white px-2 text-sm">
                            <option value="observed">Observed by me</option>
                            <option value="reported">Reported by client</option>
                          </select>
                          {open.length ? (
                            <select aria-label="Milestone reached" value={e.milestone} onChange={(ev) => setEntry(g.id, { milestone: ev.target.value })} className="h-10 min-w-0 flex-1 rounded-control border border-line bg-white px-2 text-sm">
                              <option value="">No milestone reached</option>
                              {open.map((m) => (
                                <option key={m.label} value={m.label}>
                                  Reached: {m.label}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

        {!existing ? (
          <Card className="p-5 sm:p-6">
            <Controller control={control} name="followUp" render={({ field }) => <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} label="Set a follow-up reminder" hint="Shows on Home and Schedule when due. Nothing is sent to the client." />} />
            {wantsFollowUp ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_12rem]">
                <TextInput label="Reminder" placeholder="Check in on homework" {...register('followUpTitle')} />
                <TextInput label="Due" type="date" {...register('followUpDate')} />
              </div>
            ) : null}
          </Card>
        ) : null}

        <FormActions>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" busy={formState.isSubmitting}>
            {existing ? 'Save changes' : 'Save session'}
          </Button>
        </FormActions>
      </form>
    </div>
  );
}
