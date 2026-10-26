import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, cn } from '@mwilliams/ui';
import { ArrowDown, ArrowUp, Check, Eye, FileOutput, Flag, Pencil, Plus, Trash2, Target, Dumbbell, House } from 'lucide-react';
import { db } from '../lib/firebase';
import { batchWriter, createRecord, friendlyError, newId, updateRecord, useQuery, useRecord } from '../lib/db';
import { usePractice } from '../stores/practice';
import { Button, Card, EmptyState, Loading, NotFound, PageHeader, Prose, SectionTitle, Tag } from '../components/ui';
import { FormActions, SelectInput, TextArea, TextInput, controlClass } from '../components/form';
import { DogAvatar } from '../components/DogAvatar';
import { GOAL_STATUS, PLAN_STATUS } from '../lib/labels';
import { fmtDate, isoDateOffset, todayISO } from '../lib/dates';
import { toast } from '../stores/toast';
import type { Assessment, Goal, GoalStatus, ProgressObservation, TrainingPlan, Consultation } from '../lib/types';

const planSchema = z.object({
  title: z.string().trim().min(1, 'Give the plan a title.').max(200),
  status: z.enum(['active', 'paused', 'completed', 'archived']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a start date.'),
  reviewDate: z.string().optional(),
  summary: z.string().max(5000).optional(),
  management: z.string().max(5000).optional(),
});

export function PlanFormPage() {
  const { id } = useParams();
  const existing = useRecord<TrainingPlan>('trainingPlans', id);
  if (id && existing.loading) return <Loading />;
  if (id && !existing.data) return <NotFound what="Plan" back={{ to: '/dogs', label: 'Dogs' }} />;
  return <PlanForm key={id ?? 'new'} existing={existing.data ?? undefined} />;
}

function listValue(a: Assessment | undefined, qid: string): string[] {
  const v = a?.responses[qid]?.value;
  if (Array.isArray(v)) return v.map(String).filter((x) => x.trim());
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function PlanForm({ existing }: { existing?: TrainingPlan }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const dogs = usePractice((s) => s.dogs);
  const dogId = existing?.dogId ?? params.get('dog') ?? '';
  const dog = dogs.find((d) => d.id === dogId);
  const [assessment, setAssessment] = useState<Assessment | undefined>();
  const [useRecs, setUseRecs] = useState(true);
  const form = useForm<z.input<typeof planSchema>>({
    resolver: zodResolver(planSchema),
    defaultValues: existing ?? { title: dog ? `${dog.name}’s training plan` : 'Training plan', status: 'active', startDate: todayISO(), reviewDate: isoDateOffset(42) },
  });

  useEffect(() => {
    if (existing || !dogId) return;
    void getDocs(query(collection(db, 'assessments'), where('dogId', '==', dogId))).then((snap) => {
      const latest = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Assessment)
        .filter((a) => a.status === 'complete')
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      setAssessment(latest);
      if (latest) {
        const mgmt = listValue(latest, 'rc_management').join('\n');
        if (mgmt && !form.getValues('management')) form.setValue('management', mgmt);
      }
    });
  }, [dogId, existing, form]);

  if (!dog) return <NotFound what="Dog" back={{ to: '/dogs', label: 'Dogs' }} />;
  const recGoals = listValue(assessment, 'rc_goals');

  const onSubmit = form.handleSubmit(async (raw) => {
    const v = planSchema.parse(raw);
    try {
      if (existing) {
        await updateRecord<TrainingPlan>('trainingPlans', existing.id, { ...v, reviewDate: v.reviewDate || undefined });
        toast('Plan updated');
        navigate(`/plans/${existing.id}`);
        return;
      }
      const w = batchWriter();
      const planId = w.create<TrainingPlan>('trainingPlans', { ...v, reviewDate: v.reviewDate || undefined, dogId, assessmentId: assessment?.id ?? null });
      if (useRecs && recGoals.length) {
        const success = listValue(assessment, 'rc_success');
        const exercises = listValue(assessment, 'rc_exercises');
        const homework = listValue(assessment, 'rc_homework').join('\n');
        recGoals.forEach((title, i) =>
          w.create<Goal>('goals', {
            planId,
            dogId,
            title,
            priority: i + 1,
            successCriteria: i === 0 ? success : [],
            exercises: i === 0 ? exercises.map((name) => ({ name, instructions: '' })) : [],
            homework: i === 0 ? homework : undefined,
            status: 'notStarted',
            milestones: [],
          }),
        );
      }
      await w.commit();
      toast('Training plan created');
      navigate(`/plans/${planId}`);
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  });

  return (
    <div>
      <PageHeader title={existing ? 'Edit plan' : 'New training plan'} eyebrow={dog.name} back={{ to: existing ? `/plans/${existing.id}` : `/dogs/${dog.id}`, label: existing ? 'Plan' : dog.name }} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <TextInput label="Title" required error={form.formState.errors.title?.message} {...form.register('title')} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label="Start" type="date" error={form.formState.errors.startDate?.message} {...form.register('startDate')} />
            <TextInput label="Review by" type="date" {...form.register('reviewDate')} />
            <SelectInput label="Status" options={Object.entries(PLAN_STATUS).map(([value, label]) => ({ value, label }))} {...form.register('status')} />
          </div>
          <TextArea label="Plan overview" hint="Shareable — the “why” behind this plan, in plain language." rows={3} {...form.register('summary')} />
          <TextArea label="Management" hint="What to do right away to prevent rehearsal and keep everyone safe." rows={3} {...form.register('management')} />
        </Card>
        {!existing && recGoals.length ? (
          <Card className="p-5 sm:p-6">
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={useRecs} onChange={(e) => setUseRecs(e.target.checked)} className="mt-1 size-5 accent-moss" />
              <span>
                <span className="font-semibold">Start with the goals from the {fmtDate(assessment!.date)} assessment</span>
                <ol className="mt-2 list-decimal ps-5 text-sm text-fg-muted">
                  {recGoals.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ol>
              </span>
            </label>
          </Card>
        ) : null}
        <FormActions>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" busy={form.formState.isSubmitting}>
            {existing ? 'Save' : 'Create plan'}
          </Button>
        </FormActions>
      </form>
    </div>
  );
}

export function PlanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: plan, loading } = useRecord<TrainingPlan>('trainingPlans', id);
  const dogs = usePractice((s) => s.dogs);
  const goalsQ = useQuery<Goal>(id ? query(collection(db, 'goals'), where('planId', '==', id)) : null, `plan-goals-${id}`);
  const obsQ = useQuery<ProgressObservation>(id ? query(collection(db, 'progressObservations'), where('planId', '==', id)) : null, `plan-obs-${id}`);
  const sessionsQ = useQuery<Consultation>(id ? query(collection(db, 'consultations'), where('planId', '==', id)) : null, `plan-sessions-${id}`);
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [observing, setObserving] = useState<Goal | null>(null);

  if (loading) return <Loading />;
  if (!plan) return <NotFound what="Plan" back={{ to: '/dogs', label: 'Dogs' }} />;
  const dog = dogs.find((d) => d.id === plan.dogId);
  const goals = [...goalsQ.data].sort((a, b) => a.priority - b.priority);
  const obs = [...obsQ.data].sort((a, b) => b.date.localeCompare(a.date));
  const sessions = [...sessionsQ.data].sort((a, b) => b.date.localeCompare(a.date));

  const move = async (g: Goal, dir: -1 | 1) => {
    const i = goals.findIndex((x) => x.id === g.id);
    const other = goals[i + dir];
    if (!other) return;
    const w = batchWriter();
    w.update<Goal>('goals', g.id, { priority: other.priority });
    w.update<Goal>('goals', other.id, { priority: g.priority });
    await w.commit();
  };

  return (
    <div>
      <PageHeader
        title={plan.title}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Tag tone={plan.status === 'active' ? 'moss' : 'neutral'}>{PLAN_STATUS[plan.status]}</Tag>
            <span className="tracking-normal normal-case">
              Since {fmtDate(plan.startDate)}
              {plan.reviewDate ? ` · review ${fmtDate(plan.reviewDate)}` : ''}
            </span>
          </span>
        }
        back={dog ? { to: `/dogs/${dog.id}`, label: dog.name } : { to: '/dogs', label: 'Dogs' }}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/plans/${plan.id}/edit`)}>
              <Pencil className="size-4" aria-hidden />
              Edit
            </Button>
            <Button size="sm" onClick={() => navigate(`/reports/new?kind=trainingPlan&source=${plan.id}&id=${newId('reportDrafts')}`)}>
              <FileOutput className="size-4" aria-hidden />
              Client plan
            </Button>
          </>
        }
      />
      {dog ? (
        <Link to={`/dogs/${dog.id}`} className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 ps-1 pe-3.5 font-semibold">
          <DogAvatar dog={dog} size="sm" className="size-8 rounded-full" />
          {dog.name}
        </Link>
      ) : null}
      {plan.summary || plan.management ? (
        <Card className="mb-5 grid gap-5 p-5 sm:grid-cols-2">
          {plan.summary ? (
            <div>
              <SectionTitle>Overview</SectionTitle>
              <Prose>{plan.summary}</Prose>
            </div>
          ) : null}
          {plan.management ? (
            <div>
              <SectionTitle>Management</SectionTitle>
              <Prose>{plan.management}</Prose>
            </div>
          ) : null}
        </Card>
      ) : null}

      <SectionTitle action={<Button size="sm" variant="secondary" onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden />Add goal</Button>}>Goals, in priority order</SectionTitle>
      {goals.length ? (
        <ol className="mb-8 flex flex-col gap-4">
          {goals.map((g, i) => {
            const gObs = obs.filter((o) => o.goalId === g.id);
            return (
              <li key={g.id}>
                <Card className="overflow-hidden">
                  <div className="flex items-start gap-3 border-b border-line/70 p-4 sm:p-5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-olive font-serif text-cream">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif text-xl leading-snug font-medium">{g.title}</h3>
                      {g.why ? <p className="mt-0.5 text-sm text-fg-muted">{g.why}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <select
                        aria-label={`Status of ${g.title}`}
                        value={g.status}
                        onChange={async (e) => {
                          await updateRecord<Goal>('goals', g.id, { status: e.target.value as GoalStatus });
                          toast('Goal status updated');
                        }}
                        className="h-8 rounded-full border border-line bg-white px-2 text-xs font-semibold"
                      >
                        {Object.entries(GOAL_STATUS).map(([v, s]) => (
                          <option key={v} value={v}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex">
                        <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => void move(g, -1)} className="rounded-full p-1.5 text-fg-muted hover:bg-mist disabled:opacity-30">
                          <ArrowUp className="size-4" aria-hidden />
                        </button>
                        <button type="button" aria-label="Move down" disabled={i === goals.length - 1} onClick={() => void move(g, 1)} className="rounded-full p-1.5 text-fg-muted hover:bg-mist disabled:opacity-30">
                          <ArrowDown className="size-4" aria-hidden />
                        </button>
                        <button type="button" aria-label={`Edit ${g.title}`} onClick={() => setEditing(g)} className="rounded-full p-1.5 text-fg-muted hover:bg-mist">
                          <Pencil className="size-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-2">
                    <div className="flex flex-col gap-4">
                      {g.successCriteria.length ? (
                        <div>
                          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-[0.08em] text-fg-muted uppercase">
                            <Target className="size-3.5" aria-hidden /> We’ll know it’s working when
                          </p>
                          <ul className="flex flex-col gap-1 text-[0.9375rem]">
                            {g.successCriteria.map((c) => (
                              <li key={c} className="flex gap-2">
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-sage" aria-hidden />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {g.milestones.length ? (
                        <div>
                          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-[0.08em] text-fg-muted uppercase">
                            <Flag className="size-3.5" aria-hidden /> Milestones
                          </p>
                          <ol className="flex flex-col gap-1.5">
                            {g.milestones.map((m, mi) => (
                              <li key={mi}>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const reachedOn = m.reachedOn ? null : todayISO();
                                    const w = batchWriter();
                                    w.update<Goal>('goals', g.id, { milestones: g.milestones.map((x, xi) => (xi === mi ? { ...x, reachedOn } : x)) });
                                    if (reachedOn) w.create<ProgressObservation>('progressObservations', { goalId: g.id, planId: g.planId, dogId: g.dogId, date: reachedOn, observation: `Milestone reached: ${m.label}`, source: 'observed', milestone: m.label, consultationId: null });
                                    await w.commit();
                                    toast(reachedOn ? 'Milestone reached' : 'Milestone unmarked');
                                  }}
                                  className="flex w-full items-start gap-2.5 rounded-xl px-1 py-1 text-start text-[0.9375rem] hover:bg-paper"
                                  aria-pressed={!!m.reachedOn}
                                >
                                  <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2', m.reachedOn ? 'border-moss bg-moss text-paper' : 'border-line-strong')}>{m.reachedOn ? <Check className="size-3" aria-hidden /> : null}</span>
                                  <span className={cn(m.reachedOn && 'text-fg-muted')}>
                                    {m.label}
                                    {m.reachedOn ? <span className="block text-xs">Reached {fmtDate(m.reachedOn)}</span> : null}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : null}
                      {g.exercises.length ? (
                        <div>
                          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-[0.08em] text-fg-muted uppercase">
                            <Dumbbell className="size-3.5" aria-hidden /> Exercises
                          </p>
                          <ul className="flex flex-col gap-2 text-[0.9375rem]">
                            {g.exercises.map((x) => (
                              <li key={x.name}>
                                <span className="font-semibold">{x.name}</span>
                                {x.instructions ? <span className="block whitespace-pre-line text-sm text-fg-muted">{x.instructions}</span> : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {g.homework ? (
                        <div>
                          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-[0.08em] text-fg-muted uppercase">
                            <House className="size-3.5" aria-hidden /> Homework
                          </p>
                          <Prose>{g.homework}</Prose>
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-2xl bg-paper p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-bold tracking-[0.08em] text-fg-muted uppercase">Progress notes</p>
                        <Button size="sm" variant="ghost" onClick={() => setObserving(g)}>
                          <Plus className="size-4" aria-hidden />
                          Add
                        </Button>
                      </div>
                      {gObs.length ? (
                        <ol className="flex flex-col gap-3">
                          {gObs.slice(0, 6).map((o) => (
                            <li key={o.id} className="text-sm">
                              <p className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
                                {o.milestone ? <Flag className="size-3 text-moss" aria-hidden /> : <Eye className="size-3" aria-hidden />}
                                {fmtDate(o.date)} · {o.source === 'observed' ? 'observed' : 'reported'}
                                {o.consultationId ? (
                                  <Link to={`/sessions/${o.consultationId}`} className="text-moss hover:underline">
                                    · session
                                  </Link>
                                ) : null}
                              </p>
                              <p className="mt-0.5 text-olive">{o.observation}</p>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-sm text-fg-muted">No observations yet. Progress is recorded as dated notes, not percentages.</p>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState title="No goals yet" action={<Button onClick={() => setEditing('new')}>Add the first goal</Button>}>
          Goals hold observable success criteria, exercises, milestones and homework.
        </EmptyState>
      )}

      {sessions.length ? (
        <>
          <SectionTitle>Linked sessions</SectionTitle>
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-card">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link to={`/sessions/${s.id}`} className="flex justify-between px-4 py-3 hover:bg-paper">
                  <span className="font-semibold">{fmtDate(s.date)}</span>
                  <span className="text-sm text-fg-muted">{s.goalIds.length} goals worked</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <GoalDialog plan={plan} goal={editing === 'new' ? null : editing} open={editing !== null} nextPriority={(goals.at(-1)?.priority ?? 0) + 1} onClose={() => setEditing(null)} />
      <ObservationDialog goal={observing} onClose={() => setObserving(null)} />
    </div>
  );
}

const goalSchema = z.object({
  title: z.string().trim().min(1, 'Describe the goal.').max(300),
  why: z.string().max(2000).optional(),
  status: z.enum(['notStarted', 'inProgress', 'maintaining', 'achieved', 'paused', 'revised']),
  successCriteria: z.array(z.object({ text: z.string().max(500) })),
  milestones: z.array(z.object({ label: z.string().max(300), reachedOn: z.string().nullable().optional() })),
  exercises: z.array(z.object({ name: z.string().max(200), instructions: z.string().max(5000) })),
  homework: z.string().max(5000).optional(),
});

function GoalDialog({ plan, goal, open, nextPriority, onClose }: { plan: TrainingPlan; goal: Goal | null; open: boolean; nextPriority: number; onClose: () => void }) {
  const form = useForm<z.input<typeof goalSchema>>({ resolver: zodResolver(goalSchema) });
  const criteria = useFieldArray({ control: form.control, name: 'successCriteria' });
  const milestones = useFieldArray({ control: form.control, name: 'milestones' });
  const exercises = useFieldArray({ control: form.control, name: 'exercises' });

  useEffect(() => {
    if (!open) return;
    form.reset(
      goal
        ? {
            ...goal,
            // Always offer one empty row so adding the first item needs no extra click.
            successCriteria: [...goal.successCriteria.map((text) => ({ text })), ...(goal.successCriteria.length ? [] : [{ text: '' }])],
            milestones: [...goal.milestones.map((m) => ({ label: m.label, reachedOn: m.reachedOn ?? null })), ...(goal.milestones.length ? [] : [{ label: '' }])],
            exercises: goal.exercises.length ? goal.exercises : [{ name: '', instructions: '' }],
          }
        : { title: '', status: 'notStarted', successCriteria: [{ text: '' }], milestones: [{ label: '' }], exercises: [{ name: '', instructions: '' }] },
    );
  }, [open, goal, form]);

  const save = form.handleSubmit(async (v) => {
    const record = {
      title: v.title,
      why: v.why || undefined,
      status: v.status,
      successCriteria: v.successCriteria.map((c) => c.text.trim()).filter(Boolean),
      milestones: v.milestones.filter((m) => m.label.trim()).map((m) => ({ label: m.label.trim(), reachedOn: m.reachedOn ?? null })),
      exercises: v.exercises.filter((x) => x.name.trim()),
      homework: v.homework || undefined,
    };
    try {
      if (goal) await updateRecord<Goal>('goals', goal.id, record);
      else await createRecord<Goal>('goals', { ...record, planId: plan.id, dogId: plan.dogId, priority: nextPriority });
      toast(goal ? 'Goal updated' : 'Goal added');
      onClose();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  });

  const rowInput = cn(controlClass, 'py-2');
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={goal ? 'Edit goal' : 'New goal'}
      size="lg"
      dismissible={false}
      className="bg-paper"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} busy={form.formState.isSubmitting}>
            Save goal
          </Button>
        </>
      }
    >
      <form onSubmit={save} noValidate className="flex flex-col gap-5">
        <TextInput label="Goal" required data-autofocus placeholder="e.g. Walk past dogs across the street calmly" error={form.formState.errors.title?.message} {...form.register('title')} />
        <TextInput label="Why it matters" {...form.register('why')} />
        <SelectInput label="Status" options={Object.entries(GOAL_STATUS).map(([value, s]) => ({ value, label: s.label }))} {...form.register('status')} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Observable success criteria</legend>
          <p className="-mt-1 text-xs text-fg-muted">What will you see when this is working?</p>
          {criteria.fields.map((f, i) => (
            <div key={f.id} className="flex gap-2">
              <input aria-label={`Criterion ${i + 1}`} className={rowInput} {...form.register(`successCriteria.${i}.text`)} />
              <Button variant="ghost" size="sm" aria-label="Remove criterion" onClick={() => criteria.remove(i)}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button variant="quiet" size="sm" className="w-fit" onClick={() => criteria.append({ text: '' })}>
            + Add criterion
          </Button>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Milestones</legend>
          <p className="-mt-1 text-xs text-fg-muted">Small, ordered steps. Check them off as they happen.</p>
          {milestones.fields.map((f, i) => (
            <div key={f.id} className="flex gap-2">
              <input aria-label={`Milestone ${i + 1}`} className={rowInput} {...form.register(`milestones.${i}.label`)} />
              <Button variant="ghost" size="sm" aria-label="Remove milestone" onClick={() => milestones.remove(i)}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button variant="quiet" size="sm" className="w-fit" onClick={() => milestones.append({ label: '' })}>
            + Add milestone
          </Button>
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">Exercises</legend>
          {exercises.fields.map((f, i) => (
            <div key={f.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
              <div className="flex gap-2">
                <input aria-label={`Exercise ${i + 1} name`} placeholder="Name" className={rowInput} {...form.register(`exercises.${i}.name`)} />
                <Button variant="ghost" size="sm" aria-label="Remove exercise" onClick={() => exercises.remove(i)}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
              <textarea aria-label={`Exercise ${i + 1} instructions`} placeholder="Step-by-step instructions" rows={3} className={cn(controlClass, 'resize-y')} {...form.register(`exercises.${i}.instructions`)} />
            </div>
          ))}
          <Button variant="quiet" size="sm" className="w-fit" onClick={() => exercises.append({ name: '', instructions: '' })}>
            + Add exercise
          </Button>
        </fieldset>
        <TextArea label="Homework" rows={3} {...form.register('homework')} />
      </form>
    </Dialog>
  );
}

function ObservationDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayISO());
  const [source, setSource] = useState<'observed' | 'reported'>('observed');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (goal) {
      setText('');
      setDate(todayISO());
    }
  }, [goal]);
  const save = async () => {
    if (!goal || !text.trim()) return;
    setBusy(true);
    try {
      const w = batchWriter();
      w.create<ProgressObservation>('progressObservations', { goalId: goal.id, planId: goal.planId, dogId: goal.dogId, date, observation: text.trim(), source, consultationId: null, milestone: null });
      if (goal.status === 'notStarted') w.update<Goal>('goals', goal.id, { status: 'inProgress' });
      await w.commit();
      toast('Progress noted');
      onClose();
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!goal}
      onOpenChange={(o) => !o && onClose()}
      title="Progress note"
      description={goal?.title}
      className="bg-paper"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} busy={busy} disabled={!text.trim()}>
            Save note
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextArea label="What happened?" data-autofocus hint="Specific and observable: where, distance, what the dog did, how quickly they recovered." rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <SelectInput label="Source" value={source} onChange={(e) => setSource(e.target.value as 'observed' | 'reported')} options={[{ value: 'observed', label: 'Observed by me' }, { value: 'reported', label: 'Reported by client' }]} />
        </div>
      </div>
    </Dialog>
  );
}
