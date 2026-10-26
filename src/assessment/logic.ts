import type {
  AssessmentMode,
  Question,
  QuestionCondition,
  QuestionResponse,
  TemplateDefinition,
  TemplateSection,
} from '../lib/types';

export type Responses = Record<string, QuestionResponse>;

export function hasValue(r: QuestionResponse | undefined): boolean {
  if (!r || r.status !== 'answered') return false;
  const v = r.value;
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.some((x) => String(x).trim().length > 0);
  return true;
}

export function conditionMet(cond: QuestionCondition, responses: Responses): boolean {
  const r = responses[cond.questionId];
  if (cond.operator === 'answered') return hasValue(r) && !(Array.isArray(r?.value) && r.value.every((x) => /^none/i.test(String(x))));
  if (!hasValue(r)) return cond.operator === 'notEquals';
  const v = r!.value;
  const target = cond.value ?? '';
  switch (cond.operator) {
    case 'equals':
      return Array.isArray(v) ? v.includes(target) : normalize(v) === normalize(target);
    case 'notEquals':
      return Array.isArray(v) ? !v.includes(target) : normalize(v) !== normalize(target);
    case 'includes':
      return Array.isArray(v) ? v.includes(target) : String(v).toLowerCase().includes(target.toLowerCase());
  }
}

function normalize(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v).toLowerCase();
}

/** A question is shown when it fits the assessment mode and its condition (if any) is met. */
export function isVisible(question: Question, responses: Responses, mode: AssessmentMode): boolean {
  if (question.mode && question.mode !== mode) return false;
  return question.showIf ? conditionMet(question.showIf, responses) : true;
}

export function activeSections(template: TemplateDefinition, enabledModules: string[]): TemplateSection[] {
  return [...template.sections, ...template.modules.filter((m) => enabledModules.includes(m.id))];
}

export interface SectionProgress {
  visible: number;
  resolved: number;
  requiredMissing: Question[];
  complete: boolean;
  started: boolean;
}

/** A question counts as resolved when it has an answer or is marked not assessed / not applicable. */
export function isResolved(r: QuestionResponse | undefined): boolean {
  return !!r && (r.status !== 'answered' || hasValue(r));
}

export function sectionProgress(section: TemplateSection, responses: Responses, mode: AssessmentMode): SectionProgress {
  const visible = section.questions.filter((q) => isVisible(q, responses, mode));
  const resolved = visible.filter((q) => isResolved(responses[q.id]));
  const requiredMissing = visible.filter((q) => q.required && !isResolved(responses[q.id]));
  return {
    visible: visible.length,
    resolved: resolved.length,
    requiredMissing,
    complete: requiredMissing.length === 0 && resolved.length > 0,
    started: resolved.length > 0,
  };
}

/** Modules suggested by the selected primary concerns. Suggestions only; Haley decides. */
export function suggestedModules(template: TemplateDefinition, responses: Responses): string[] {
  const concerns = responses['co_main_concerns']?.value;
  if (!Array.isArray(concerns)) return [];
  return template.modules.filter((m) => m.suggestedFor?.some((c) => concerns.includes(c))).map((m) => m.id);
}

export function missingRequired(template: TemplateDefinition, enabledModules: string[], responses: Responses, mode: AssessmentMode) {
  return activeSections(template, enabledModules).flatMap((s) =>
    sectionProgress(s, responses, mode).requiredMissing.map((q) => ({ section: s, question: q })),
  );
}

/** Drop answers to questions that are no longer visible, so stale conditional answers never reach reports. */
export function visibleResponses(template: TemplateDefinition, enabledModules: string[], responses: Responses, mode: AssessmentMode): Responses {
  const out: Responses = {};
  for (const s of activeSections(template, enabledModules)) {
    for (const q of s.questions) {
      if (isVisible(q, responses, mode) && responses[q.id]) out[q.id] = responses[q.id];
    }
  }
  return out;
}

export function formatAnswer(question: Question, r: QuestionResponse | undefined): string {
  if (!r) return '';
  if (r.status === 'notAssessed') return 'Not assessed';
  if (r.status === 'notApplicable') return 'Not applicable';
  const v = r.value;
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return question.type === 'list' ? v.filter(Boolean).map((x) => `• ${x}`).join('\n') : v.join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (question.type === 'yesNo') return v === 'yes' ? 'Yes' : v === 'no' ? 'No' : String(v);
  return String(v);
}

/** Problems that would make a template unsafe to publish. */
export function validate(def: TemplateDefinition): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const s of [...def.sections, ...def.modules]) {
    if (!s.title.trim()) problems.push('Every section needs a title.');
    for (const q of s.questions) {
      if (ids.has(q.id)) problems.push(`Duplicate question id ${q.id}.`);
      ids.add(q.id);
      if (!q.label.trim()) problems.push(`A question in “${s.title}” has no text.`);
      if ((q.type === 'singleChoice' || q.type === 'multiChoice') && !(q.options ?? []).filter((o) => o.trim()).length) problems.push(`“${q.label}” needs at least one option.`);
    }
  }
  for (const s of [...def.sections, ...def.modules]) {
    for (const q of s.questions) {
      if (q.showIf && !ids.has(q.showIf.questionId)) problems.push(`“${q.label}” depends on a question that no longer exists.`);
    }
  }
  return problems;
}
