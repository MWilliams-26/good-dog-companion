import { describe, expect, it } from 'vitest';
import { csvCell, toCSV } from './csv';
import { consultationReport, planReport, renderReportText } from './reports';
import { excerpt, matches, searchPractice } from './search';
import type { Client, Consultation, Dog, Goal, Household, TrainingPlan } from './types';

const meta = { createdAt: null, updatedAt: null, createdBy: 'u', updatedBy: 'u' };
const dog = (p: Partial<Dog>): Dog => ({ id: 'd1', name: 'Juniper', sex: 'female', householdId: 'h1', concerns: [], safetyNotes: [], status: 'active', ...meta, ...p });

describe('CSV export', () => {
  it('escapes quotes, commas and line breaks', () => {
    expect(csvCell('Said "hi", then left\nlater')).toBe('"Said ""hi"", then left\nlater"');
  });
  it('neutralizes spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1 555')).toBe("'+1 555");
    expect(csvCell('-3')).toBe("'-3");
  });
  it('joins arrays and leaves empty values blank', () => {
    expect(toCSV([{ a: ['x', 'y'], b: null }], [{ header: 'A', value: (r) => r.a }, { header: 'B', value: (r) => r.b }])).toBe('A,B\r\nx; y,');
  });
});

describe('client reports keep private content out by default', () => {
  const session: Consultation = {
    id: 's1', ...meta, dogIds: ['d1'], clientIds: ['c1'], type: 'followUp', date: '2026-10-20', format: 'structured',
    observations: 'Calm at 40 ft.', homework: 'Pattern games daily.', privateNotes: 'Owner seemed overwhelmed.', goalIds: [],
  };
  const d = dog({ safetyNotes: [{ level: 'important', text: 'Bit a groomer in 2025.' }] });

  it('marks consultant notes and safety notes sensitive and excluded', () => {
    const { sections } = consultationReport(session, [d], [], []);
    const notes = sections.find((s) => s.heading === 'Consultant notes')!;
    const safety = sections.find((s) => s.heading.startsWith('Safety notes'))!;
    expect(notes).toMatchObject({ sensitive: true, included: false });
    expect(safety).toMatchObject({ sensitive: true, included: false });
    const text = renderReportText('t', sections);
    expect(text).toContain('Pattern games daily.');
    expect(text).not.toContain('overwhelmed');
    expect(text).not.toContain('groomer');
  });

  it('includes a sensitive section only once explicitly included', () => {
    const { sections } = consultationReport(session, [d], [], []);
    const opted = sections.map((s) => (s.heading === 'Consultant notes' ? { ...s, included: true } : s));
    expect(renderReportText('t', opted)).toContain('overwhelmed');
  });

  it('omits empty fields instead of printing blank headings', () => {
    const { sections } = consultationReport({ ...session, privateNotes: undefined, homework: '' }, [dog({})], [], []);
    expect(sections.map((s) => s.heading)).not.toContain('Homework');
    expect(sections.map((s) => s.heading)).not.toContain('Consultant notes');
  });

  it('training plan report lists goals by priority and skips revised goals', () => {
    const plan: TrainingPlan = { id: 'p1', ...meta, dogId: 'd1', title: 'Plan', status: 'active', startDate: '2026-09-01' };
    const g = (p: Partial<Goal>): Goal => ({ id: 'g', ...meta, planId: 'p1', dogId: 'd1', title: 'G', priority: 1, successCriteria: [], exercises: [], status: 'inProgress', milestones: [], ...p });
    const { sections } = planReport(plan, dog({}), [g({ id: 'b', title: 'Second', priority: 2 }), g({ id: 'a', title: 'First', priority: 1 }), g({ id: 'c', title: 'Old', priority: 0, status: 'revised' })], []);
    const goals = sections.filter((s) => s.heading.startsWith('Goal'));
    expect(goals.map((s) => s.heading)).toEqual(['Goal 1: First (in progress)', 'Goal 2: Second (in progress)']);
  });
});

describe('search', () => {
  const households: Household[] = [{ id: 'h1', ...meta, name: 'Rivera household', neighborhood: 'Astoria', members: [] }];
  const clients: Client[] = [{ id: 'c1', ...meta, firstName: 'Maya', lastName: 'Rivera', phone: '(555) 201-4410', preferredContact: 'text', status: 'active', householdId: 'h1' }];
  const dogs = [dog({ breed: 'Pit bull mix', concerns: ['Reactivity'] }), dog({ id: 'd2', name: 'Pickles', breed: 'Chihuahua' })];

  it('finds by any word, accent- and case-insensitively, and by phone digits', () => {
    expect(matches('Renée Delacroix', 'renee')).toBe(true);
    expect(matches('Maya Rivera (555) 201-4410', '2014410')).toBe(true);
    expect(matches('Maya Rivera', 'maya smith')).toBe(false);
  });

  it('ranks name matches above incidental matches', () => {
    const hits = searchPractice('rivera', { dogs, clients, households });
    expect(hits[0]).toMatchObject({ kind: 'client', title: 'Maya Rivera' });
    expect(searchPractice('astoria', { dogs, clients, households }).map((h) => h.title)).toEqual(expect.arrayContaining(['Juniper', 'Maya Rivera']));
    expect(searchPractice('reactivity', { dogs, clients, households }).map((h) => h.title)).toEqual(['Juniper']);
  });

  it('excerpts around the match', () => {
    expect(excerpt('a'.repeat(200) + ' muzzle training ' + 'b'.repeat(200), 'muzzle', 10)).toBe(`…${'a'.repeat(9)} muzzle tra…`);
  });
});
