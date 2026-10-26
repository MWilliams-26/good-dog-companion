import { useEffect, useMemo, useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { cn } from '@mwilliams/ui';
import { ArrowDown, ArrowUp, ChevronDown, Eye, Plus, Puzzle, Trash2, UploadCloud } from 'lucide-react';
import { db } from '../lib/firebase';
import { batchWriter, friendlyError, useQuery, useRecord } from '../lib/db';
import { Button, Card, ErrorNote, Loading, PageHeader, Tag } from '../components/ui';
import { controlClass } from '../components/form';
import { QuestionField } from '../assessment/QuestionField';
import { isVisible, validate } from '../assessment/logic';
import { CONCERNS } from '../lib/labels';
import { toast } from '../stores/toast';
import type { AssessmentTemplate, AssessmentTemplateVersion, Question, QuestionResponse, QuestionType, TemplateDefinition, TemplateSection } from '../lib/types';

const TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'longText', label: 'Paragraph' },
  { value: 'singleChoice', label: 'Single choice' },
  { value: 'multiChoice', label: 'Multiple choice' },
  { value: 'yesNo', label: 'Yes / No / Unsure' },
  { value: 'list', label: 'List' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'scale', label: '1–5 scale (labelled ends)' },
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24) || 'q';

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 7)}`;

function strip(def: TemplateDefinition): TemplateDefinition {
  return { name: def.name, description: def.description, sections: def.sections, modules: def.modules };
}

export default function TemplateEditorPage() {
  const templates = useQuery<AssessmentTemplate>(query(collection(db, 'assessmentTemplates'), where('archived', '==', false)), 'templates');
  const template = templates.data[0];
  const version = useRecord<AssessmentTemplateVersion>('assessmentTemplateVersions', template?.currentVersionId).data;

  if (templates.loading) return <Loading />;
  if (templates.error) return <ErrorNote>{friendlyError(templates.error)}</ErrorNote>;
  if (!template) return <ErrorNote>No template found. Run the seed script to create the Master Behavioral Assessment.</ErrorNote>;
  return <Editor key={template.id} template={template} published={version} />;
}

function Editor({ template, published }: { template: AssessmentTemplate; published: AssessmentTemplateVersion | null }) {
  const [def, setDef] = useState<TemplateDefinition>(() => strip(template));
  const [selected, setSelected] = useState<string>(template.sections[0]?.id ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [changeNote, setChangeNote] = useState('');

  const savedJSON = JSON.stringify(strip(template));
  const dirty = JSON.stringify(def) !== savedJSON;
  const unpublished = published ? JSON.stringify(strip(published)) !== JSON.stringify(def) : true;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const isModule = def.modules.some((m) => m.id === selected);
  const list = isModule ? 'modules' : 'sections';
  const section = def[list].find((s) => s.id === selected);
  const allQuestions = useMemo(() => [...def.sections, ...def.modules].flatMap((s) => s.questions.map((q) => ({ ...q, sectionTitle: s.title }))), [def]);

  const updateSection = (p: Partial<TemplateSection>) => setDef((d) => ({ ...d, [list]: d[list].map((s) => (s.id === selected ? { ...s, ...p } : s)) }));
  const updateQuestion = (qid: string, p: Partial<Question>) => updateSection({ questions: section!.questions.map((q) => (q.id === qid ? { ...q, ...p } : q)) });
  const moveQuestion = (i: number, dir: -1 | 1) => {
    const qs = [...section!.questions];
    [qs[i], qs[i + dir]] = [qs[i + dir], qs[i]];
    updateSection({ questions: qs });
  };
  const moveSection = (kind: 'sections' | 'modules', i: number, dir: -1 | 1) =>
    setDef((d) => {
      const ss = [...d[kind]];
      [ss[i], ss[i + dir]] = [ss[i + dir], ss[i]];
      return { ...d, [kind]: ss };
    });

  const saveDraft = async () => {
    setBusy('save');
    try {
      const w = batchWriter();
      w.update<AssessmentTemplate>('assessmentTemplates', template.id, def);
      await w.commit();
      toast('Template draft saved');
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    const problems = validate(def);
    if (problems.length) {
      toast(problems[0], 'error');
      return;
    }
    if (!confirm(`Publish version ${template.currentVersion + 1}? New assessments will use it. Existing assessments keep the version they were started with.`)) return;
    setBusy('publish');
    try {
      const next = template.currentVersion + 1;
      const versionId = `${template.id}_v${next}`;
      const w = batchWriter();
      w.createAt(`assessmentTemplateVersions/${versionId}`, { ...def, templateId: template.id, version: next, changeNote: changeNote || undefined });
      w.update<AssessmentTemplate>('assessmentTemplates', template.id, { ...def, currentVersion: next, currentVersionId: versionId });
      await w.commit();
      setChangeNote('');
      toast(`Version ${next} published`);
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Assessment template"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            Published v{template.currentVersion}
            {dirty ? <Tag tone="honey">Unsaved edits</Tag> : unpublished ? <Tag tone="sky">Draft not published</Tag> : <Tag tone="moss">Up to date</Tag>}
          </span>
        }
        back={{ to: '/settings', label: 'Settings' }}
        actions={
          <>
            <Button variant="secondary" size="sm" busy={busy === 'save'} disabled={!dirty} onClick={saveDraft}>
              Save draft
            </Button>
            <Button size="sm" busy={busy === 'publish'} disabled={!unpublished && !dirty} onClick={publish}>
              <UploadCloud className="size-4" aria-hidden />
              Publish v{template.currentVersion + 1}
            </Button>
          </>
        }
      >
        <input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} aria-label="What changed in this version" placeholder="What changed? (optional, saved with the version)" className={cn(controlClass, 'max-w-xl')} />
      </PageHeader>

      <div className="grid gap-5 [&>*]:min-w-0 lg:grid-cols-[17rem_1fr]">
        <nav aria-label="Template sections" className="flex flex-col gap-4">
          {(['sections', 'modules'] as const).map((kind) => (
            <div key={kind}>
              <p className="mb-2 text-xs font-bold tracking-[0.12em] text-moss-soft uppercase">{kind === 'sections' ? 'Core sections' : 'Focus modules'}</p>
              <ul className="flex flex-col gap-1">
                {def[kind].map((s, i) => (
                  <li key={s.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(s.id);
                        setPreview(false);
                      }}
                      aria-current={selected === s.id}
                      className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-start text-sm font-semibold', selected === s.id ? 'bg-olive text-cream' : 'hover:bg-mist')}
                    >
                      {kind === 'modules' ? <Puzzle className="size-3.5 shrink-0 opacity-70" aria-hidden /> : null}
                      <span className="truncate">{s.title}</span>
                      <span className={cn('ms-auto text-xs font-medium', selected === s.id ? 'text-cream/70' : 'text-fg-muted')}>{s.questions.length}</span>
                    </button>
                    <button type="button" aria-label={`Move ${s.title} up`} disabled={i === 0} onClick={() => moveSection(kind, i, -1)} className="rounded p-1 text-fg-muted opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:hidden">
                      <ArrowUp className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                variant="quiet"
                size="sm"
                className="mt-1 ps-3"
                onClick={() => {
                  const s: TemplateSection = { id: uid(kind === 'modules' ? 'mod' : 'sec'), title: kind === 'modules' ? 'New module' : 'New section', questions: [], ...(kind === 'modules' ? { suggestedFor: [] } : {}) };
                  setDef((d) => ({ ...d, [kind]: [...d[kind], s] }));
                  setSelected(s.id);
                }}
              >
                + Add {kind === 'modules' ? 'module' : 'section'}
              </Button>
            </div>
          ))}
        </nav>

        {section ? (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <input aria-label="Section title" value={section.title} onChange={(e) => updateSection({ title: e.target.value })} className="min-w-0 flex-1 rounded-lg bg-transparent px-1 font-serif text-2xl font-medium outline-none focus:bg-white focus:ring-2 focus:ring-moss/20" />
                <Button variant="secondary" size="sm" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
                  <Eye className="size-4" aria-hidden />
                  {preview ? 'Edit' : 'Preview'}
                </Button>
              </div>
              <textarea aria-label="Section description" value={section.description ?? ''} onChange={(e) => updateSection({ description: e.target.value })} placeholder="Description shown at the top of the section" rows={2} className={cn(controlClass, 'resize-y text-sm')} />
              {isModule ? (
                <fieldset>
                  <legend className="mb-1.5 text-sm font-semibold">Suggest this module when the client’s concerns include</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {CONCERNS.map((c) => {
                      const on = section.suggestedFor?.includes(c);
                      return (
                        <label key={c} className={cn('cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold focus-within:ring-2 focus-within:ring-moss/40', on ? 'border-moss bg-moss text-paper' : 'border-line bg-white')}>
                          <input type="checkbox" className="sr-only" checked={!!on} onChange={() => updateSection({ suggestedFor: on ? section.suggestedFor!.filter((x) => x !== c) : [...(section.suggestedFor ?? []), c] })} />
                          {c}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-clay"
                  onClick={() => {
                    if (!confirm(`Remove “${section.title}” from the template? Past assessments are not affected.`)) return;
                    setDef((d) => ({ ...d, [list]: d[list].filter((s) => s.id !== section.id) }));
                    setSelected(def.sections[0]?.id ?? '');
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Remove {isModule ? 'module' : 'section'}
                </Button>
              </div>
            </Card>

            {preview ? (
              <PreviewSection section={section} />
            ) : (
              <>
                {section.questions.map((q, i) => (
                  <QuestionEditor key={q.id} q={q} index={i} count={section.questions.length} all={allQuestions.filter((x) => x.id !== q.id)} onChange={(p) => updateQuestion(q.id, p)} onMove={(dir) => moveQuestion(i, dir)} onRemove={() => updateSection({ questions: section.questions.filter((x) => x.id !== q.id) })} />
                ))}
                <Button
                  variant="secondary"
                  className="w-fit"
                  onClick={() => updateSection({ questions: [...section.questions, { id: `${slug(section.title).slice(0, 6)}_${Math.random().toString(36).slice(2, 7)}`, label: 'New question', type: 'longText', source: 'reported' }] })}
                >
                  <Plus className="size-4" aria-hidden />
                  Add question
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PreviewSection({ section }: { section: TemplateSection }) {
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({});
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">Preview — answers here aren’t saved. Conditional questions appear as you answer.</p>
      {section.questions
        .filter((q) => !q.showIf || section.questions.every((x) => x.id !== q.showIf!.questionId) || isVisible({ ...q, mode: undefined }, responses, 'initial'))
        .map((q) => (
          <QuestionField key={q.id} question={q} response={responses[q.id]} onChange={(id, r) => setResponses((s) => ({ ...s, [id]: r! }))} />
        ))}
    </div>
  );
}

function QuestionEditor({
  q,
  index,
  count,
  all,
  onChange,
  onMove,
  onRemove,
}: {
  q: Question;
  index: number;
  count: number;
  all: (Question & { sectionTitle: string })[];
  onChange: (p: Partial<Question>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasOptions = q.type === 'singleChoice' || q.type === 'multiChoice';
  const target = all.find((x) => x.id === q.showIf?.questionId);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 p-3 ps-4">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-start">
          <ChevronDown className={cn('size-4 shrink-0 text-fg-muted transition-transform', open && 'rotate-180')} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{q.label}</span>
            <span className="flex flex-wrap gap-1.5 pt-0.5 text-xs text-fg-muted">
              {TYPES.find((t) => t.value === q.type)?.label}
              {q.required ? <Tag tone="clay" className="py-0 text-[0.625rem]">Required</Tag> : null}
              {q.private ? <Tag tone="olive" className="py-0 text-[0.625rem]">Private</Tag> : null}
              {q.showIf ? <Tag tone="sky" className="py-0 text-[0.625rem]">Conditional</Tag> : null}
              {q.mode ? <Tag className="py-0 text-[0.625rem]">{q.mode === 'initial' ? 'Initial only' : 'Follow-up only'}</Tag> : null}
            </span>
          </span>
        </button>
        <button type="button" aria-label="Move question up" disabled={index === 0} onClick={() => onMove(-1)} className="rounded-full p-1.5 text-fg-muted hover:bg-mist disabled:opacity-30">
          <ArrowUp className="size-4" aria-hidden />
        </button>
        <button type="button" aria-label="Move question down" disabled={index === count - 1} onClick={() => onMove(1)} className="rounded-full p-1.5 text-fg-muted hover:bg-mist disabled:opacity-30">
          <ArrowDown className="size-4" aria-hidden />
        </button>
      </div>
      {open ? (
        <div className="grid gap-3 border-t border-line bg-paper/60 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
            Question
            <input value={q.label} onChange={(e) => onChange({ label: e.target.value })} className={controlClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
            Help text
            <input value={q.help ?? ''} onChange={(e) => onChange({ help: e.target.value || undefined })} className={controlClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Answer type
            <select value={q.type} onChange={(e) => onChange({ type: e.target.value as QuestionType, options: ['singleChoice', 'multiChoice'].includes(e.target.value) ? q.options ?? ['Option 1', 'Option 2'] : undefined })} className={controlClass}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Information source
            <select value={q.source} onChange={(e) => onChange({ source: e.target.value as Question['source'] })} className={controlClass}>
              <option value="reported">Client reported</option>
              <option value="observed">Directly observed</option>
              <option value="either">Either (choose per answer)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Shown in
            <select value={q.mode ?? ''} onChange={(e) => onChange({ mode: (e.target.value || undefined) as Question['mode'] })} className={controlClass}>
              <option value="">Initial and follow-up</option>
              <option value="initial">Initial assessments only</option>
              <option value="followUp">Follow-up assessments only</option>
            </select>
          </label>
          <div className="flex flex-col justify-end gap-2 pb-1 text-sm">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" className="size-4 accent-moss" checked={!!q.required} onChange={(e) => onChange({ required: e.target.checked || undefined })} />
              Required
            </label>
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" className="size-4 accent-moss" checked={!!q.private} onChange={(e) => onChange({ private: e.target.checked || undefined })} />
              Private (kept out of client reports)
            </label>
          </div>
          {hasOptions ? (
            <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
              Options (one per line)
              <textarea rows={Math.min(10, (q.options?.length ?? 2) + 1)} value={(q.options ?? []).join('\n')} onChange={(e) => onChange({ options: e.target.value.split('\n') })} onBlur={(e) => onChange({ options: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} className={cn(controlClass, 'resize-y')} />
            </label>
          ) : null}
          {q.type === 'scale' ? (
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Label for 1
                <input value={q.scaleLabels?.[0] ?? ''} onChange={(e) => onChange({ scaleLabels: [e.target.value, q.scaleLabels?.[1] ?? ''] })} className={controlClass} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Label for 5
                <input value={q.scaleLabels?.[1] ?? ''} onChange={(e) => onChange({ scaleLabels: [q.scaleLabels?.[0] ?? '', e.target.value] })} className={controlClass} />
              </label>
            </div>
          ) : null}
          <fieldset className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 sm:col-span-2">
            <legend className="px-1 text-sm font-semibold">Show only when…</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              <select aria-label="Depends on question" value={q.showIf?.questionId ?? ''} onChange={(e) => onChange({ showIf: e.target.value ? { questionId: e.target.value, operator: 'equals', value: q.showIf?.value } : undefined })} className={controlClass}>
                <option value="">Always show</option>
                {all.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.sectionTitle}: {x.label.slice(0, 60)}
                  </option>
                ))}
              </select>
              {q.showIf ? (
                <>
                  <select aria-label="Condition" value={q.showIf.operator} onChange={(e) => onChange({ showIf: { ...q.showIf!, operator: e.target.value as NonNullable<Question['showIf']>['operator'] } })} className={controlClass}>
                    <option value="equals">is</option>
                    <option value="notEquals">is not</option>
                    <option value="includes">includes</option>
                    <option value="answered">has any answer</option>
                  </select>
                  {q.showIf.operator !== 'answered' ? (
                    target?.options?.length || target?.type === 'yesNo' ? (
                      <select aria-label="Value" value={q.showIf.value ?? ''} onChange={(e) => onChange({ showIf: { ...q.showIf!, value: e.target.value } })} className={controlClass}>
                        <option value="">Choose…</option>
                        {(target.type === 'yesNo' ? ['yes', 'no', 'unsure'] : target.options!).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input aria-label="Value" value={q.showIf.value ?? ''} onChange={(e) => onChange({ showIf: { ...q.showIf!, value: e.target.value } })} className={controlClass} />
                    )
                  ) : null}
                </>
              ) : null}
            </div>
          </fieldset>
          <div className="flex items-center justify-between sm:col-span-2">
            <span className="text-xs text-fg-muted">ID: {q.id} (stays fixed so past answers keep matching)</span>
            <Button variant="ghost" size="sm" className="text-clay" onClick={() => confirm('Remove this question?') && onRemove()}>
              <Trash2 className="size-4" aria-hidden />
              Remove
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
