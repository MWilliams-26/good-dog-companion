// Builds editable client-facing report drafts from practice records. Private
// and safety-sensitive content becomes sections marked `sensitive` that start
// excluded; Haley has to opt in to each one before it appears in the output.

import { activeSections, formatAnswer, hasValue } from '../assessment/logic';
import { CONSULT_TYPE, GOAL_STATUS } from './labels';
import { fmtDate } from './dates';
import type { Assessment, AssessmentTemplateVersion, Consultation, Dog, Goal, ProgressObservation, ReportSection, TrainingPlan } from './types';

let counter = 0;
const sid = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

function section(heading: string, body: string | undefined | null, opts: { sensitive?: boolean; included?: boolean } = {}): ReportSection | null {
  const text = (body ?? '').trim();
  if (!text) return null;
  const sensitive = !!opts.sensitive;
  return { id: sid(), heading, body: text, sensitive, included: opts.included ?? !sensitive };
}

const compact = (xs: (ReportSection | null)[]) => xs.filter((x): x is ReportSection => !!x);

function safetyBody(dog: Dog) {
  return dog.safetyNotes.map((n) => `${n.level === 'important' ? 'Important: ' : ''}${n.text}`).join('\n');
}

function goalBlock(g: Goal, obs: ProgressObservation[]) {
  const lines: string[] = [];
  if (g.why) lines.push(g.why, '');
  if (g.successCriteria.length) lines.push('What success looks like:', ...g.successCriteria.map((c) => `• ${c}`), '');
  if (g.milestones.length) lines.push('Milestones:', ...g.milestones.map((m) => `${m.reachedOn ? '✓' : '○'} ${m.label}${m.reachedOn ? ` (${fmtDate(m.reachedOn)})` : ''}`), '');
  if (g.exercises.length) lines.push('Exercises:', ...g.exercises.map((x) => `• ${x.name}${x.instructions ? `\n  ${x.instructions.replace(/\n/g, '\n  ')}` : ''}`), '');
  if (g.homework) lines.push('Homework:', g.homework, '');
  const recent = obs.filter((o) => o.goalId === g.id).slice(0, 3);
  if (recent.length) lines.push('Recent progress:', ...recent.map((o) => `${fmtDate(o.date, 'MMM d')} — ${o.observation}`));
  return lines.join('\n').trim();
}

export function consultationReport(c: Consultation, dogs: Dog[], goals: Goal[], obs: ProgressObservation[]): { title: string; sections: ReportSection[] } {
  const names = dogs.map((d) => d.name).join(' & ');
  const sessionObs = obs.filter((o) => o.consultationId === c.id);
  const goalMap = new Map(goals.map((g) => [g.id, g]));
  const progress = sessionObs.map((o) => `${goalMap.get(o.goalId)?.title ?? 'Goal'}: ${o.observation}`).join('\n');
  const sections = compact([
    section('Session', `${CONSULT_TYPE[c.type]} · ${fmtDate(c.date, 'EEEE, MMMM d, yyyy')}${c.durationMinutes ? ` · ${c.durationMinutes} minutes` : ''}${c.location ? `\n${c.location}` : ''}`),
    ...(c.format === 'freeform'
      ? [section('Session notes', c.freeformNotes)]
      : [
          section('Since our last session', c.changesSinceLast),
          section('What we saw today', c.observations),
          section('What we practiced', c.exercisesPracticed),
          section('Progress on goals', progress),
          section('Homework', c.homework),
          section('Next steps', c.nextSteps),
        ]),
    section('Consultant notes', c.privateNotes, { sensitive: true }),
    ...dogs.map((d) => section(`Safety notes · ${d.name}`, safetyBody(d), { sensitive: true })),
  ]);
  return { title: `${names} · Session summary · ${fmtDate(c.date, 'MMM d, yyyy')}`, sections };
}

export function planReport(plan: TrainingPlan, dog: Dog, goals: Goal[], obs: ProgressObservation[]): { title: string; sections: ReportSection[] } {
  const ordered = [...goals].sort((a, b) => a.priority - b.priority).filter((g) => g.status !== 'revised');
  const sections = compact([
    section('About this plan', plan.summary || `${dog.name}’s individualized training plan, started ${fmtDate(plan.startDate)}.`),
    section('Management, starting now', plan.management),
    ...ordered.map((g, i) => section(`Goal ${i + 1}: ${g.title} (${GOAL_STATUS[g.status].label.toLowerCase()})`, goalBlock(g, obs) || 'We’ll map out the steps for this goal together at our next session.')),
    section('When we’ll review', plan.reviewDate ? `We’ll look at progress together around ${fmtDate(plan.reviewDate, 'MMMM d')}. Reach out any time before then.` : null),
    section(`Safety notes · ${dog.name}`, safetyBody(dog), { sensitive: true }),
  ]);
  return { title: `${dog.name} · Training plan`, sections };
}

export function assessmentReport(a: Assessment, template: AssessmentTemplateVersion, dog: Dog): { title: string; sections: ReportSection[] } {
  const shared: ReportSection[] = [];
  const privateLines: string[] = [];
  for (const s of activeSections(template, a.enabledModules)) {
    const lines: string[] = [];
    for (const q of s.questions) {
      const r = a.responses[q.id];
      if (!r || !hasValue(r)) continue;
      const line = `${q.label}\n${formatAnswer(q, r)}${r.source ? ` (${r.source === 'observed' ? 'observed' : 'reported'})` : ''}`;
      if (q.private) privateLines.push(`${s.title} — ${line}`);
      else lines.push(line);
    }
    const sec = section(s.title, lines.join('\n\n'));
    if (sec) shared.push(sec);
  }
  const sections = compact([
    section('Assessment', `${a.mode === 'initial' ? 'Initial behavioral assessment' : 'Follow-up assessment'} for ${dog.name} · ${fmtDate(a.date, 'MMMM d, yyyy')}\nThis summary records what we discussed and observed. It is not a diagnosis.`),
    ...shared,
    section('Private and safety-related answers', privateLines.join('\n\n'), { sensitive: true }),
    section('Consultant notes', a.privateNotes, { sensitive: true }),
  ]);
  return { title: `${dog.name} · ${a.mode === 'initial' ? 'Assessment summary' : 'Follow-up summary'} · ${fmtDate(a.date, 'MMM d, yyyy')}`, sections };
}

/** Text of a report as it will be shared: only included sections. */
export function renderReportText(title: string, sections: ReportSection[]) {
  return [title, '', ...sections.filter((s) => s.included).flatMap((s) => [s.heading.toUpperCase(), s.body, ''])].join('\n').trim();
}
