import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { cn } from '@mwilliams/ui';
import { ArrowDown, ArrowUp, Copy, Download, Eye, EyeOff, Lock, Plus, Printer, Trash2, CheckCircle2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { createRecord, friendlyError, getRecord, updateRecord, useRecord } from '../lib/db';
import { usePractice } from '../stores/practice';
import { assessmentReport, consultationReport, planReport, renderReportText } from '../lib/reports';
import { Button, ErrorNote, Loading, NotFound, PageHeader, Tag } from '../components/ui';
import { AutoGrow, controlClass } from '../components/form';
import { fmtDate } from '../lib/dates';
import { toast } from '../stores/toast';
import type { Assessment, AssessmentTemplateVersion, Consultation, Goal, ProgressObservation, ReportDraft, ReportSection, TrainingPlan } from '../lib/types';

async function list<T>(name: string, field: string, value: string) {
  const snap = await getDocs(query(collection(db, name), where(field, '==', value)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

/** /reports/new?kind=…&source=…&id=… builds a draft from the source record. */
export function NewReportPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dogs = usePractice((s) => s.dogs);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const kind = params.get('kind') as ReportDraft['kind'];
    const sourceId = params.get('source') ?? '';
    const id = params.get('id') ?? undefined;
    (async () => {
      try {
        let built: { title: string; sections: ReportSection[] };
        let dogId: string;
        if (kind === 'consultation') {
          const c = await getRecord<Consultation>('consultations', sourceId);
          if (!c) throw new Error('Session not found');
          const ds = dogs.filter((d) => c.dogIds.includes(d.id));
          const goals = c.planId ? await list<Goal>('goals', 'planId', c.planId) : [];
          const obs = await list<ProgressObservation>('progressObservations', 'consultationId', c.id);
          built = consultationReport(c, ds, goals, obs);
          dogId = c.dogIds[0];
        } else if (kind === 'trainingPlan') {
          const p = await getRecord<TrainingPlan>('trainingPlans', sourceId);
          if (!p) throw new Error('Plan not found');
          const dog = dogs.find((d) => d.id === p.dogId)!;
          const goals = await list<Goal>('goals', 'planId', p.id);
          const obs = (await list<ProgressObservation>('progressObservations', 'planId', p.id)).sort((a, b) => b.date.localeCompare(a.date));
          built = planReport(p, dog, goals, obs);
          dogId = p.dogId;
        } else {
          const a = await getRecord<Assessment>('assessments', sourceId);
          if (!a) throw new Error('Assessment not found');
          const t = await getRecord<AssessmentTemplateVersion>('assessmentTemplateVersions', a.templateVersionId);
          built = assessmentReport(a, t!, dogs.find((d) => d.id === a.dogId)!);
          dogId = a.dogId;
        }
        const reportId = await createRecord<ReportDraft>('reportDrafts', { kind, sourceId, dogId, title: built.title, sections: built.sections, status: 'draft' }, id);
        navigate(`/reports/${reportId}`, { replace: true });
      } catch (e) {
        setError(e instanceof Error && !('code' in e) ? e.message : friendlyError(e));
      }
    })();
  }, [params, dogs, navigate]);

  return error ? <ErrorNote>{error}</ErrorNote> : <Loading label="Drafting report" />;
}

export default function ReportPage() {
  const { id } = useParams();
  const { data: report, loading } = useRecord<ReportDraft>('reportDrafts', id);
  if (loading) return <Loading />;
  if (!report) return <NotFound what="Report" back={{ to: '/', label: 'Home' }} />;
  return <ReportEditor key={report.id} report={report} />;
}

function ReportEditor({ report }: { report: ReportDraft }) {
  const navigate = useNavigate();
  const dogs = usePractice((s) => s.dogs);
  const dog = dogs.find((d) => d.id === report.dogId);
  const [title, setTitle] = useState(report.title);
  const [recipient, setRecipient] = useState(report.recipient ?? '');
  const [sections, setSections] = useState<ReportSection[]>(report.sections);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  const change = (fn: (s: ReportSection[]) => ReportSection[]) => {
    setSections(fn);
    setDirty(true);
  };
  const patch = (sid: string, p: Partial<ReportSection>) => change((ss) => ss.map((s) => (s.id === sid ? { ...s, ...p } : s)));

  const save = async (extra: Partial<ReportDraft> = {}) => {
    setBusy(true);
    try {
      await updateRecord<ReportDraft>('reportDrafts', report.id, { title, recipient: recipient || undefined, sections, ...extra });
      setDirty(false);
      toast(extra.status === 'final' ? 'Marked final' : 'Report saved');
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => void updateRecord<ReportDraft>('reportDrafts', report.id, { title, recipient: recipient || undefined, sections }).then(() => setDirty(false)), 2000);
    return () => window.clearTimeout(t);
  }, [dirty, title, recipient, sections, report.id]);

  const included = sections.filter((s) => s.included);
  const sensitiveIncluded = included.filter((s) => s.sensitive);

  const downloadPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    const M = 56;
    let y = M;
    const ensure = (h: number) => {
      if (y + h > H - M) {
        pdf.addPage();
        y = M;
      }
    };
    pdf.setFillColor(35, 44, 8);
    pdf.rect(0, 0, W, 6, 'F');
    pdf.setFont('helvetica', 'bold').setFontSize(10).setTextColor(35, 44, 8).text('GOOD DOG BEHAVIOR CONSULTANTS', M, y);
    pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(97, 118, 79).text('Compassionate. Professional. Effective.', M, y + 13);
    y += 46;
    pdf.setFont('times', 'normal').setFontSize(20).setTextColor(35, 44, 8);
    for (const line of pdf.splitTextToSize(title, W - 2 * M)) {
      ensure(24);
      pdf.text(line, M, y);
      y += 24;
    }
    if (recipient) {
      pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(92, 100, 80).text(`Prepared for ${recipient}`, M, y);
      y += 16;
    }
    y += 10;
    for (const s of included) {
      ensure(40);
      pdf.setFont('helvetica', 'bold').setFontSize(10).setTextColor(79, 99, 64).text(s.heading.toUpperCase(), M, y);
      y += 16;
      pdf.setFont('helvetica', 'normal').setFontSize(11).setTextColor(35, 44, 8);
      for (const line of pdf.splitTextToSize(s.body, W - 2 * M)) {
        ensure(15);
        pdf.text(line, M, y);
        y += 15;
      }
      y += 14;
    }
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(140, 140, 120).text(`Good Dog Behavior Consultants · ${fmtDate(new Date().toISOString())} · page ${i} of ${pages}`, M, H - 28);
    }
    pdf.save(`${title.replace(/[^\w\s-]+/g, '').replace(/\s+/g, '-').slice(0, 80)}.pdf`);
  };

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Report"
          eyebrow={
            <span className="inline-flex items-center gap-2">
              <Tag tone={report.status === 'final' ? 'moss' : 'honey'}>{report.status === 'final' ? 'Final' : 'Draft'}</Tag>
              <span className="tracking-normal normal-case">{dirty ? 'Unsaved changes' : 'Saved'}</span>
            </span>
          }
          back={dog ? { to: `/dogs/${dog.id}?tab=plans`, label: dog.name } : { to: '/', label: 'Home' }}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden />
                Print
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void downloadPdf()}>
                <Download className="size-4" aria-hidden />
                PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(renderReportText(title, sections));
                  toast('Copied — paste it into your email');
                }}
              >
                <Copy className="size-4" aria-hidden />
                Copy text
              </Button>
              {report.status !== 'final' ? (
                <Button size="sm" busy={busy} onClick={() => void save({ status: 'final' })}>
                  <CheckCircle2 className="size-4" aria-hidden />
                  Mark final
                </Button>
              ) : (
                <Button size="sm" variant="secondary" busy={busy} onClick={() => void save({ status: 'draft' })}>
                  Back to draft
                </Button>
              )}
            </>
          }
        >
          <p className="text-sm text-fg-muted">Nothing is sent automatically. Review every section, then print, save a PDF, or copy the text into your own email.</p>
        </PageHeader>

        {sensitiveIncluded.length ? (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-2xl border border-clay/30 bg-clay-soft/60 px-4 py-3 text-sm text-[#7f3219]">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Includes private or safety-sensitive content: <strong>{sensitiveIncluded.map((s) => s.heading).join(', ')}</strong>.
            </span>
          </div>
        ) : null}

        <div className="mb-4 flex gap-1 rounded-full bg-mist p-1 lg:hidden" role="tablist" aria-label="Report view">
          {(['edit', 'preview'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={cn('flex-1 rounded-full py-2 text-sm font-semibold', tab === t ? 'bg-white shadow-sm' : 'text-fg-muted')}>
              {t === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-2">
        <div className={cn('no-print flex flex-col gap-3', tab === 'preview' && 'hidden lg:flex')}>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Title
            <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className={controlClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Prepared for
            <input value={recipient} placeholder="e.g. Maya & Jordan" onChange={(e) => { setRecipient(e.target.value); setDirty(true); }} className={controlClass} />
          </label>
          {sections.map((s, i) => (
            <div key={s.id} className={cn('rounded-2xl border p-3.5 transition-colors', s.included ? 'border-line bg-card' : 'border-dashed border-line-strong/50 bg-paper', s.sensitive && 'border-s-4 border-s-clay/60')}>
              <div className="mb-2 flex items-center gap-2">
                <input aria-label="Section heading" value={s.heading} onChange={(e) => patch(s.id, { heading: e.target.value })} className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-moss/20" />
                {s.sensitive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-clay-soft px-2 py-0.5 text-[0.6875rem] font-bold text-[#7f3219] uppercase">
                    <Lock className="size-3" aria-hidden /> Private
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-pressed={s.included}
                  aria-label={s.included ? `Exclude “${s.heading}”` : `Include “${s.heading}”`}
                  onClick={() => {
                    if (!s.included && s.sensitive && !confirm(`“${s.heading}” contains private or safety-sensitive information. Include it in the client report?`)) return;
                    patch(s.id, { included: !s.included });
                  }}
                  className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', s.included ? 'bg-moss text-paper' : 'bg-mist text-fg-muted')}
                >
                  {s.included ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                  {s.included ? 'Included' : 'Excluded'}
                </button>
              </div>
              <AutoGrow aria-label={`${s.heading} text`} value={s.body} onChange={(e) => patch(s.id, { body: e.target.value })} className={cn(controlClass, 'resize-none text-sm leading-relaxed', !s.included && 'opacity-60')} rows={2} />
              <div className="mt-1.5 flex justify-end gap-1">
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => change((ss) => { const n = [...ss]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} className="rounded-full p-1.5 text-fg-muted hover:bg-mist disabled:opacity-30">
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button type="button" aria-label="Move down" disabled={i === sections.length - 1} onClick={() => change((ss) => { const n = [...ss]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} className="rounded-full p-1.5 text-fg-muted hover:bg-mist disabled:opacity-30">
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button type="button" aria-label="Remove section" onClick={() => change((ss) => ss.filter((x) => x.id !== s.id))} className="rounded-full p-1.5 text-fg-muted hover:bg-clay-soft hover:text-clay">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          ))}
          <Button variant="secondary" className="w-fit" onClick={() => change((ss) => [...ss, { id: `c${Date.now()}`, heading: 'Note', body: '', included: true, sensitive: false }])}>
            <Plus className="size-4" aria-hidden />
            Add section
          </Button>
          <div className="mt-2 flex gap-2">
            <Button busy={busy} onClick={() => void save()}>
              Save
            </Button>
            <Button
              variant="ghost"
              className="text-clay"
              onClick={async () => {
                if (!confirm('Delete this report draft?')) return;
                await deleteDoc(doc(db, 'reportDrafts', report.id));
                toast('Report deleted');
                navigate(dog ? `/dogs/${dog.id}?tab=plans` : '/');
              }}
            >
              Delete draft
            </Button>
          </div>
        </div>

        <article aria-label="Report preview" className={cn('print-sheet h-fit rounded-[1.25rem] border border-line bg-white p-7 shadow-card sm:p-10 lg:sticky lg:top-24', tab === 'edit' && 'hidden lg:block')}>
          <header className="mb-8 border-b-2 border-olive pb-4">
            <p className="text-[0.75rem] font-extrabold tracking-[0.18em] text-olive">GOOD DOG BEHAVIOR CONSULTANTS</p>
            <p className="text-xs text-moss-soft">Compassionate. Professional. Effective.</p>
          </header>
          <h1 className="font-serif text-[1.75rem] leading-tight text-olive">{title}</h1>
          {recipient ? <p className="mt-1 text-sm text-fg-muted">Prepared for {recipient}</p> : null}
          <div className="mt-6 flex flex-col gap-5">
            {included.map((s) => (
              <section key={s.id}>
                <h2 className="mb-1 text-[0.75rem] font-bold tracking-[0.12em] text-moss uppercase">{s.heading}</h2>
                <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-olive">{s.body}</p>
              </section>
            ))}
          </div>
          <footer className="mt-10 border-t border-line pt-3 text-xs text-fg-muted">Good Dog Behavior Consultants · hello@gooddogbehaviorconsultants.com</footer>
        </article>
      </div>
    </div>
  );
}
