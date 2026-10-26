import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { cn } from '@mwilliams/ui';
import { Check, ChevronLeft, ChevronRight, CircleDashed, Cloud, CloudOff, FileOutput, History, Lock, Pencil, Puzzle, Loader2 } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { batchWriter, friendlyError, getRecord, newId, useQuery, useRecord } from '../lib/db';
import { usePractice, currentLinksForDog } from '../stores/practice';
import { activeSections, formatAnswer, hasValue, isVisible, missingRequired, sectionProgress, suggestedModules, visibleResponses, type Responses } from '../assessment/logic';
import { QuestionField } from '../assessment/QuestionField';
import { Button, ButtonLink, Card, ErrorNote, Loading, NotFound, PageHeader, PrivateLabel, Tag } from '../components/ui';
import { AutoGrow, Checkbox, controlClass } from '../components/form';
import { DogAvatar } from '../components/DogAvatar';
import { fmtDate, todayISO } from '../lib/dates';
import { toast } from '../stores/toast';
import type { Assessment, AssessmentRevision, AssessmentTemplate, AssessmentTemplateVersion, Dog, QuestionResponse, TemplateSection } from '../lib/types';

const localKey = (id: string) => `gd-assessment-${id}`;

/** /assessments/new?dog=…&mode=initial|followUp → creates a draft and opens it. */
export function NewAssessmentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { dogs, links } = usePractice();
  const dog = dogs.find((d) => d.id === params.get('dog'));
  const mode = params.get('mode') === 'followUp' ? 'followUp' : 'initial';
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!dog || started.current) return;
    started.current = true;
    (async () => {
      try {
        const templates = await getDocs(query(collection(db, 'assessmentTemplates'), where('archived', '==', false)));
        const template = templates.docs[0];
        if (!template) throw new Error('No assessment template is set up yet. Open Settings → Assessment template.');
        const t = { id: template.id, ...template.data() } as AssessmentTemplate;
        const version = await getRecord<AssessmentTemplateVersion>('assessmentTemplateVersions', t.currentVersionId);
        if (!version) throw new Error('The template has no published version.');
        const previous = (await getDocs(query(collection(db, 'assessments'), where('dogId', '==', dog.id))))
          .docs.map((d) => ({ id: d.id, ...d.data() }) as Assessment)
          .filter((a) => a.status === 'complete')
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const fromConcerns = version.modules.filter((m) => m.suggestedFor?.some((c) => dog.concerns.includes(c))).map((m) => m.id);
        const id = newId('assessments');
        const w = batchWriter();
        w.create<Assessment>(
          'assessments',
          {
            dogId: dog.id,
            clientIds: currentLinksForDog(links, dog.id).map((l) => l.clientId),
            templateId: t.id,
            templateVersionId: version.id,
            templateVersion: version.version,
            mode,
            status: 'draft',
            date: todayISO(),
            enabledModules: previous?.enabledModules ?? fromConcerns,
            responses: {},
            privateNotes: '',
            previousAssessmentId: mode === 'followUp' ? previous?.id ?? null : null,
            revision: 1,
            completedAt: null,
          },
          id,
        );
        await w.commit();
        navigate(`/assessments/${id}`, { replace: true });
      } catch (e) {
        setError(e instanceof Error && !('code' in e) ? e.message : friendlyError(e));
      }
    })();
  }, [dog, links, mode, navigate]);

  if (!dog) return <NotFound what="Dog" back={{ to: '/dogs', label: 'Dogs' }} />;
  return error ? <ErrorNote>{error}</ErrorNote> : <Loading label="Preparing assessment" />;
}

export function AssessmentPage() {
  const { id } = useParams();
  const { data: assessment, loading, error } = useRecord<Assessment>('assessments', id);
  const [version, setVersion] = useState<AssessmentTemplateVersion | null>(null);
  const dogs = usePractice((s) => s.dogs);

  useEffect(() => {
    if (assessment?.templateVersionId && version?.id !== assessment.templateVersionId) {
      void getRecord<AssessmentTemplateVersion>('assessmentTemplateVersions', assessment.templateVersionId).then(setVersion);
    }
  }, [assessment?.templateVersionId, version?.id]);

  if (loading) return <Loading label="Opening assessment" />;
  if (error) return <ErrorNote>{friendlyError(error)}</ErrorNote>;
  if (!assessment) return <NotFound what="Assessment" back={{ to: '/dogs', label: 'Dogs' }} />;
  const dog = dogs.find((d) => d.id === assessment.dogId);
  if (!dog || !version) return <Loading label="Opening assessment" />;

  return assessment.status === 'draft' ? <Runner key={assessment.id} assessment={assessment} template={version} dog={dog} /> : <Review assessment={assessment} template={version} dog={dog} />;
}

type SaveState = 'saved' | 'saving' | 'pending' | 'offline' | 'error';

function useAutosave(assessment: Assessment) {
  // Local state is the source of truth while editing. It is mirrored to
  // localStorage immediately (survives refresh/crash) and to Firestore after a
  // short pause (Firestore's offline cache queues it when there's no signal).
  const restored = useMemo(() => {
    try {
      const raw = localStorage.getItem(localKey(assessment.id));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { savedAt: number; responses: Responses; enabledModules: string[]; privateNotes: string; uid: string };
      const serverAt = assessment.updatedAt?.toMillis() ?? 0;
      return parsed.uid === auth.currentUser?.uid && parsed.savedAt > serverAt ? parsed : null;
    } catch {
      return null;
    }
  }, [assessment.id, assessment.updatedAt]);

  const [responses, setResponses] = useState<Responses>(restored?.responses ?? assessment.responses ?? {});
  const [enabledModules, setEnabledModules] = useState<string[]>(restored?.enabledModules ?? assessment.enabledModules);
  const [privateNotes, setPrivateNotes] = useState<string>(restored?.privateNotes ?? assessment.privateNotes ?? '');
  const [date, setDate] = useState(assessment.date);
  const [state, setState] = useState<SaveState>(restored ? 'pending' : 'saved');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dirty = useRef(!!restored);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef({ responses, enabledModules, privateNotes, date });
  latest.current = { responses, enabledModules, privateNotes, date };

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    setState(navigator.onLine ? 'saving' : 'offline');
    const w = batchWriter();
    w.update<Assessment>('assessments', assessment.id, { ...latest.current });
    try {
      await w.commit();
      if (!dirty.current) {
        localStorage.removeItem(localKey(assessment.id));
        setState('saved');
        setSavedAt(new Date());
      }
    } catch (e) {
      dirty.current = true;
      setState('error');
      toast(friendlyError(e), 'error');
    }
  }, [assessment.id]);

  const touch = useCallback(() => {
    dirty.current = true;
    setState('pending');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 900);
  }, [flush]);

  useEffect(() => {
    if (!dirty.current) return;
    localStorage.setItem(localKey(assessment.id), JSON.stringify({ savedAt: Date.now(), uid: auth.currentUser?.uid, responses, enabledModules, privateNotes }));
  }, [assessment.id, responses, enabledModules, privateNotes]);

  useEffect(() => {
    if (restored) {
      toast('Restored changes that hadn’t synced yet', 'info');
      touch();
    }
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setResponse = useCallback(
    (qid: string, r: QuestionResponse | undefined) => {
      setResponses((prev) => {
        const next = { ...prev };
        if (r) next[qid] = r;
        else delete next[qid];
        return next;
      });
      touch();
    },
    [touch],
  );

  return {
    responses,
    setResponses: (r: Responses) => {
      setResponses(r);
      touch();
    },
    setResponse,
    enabledModules,
    setEnabledModules: (m: string[]) => {
      setEnabledModules(m);
      touch();
    },
    privateNotes,
    setPrivateNotes: (n: string) => {
      setPrivateNotes(n);
      touch();
    },
    date,
    setDate: (d: string) => {
      setDate(d);
      touch();
    },
    state,
    savedAt,
    flush,
  };
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map = {
    saved: { icon: <Cloud className="size-4" />, text: 'All changes saved', cls: 'text-moss' },
    pending: { icon: <CircleDashed className="size-4" />, text: 'Editing…', cls: 'text-fg-muted' },
    saving: { icon: <Loader2 className="size-4 animate-spin" />, text: 'Saving…', cls: 'text-fg-muted' },
    offline: { icon: <CloudOff className="size-4" />, text: 'Offline — saved on this device', cls: 'text-honey' },
    error: { icon: <CloudOff className="size-4" />, text: 'Not saved — retrying on next change', cls: 'text-clay' },
  }[state];
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', map.cls)} data-save-state={state}>
      <span aria-hidden>{map.icon}</span>
      {map.text}
    </span>
  );
}

function Runner({ assessment, template, dog }: { assessment: Assessment; template: AssessmentTemplateVersion; dog: Dog }) {
  const navigate = useNavigate();
  const s = useAutosave(assessment);
  const sections = activeSections(template, s.enabledModules);
  const steps = [...sections.map((x) => x.id), 'modules', 'finish'];
  const [params, setParams] = useSearchParams();
  const step = steps.includes(params.get('section') ?? '') ? params.get('section')! : sections[0].id;
  const idx = steps.indexOf(step);
  const goto = (id: string) => {
    setParams((p) => (p.set('section', id), p), { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const previous = useRecord<Assessment>('assessments', assessment.previousAssessmentId ?? null).data;
  const missing = missingRequired(template, s.enabledModules, s.responses, assessment.mode);
  const suggestions = suggestedModules(template, s.responses).filter((m) => !s.enabledModules.includes(m));
  const current = sections.find((x) => x.id === step);

  return (
    <div className="pb-8">
      <div className="sticky top-16 z-10 -mx-4 mb-5 border-b border-line bg-paper/95 px-4 pt-3 pb-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Link to={`/dogs/${dog.id}?tab=assessments`} aria-label={`Back to ${dog.name}`} className="rounded-full p-1.5 hover:bg-mist">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <DogAvatar dog={dog} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg leading-tight font-medium">
              {dog.name} · {assessment.mode === 'initial' ? 'Initial assessment' : 'Follow-up assessment'}
            </p>
            <SaveIndicator state={s.state} />
          </div>
        </div>
        <nav aria-label="Assessment sections" className="relative -mx-4 mt-2 overflow-x-auto px-4 [scrollbar-width:none]">
          <ol className="flex w-max gap-1.5 pb-1">
            {sections.map((sec) => {
              const p = sectionProgress(sec, s.responses, assessment.mode);
              const isMod = sec.id.startsWith('mod_');
              return (
                <li key={sec.id}>
                  <button
                    type="button"
                    onClick={() => goto(sec.id)}
                    aria-current={step === sec.id ? 'step' : undefined}
                    className={cn(
                      'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-semibold whitespace-nowrap transition-colors',
                      step === sec.id ? 'border-olive bg-olive text-cream' : 'border-line bg-card text-olive hover:border-line-strong',
                    )}
                  >
                    {p.complete ? (
                      <Check className={cn('size-3.5', step === sec.id ? 'text-cream' : 'text-moss')} aria-hidden />
                    ) : p.requiredMissing.length && p.started ? (
                      <span className="size-1.5 rounded-full bg-honey" aria-hidden />
                    ) : isMod ? (
                      <Puzzle className="size-3.5 opacity-60" aria-hidden />
                    ) : null}
                    {sec.title}
                    <span className="sr-only">{p.complete ? ', complete' : p.requiredMissing.length && p.started ? ', required answers missing' : ''}</span>
                    <span className={cn('text-[0.6875rem] font-medium', step === sec.id ? 'text-cream/70' : 'text-fg-muted')}>
                      {p.resolved}/{p.visible}
                    </span>
                  </button>
                </li>
              );
            })}
            <li>
              <button type="button" onClick={() => goto('modules')} aria-current={step === 'modules' ? 'step' : undefined} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-semibold whitespace-nowrap', step === 'modules' ? 'border-olive bg-olive text-cream' : 'border-dashed border-line-strong/60 text-olive hover:border-line-strong')}>
                <Puzzle className="size-3.5" aria-hidden />
                Modules{suggestions.length ? <span className="rounded-full bg-honey px-1.5 text-[0.625rem] text-white">{suggestions.length}</span> : null}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => goto('finish')} aria-current={step === 'finish' ? 'step' : undefined} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-semibold whitespace-nowrap', step === 'finish' ? 'border-olive bg-olive text-cream' : 'border-line bg-card text-olive')}>
                Review & complete
              </button>
            </li>
          </ol>
        </nav>
      </div>

      {current ? (
        <SectionView
          key={current.id}
          section={current}
          responses={s.responses}
          previous={previous?.responses}
          mode={assessment.mode}
          onChange={s.setResponse}
          onCarryForward={() => {
            if (!previous) return;
            const next = { ...s.responses };
            for (const q of current.questions) {
              if (!hasValue(next[q.id]) && hasValue(previous.responses[q.id]) && isVisible(q, { ...previous.responses, ...next }, assessment.mode)) next[q.id] = { ...previous.responses[q.id], note: undefined };
            }
            s.setResponses(next);
            toast('Copied answers from the last assessment where blank');
          }}
        />
      ) : step === 'modules' ? (
        <ModulesStep template={template} enabled={s.enabledModules} suggestions={suggestions} onChange={s.setEnabledModules} />
      ) : (
        <FinishStep assessment={assessment} dog={dog} template={template} s={s} missing={missing} goto={goto} onDone={() => navigate(`/assessments/${assessment.id}`, { replace: true })} />
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="secondary" disabled={idx <= 0} onClick={() => goto(steps[idx - 1])}>
          <ChevronLeft className="size-4" aria-hidden />
          Back
        </Button>
        {idx < steps.length - 1 ? (
          <Button onClick={() => goto(steps[idx + 1])}>
            Next: {steps[idx + 1] === 'modules' ? 'Modules' : steps[idx + 1] === 'finish' ? 'Review' : sections.find((x) => x.id === steps[idx + 1])?.title}
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SectionView({
  section,
  responses,
  previous,
  mode,
  onChange,
  onCarryForward,
}: {
  section: TemplateSection;
  responses: Responses;
  previous?: Responses;
  mode: Assessment['mode'];
  onChange: (id: string, r: QuestionResponse | undefined) => void;
  onCarryForward: () => void;
}) {
  const visible = section.questions.filter((q) => isVisible(q, responses, mode));
  const canCarry = previous && visible.some((q) => !hasValue(responses[q.id]) && hasValue(previous[q.id]));
  return (
    <section aria-labelledby="section-title" className="settle">
      <header className="mb-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-moss-soft uppercase">{section.id.startsWith('mod_') ? 'Module' : 'Section'}</p>
        <h1 id="section-title" className="font-serif text-[1.875rem] leading-tight font-medium">
          {section.title}
        </h1>
        {section.description ? <p className="mt-1 text-[0.9375rem] text-fg-muted">{section.description}</p> : null}
        {section.id.startsWith('mod_') ? <p className="mt-1 text-sm text-fg-muted">Structured prompts for gathering information. Not a diagnosis.</p> : null}
        {canCarry ? (
          <Button variant="secondary" size="sm" className="mt-3" onClick={onCarryForward}>
            <History className="size-4" aria-hidden />
            Fill blanks from last assessment
          </Button>
        ) : null}
      </header>
      <div className="flex flex-col gap-3">
        {visible.map((q) => (
          <QuestionField key={q.id} question={q} response={responses[q.id]} previous={previous?.[q.id]} onChange={onChange} />
        ))}
      </div>
    </section>
  );
}

function ModulesStep({ template, enabled, suggestions, onChange }: { template: AssessmentTemplateVersion; enabled: string[]; suggestions: string[]; onChange: (m: string[]) => void }) {
  return (
    <section aria-labelledby="modules-title" className="settle">
      <h1 id="modules-title" className="font-serif text-[1.875rem] font-medium">
        Focus modules
      </h1>
      <p className="mt-1 mb-5 text-[0.9375rem] text-fg-muted">Turn on deeper question sets for this dog. Suggestions come from the concerns you selected; you decide what applies.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {template.modules.map((m) => {
          const on = enabled.includes(m.id);
          return (
            <li key={m.id}>
              <label className={cn('flex h-full cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors', on ? 'border-moss bg-[#eef2e8]' : 'border-line bg-card hover:border-line-strong')}>
                <input type="checkbox" checked={on} onChange={() => onChange(on ? enabled.filter((x) => x !== m.id) : [...enabled, m.id])} className="mt-1 size-5 accent-moss" />
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    {m.title}
                    {suggestions.includes(m.id) ? <Tag tone="honey">Suggested</Tag> : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-fg-muted">{m.questions.length} questions</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FinishStep({
  assessment,
  dog,
  template,
  s,
  missing,
  goto,
  onDone,
}: {
  assessment: Assessment;
  dog: Dog;
  template: AssessmentTemplateVersion;
  s: ReturnType<typeof useAutosave>;
  missing: ReturnType<typeof missingRequired>;
  goto: (id: string) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const concerns = (s.responses['co_main_concerns']?.value as string[] | undefined) ?? [];
  const newConcerns = concerns.filter((c) => c !== 'Other' && !dog.concerns.includes(c));
  const [syncConcerns, setSyncConcerns] = useState(true);

  const complete = async () => {
    setBusy(true);
    try {
      await s.flush();
      const responses = visibleResponses(template, s.enabledModules, s.responses, assessment.mode);
      const w = batchWriter();
      w.update<Assessment>('assessments', assessment.id, { status: 'complete', completedAt: new Date().toISOString(), responses, enabledModules: s.enabledModules, privateNotes: s.privateNotes, date: s.date });
      w.createAt(`assessments/${assessment.id}/revisions/r${assessment.revision}`, {
        assessmentId: assessment.id,
        revision: assessment.revision,
        reason: 'Completed',
        status: 'complete',
        enabledModules: s.enabledModules,
        responses,
        privateNotes: s.privateNotes,
      });
      if (syncConcerns && newConcerns.length) w.update<Dog>('dogs', dog.id, { concerns: [...dog.concerns, ...newConcerns] });
      await w.commit();
      localStorage.removeItem(localKey(assessment.id));
      toast('Assessment completed');
      onDone();
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="finish-title" className="settle flex flex-col gap-5">
      <div>
        <h1 id="finish-title" className="font-serif text-[1.875rem] font-medium">
          Review & complete
        </h1>
        <p className="mt-1 text-[0.9375rem] text-fg-muted">Completing saves a dated version. You can reopen it later; earlier versions are kept.</p>
      </div>
      <Card className="p-5">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Assessment date
          <input type="date" value={s.date} onChange={(e) => s.setDate(e.target.value)} className={cn(controlClass, 'max-w-52')} />
        </label>
      </Card>
      {missing.length ? (
        <Card className="border-honey/40 bg-honey-soft/40 p-5">
          <p className="font-semibold">{missing.length} required {missing.length === 1 ? 'question needs' : 'questions need'} an answer, or “Not assessed”</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {missing.map(({ section, question }) => (
              <li key={question.id}>
                <button
                  type="button"
                  className="text-start text-sm font-semibold text-moss hover:underline"
                  onClick={() => {
                    goto(section.id);
                    setTimeout(() => document.getElementById(`q-${question.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
                  }}
                >
                  {section.title} → {question.label}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="border-moss/30 bg-[#eef2e8] p-5">
          <p className="flex items-center gap-2 font-semibold text-moss">
            <Check className="size-5" aria-hidden /> Every required question is answered.
          </p>
        </Card>
      )}
      <Card className="p-5">
        <label htmlFor="private-notes" className="mb-2 flex items-center gap-2 font-semibold">
          Consultant notes <PrivateLabel />
        </label>
        <p className="mb-2 text-sm text-fg-muted">Your private impressions. Never included in client reports.</p>
        <AutoGrow id="private-notes" rows={4} value={s.privateNotes} onChange={(e) => s.setPrivateNotes(e.target.value)} className={cn(controlClass, 'resize-none leading-relaxed')} />
      </Card>
      {newConcerns.length ? (
        <Checkbox checked={syncConcerns} onChange={(e) => setSyncConcerns(e.target.checked)} label={`Add ${newConcerns.join(', ')} to ${dog.name}’s concern tags`} />
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" busy={busy} disabled={missing.length > 0} onClick={complete}>
          <Check className="size-5" aria-hidden />
          Complete assessment
        </Button>
        <Button size="lg" variant="secondary" onClick={() => void s.flush().then(() => toast('Draft saved'))}>
          Save draft & finish later
        </Button>
      </div>
    </section>
  );
}

function Review({ assessment, template, dog }: { assessment: Assessment; template: AssessmentTemplateVersion; dog: Dog }) {
  const navigate = useNavigate();
  const [showPrivate, setShowPrivate] = useState(true);
  const [revisionId, setRevisionId] = useState<string>('current');
  const revisions = useQuery<AssessmentRevision>(collection(db, 'assessments', assessment.id, 'revisions'), `revs-${assessment.id}`);
  const revs = [...revisions.data].sort((a, b) => b.revision - a.revision);
  const viewing = revisionId === 'current' ? assessment : revs.find((r) => r.id === revisionId) ?? assessment;
  const sections = activeSections(template, viewing.enabledModules);
  const [busy, setBusy] = useState(false);

  const reopen = async () => {
    setBusy(true);
    try {
      const w = batchWriter();
      // Snapshot what is being changed, then reopen as the next revision.
      w.createAt(`assessments/${assessment.id}/revisions/r${assessment.revision}-reopened-${Date.now()}`, {
        assessmentId: assessment.id,
        revision: assessment.revision,
        reason: 'Reopened for edits',
        status: 'complete',
        enabledModules: assessment.enabledModules,
        responses: assessment.responses,
        privateNotes: assessment.privateNotes ?? '',
      });
      w.update<Assessment>('assessments', assessment.id, { status: 'draft', revision: assessment.revision + 1 });
      await w.commit();
      toast('Reopened — the completed version is kept in history');
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const createReport = async () => {
    const id = newId('reportDrafts');
    navigate(`/reports/new?kind=assessment&source=${assessment.id}&id=${id}`);
  };

  return (
    <div>
      <PageHeader
        title={assessment.mode === 'initial' ? 'Initial assessment' : 'Follow-up assessment'}
        eyebrow={`${dog.name} · ${fmtDate(assessment.date)} · template v${assessment.templateVersion}`}
        back={{ to: `/dogs/${dog.id}?tab=assessments`, label: dog.name }}
        actions={
          <>
            <Button variant="secondary" size="sm" busy={busy} onClick={reopen}>
              <Pencil className="size-4" aria-hidden />
              Edit
            </Button>
            <Button size="sm" onClick={createReport}>
              <FileOutput className="size-4" aria-hidden />
              Client summary
            </Button>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <History className="size-4" aria-hidden />
          Version
          <select value={revisionId} onChange={(e) => setRevisionId(e.target.value)} className="h-9 rounded-control border border-line bg-white px-2 text-sm text-olive">
            <option value="current">Current (revision {assessment.revision})</option>
            {revs.map((r) => (
              <option key={r.id} value={r.id}>
                Revision {r.revision} · {r.reason} · {r.createdAt ? fmtDate(r.createdAt.toDate().toISOString()) : 'saving…'}
              </option>
            ))}
          </select>
        </label>
        <Checkbox checked={showPrivate} onChange={(e) => setShowPrivate(e.target.checked)} label="Show private answers" />
        {revisionId !== 'current' ? <Tag tone="honey">Viewing a historical version (read-only)</Tag> : null}
      </div>

      <div className="flex flex-col gap-4">
        {sections.map((sec) => {
          const qs = sec.questions.filter((q) => viewing.responses[q.id] && (showPrivate || !q.private) && (hasValue(viewing.responses[q.id]) || viewing.responses[q.id].status !== 'answered'));
          if (!qs.length) return null;
          return (
            <Card key={sec.id} as="section" className="p-5">
              <h2 className="mb-3 font-serif text-xl font-medium">{sec.title}</h2>
              <dl className="flex flex-col gap-3.5">
                {qs.map((q) => {
                  const r = viewing.responses[q.id];
                  return (
                    <div key={q.id}>
                      <dt className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg-muted">
                        {q.label}
                        {r.source ? <span className={cn('rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold uppercase', r.source === 'observed' ? 'bg-sky-soft text-sky' : 'bg-cream text-honey')}>{r.source}</span> : null}
                        {q.private ? <Lock className="size-3.5 text-olive" aria-label="private" /> : null}
                      </dt>
                      <dd className={cn('mt-0.5 whitespace-pre-line', r.status !== 'answered' ? 'text-sm text-fg-muted italic' : 'text-olive')}>{formatAnswer(q, r)}</dd>
                      {r.note ? <dd className="mt-1 border-s-2 border-sage ps-2 text-sm text-fg-muted">{r.note}</dd> : null}
                    </div>
                  );
                })}
              </dl>
            </Card>
          );
        })}
        {showPrivate && viewing.privateNotes ? (
          <Card className="p-5">
            <h2 className="mb-2 flex items-center gap-2 font-serif text-xl font-medium">
              Consultant notes <PrivateLabel />
            </h2>
            <p className="whitespace-pre-line text-olive">{viewing.privateNotes}</p>
          </Card>
        ) : null}
      </div>
      <div className="mt-6">
        <ButtonLink variant="secondary" to={`/assessments/new?dog=${dog.id}&mode=followUp`}>
          Start a follow-up assessment
        </ButtonLink>
      </div>
    </div>
  );
}
