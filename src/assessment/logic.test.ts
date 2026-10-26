import { describe, expect, it } from 'vitest';
import { MASTER_TEMPLATE } from './masterTemplate';
import { conditionMet, isVisible, missingRequired, sectionProgress, suggestedModules, validate, visibleResponses, type Responses } from './logic';
import type { Question } from '../lib/types';

const A = (value: unknown, source?: 'reported' | 'observed') => ({ status: 'answered' as const, value: value as never, source });
const find = (id: string): Question => [...MASTER_TEMPLATE.sections, ...MASTER_TEMPLATE.modules].flatMap((s) => s.questions).find((q) => q.id === id)!;

describe('conditional questions', () => {
  it('shows bite incident details only after “yes” to bite history', () => {
    const incidents = find('sf_incidents');
    expect(isVisible(incidents, {}, 'initial')).toBe(false);
    expect(isVisible(incidents, { sf_bite_history: A('no') }, 'initial')).toBe(false);
    expect(isVisible(incidents, { sf_bite_history: A('unsure') }, 'initial')).toBe(false);
    expect(isVisible(incidents, { sf_bite_history: A('yes') }, 'initial')).toBe(true);
  });

  it('“includes” matches a multi-choice member and a substring of a single choice', () => {
    expect(conditionMet({ questionId: 'x', operator: 'includes', value: 'Reactivity' }, { x: A(['Recall', 'Reactivity']) })).toBe(true);
    expect(conditionMet({ questionId: 'x', operator: 'includes', value: 'Reactivity' }, { x: A(['Recall']) })).toBe(false);
    // re_hallway depends on any apartment type
    const hallway = find('re_hallway');
    expect(isVisible(hallway, { hh_home_type: A('Apartment — walk-up') }, 'initial')).toBe(true);
    expect(isVisible(hallway, { hh_home_type: A('House with yard') }, 'initial')).toBe(false);
  });

  it('“answered” ignores “None noticed”-style answers', () => {
    const painDetail = find('md_pain_detail');
    expect(isVisible(painDetail, { md_pain_signs: A(['None noticed']) }, 'initial')).toBe(false);
    expect(isVisible(painDetail, { md_pain_signs: A(['Limping or stiffness']) }, 'initial')).toBe(true);
  });

  it('a condition on a question marked not applicable is not met', () => {
    expect(conditionMet({ questionId: 'x', operator: 'equals', value: 'yes' }, { x: { status: 'notApplicable', value: null } })).toBe(false);
    expect(conditionMet({ questionId: 'x', operator: 'notEquals', value: 'yes' }, {})).toBe(true);
  });

  it('respects initial-only and follow-up-only questions', () => {
    expect(isVisible(find('co_changes_since'), {}, 'initial')).toBe(false);
    expect(isVisible(find('co_changes_since'), {}, 'followUp')).toBe(true);
    expect(isVisible(find('co_onset'), {}, 'followUp')).toBe(false);
  });
});

describe('section completion', () => {
  const safety = MASTER_TEMPLATE.sections.find((s) => s.id === 'safety')!;

  it('a conditionally required question only counts once it is visible', () => {
    const before = sectionProgress(safety, { sf_bite_history: A('no') }, 'initial');
    expect(before.requiredMissing).toHaveLength(0);
    expect(before.complete).toBe(true);
    const after = sectionProgress(safety, { sf_bite_history: A('yes') }, 'initial');
    expect(after.requiredMissing.map((q) => q.id)).toEqual(['sf_incidents']);
    expect(after.complete).toBe(false);
  });

  it('“not assessed” resolves a required question; a blank answer does not', () => {
    const r: Responses = { sf_bite_history: A('yes'), sf_incidents: A('   ') };
    expect(sectionProgress(safety, r, 'initial').requiredMissing).toHaveLength(1);
    r.sf_incidents = { status: 'notAssessed', value: null };
    expect(sectionProgress(safety, r, 'initial').requiredMissing).toHaveLength(0);
  });

  it('required questions in disabled modules do not block completion', () => {
    const missingWithout = missingRequired(MASTER_TEMPLATE, [], {}, 'initial').map((m) => m.section.id);
    expect(missingWithout).not.toContain('mod_reactivity');
    expect(new Set(missingWithout)).toEqual(new Set(['household', 'concerns', 'safety', 'observations', 'recommendations']));
  });
});

describe('modules and stale answers', () => {
  it('suggests modules from selected concerns without enabling them', () => {
    expect(suggestedModules(MASTER_TEMPLATE, { co_main_concerns: A(['Separation-related behavior', 'Recall']) })).toEqual(['mod_separation']);
    expect(suggestedModules(MASTER_TEMPLATE, { co_main_concerns: A(['Multi-dog household conflict']) })).toEqual(['mod_aggression']);
  });

  it('drops answers to questions hidden by a later change, so they never reach reports', () => {
    const r: Responses = { sf_bite_history: A('no'), sf_incidents: A('Old incident text'), hh_routine: A('walks') };
    const kept = visibleResponses(MASTER_TEMPLATE, [], r, 'initial');
    expect(kept.sf_incidents).toBeUndefined();
    expect(kept.hh_routine).toBeDefined();
  });
});

describe('template validation', () => {
  it('the master template is valid and has unique ids', () => {
    expect(validate(MASTER_TEMPLATE)).toEqual([]);
  });

  it('rejects a condition pointing at a removed question', () => {
    const broken = { ...MASTER_TEMPLATE, sections: MASTER_TEMPLATE.sections.map((s) => (s.id === 'safety' ? { ...s, questions: s.questions.filter((q) => q.id !== 'sf_bite_history') } : s)) };
    expect(validate(broken).some((p) => p.includes('depends on a question that no longer exists'))).toBe(true);
  });
});
