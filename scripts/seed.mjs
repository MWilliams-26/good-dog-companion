#!/usr/bin/env node
// Seeds the Firebase EMULATOR with a fictional practice. Every person, dog,
// phone number and address here is invented. Refuses to run against anything
// other than a demo-* project on the emulator.
//
//   npm run seed            (emulators must be running: npm run emulators)
//   npm run seed -- --reset (wipe emulator data first)
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { MASTER_TEMPLATE } from '../src/assessment/masterTemplate.ts';

const PROJECT = process.env.GCLOUD_PROJECT ?? 'demo-good-dog';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
if (!PROJECT.startsWith('demo-')) {
  console.error('Refusing to seed: project id must start with demo- (emulator only).');
  process.exit(1);
}

export const DEMO_USERS = {
  haley: { email: 'haley@gooddog.demo', password: 'GoodDog!2026', displayName: 'Haley Wilson' },
  intruder: { email: 'intruder@example.demo', password: 'NotAllowed!2026', displayName: 'Not Authorized' },
};

initializeApp({ projectId: PROJECT });
const auth = getAuth();
const db = getFirestore();

// ── Helpers ────────────────────────────────────────────────────────────────
const DAY = 86_400_000;
const now = new Date();
const iso = (offsetDays) => new Date(now.getTime() + offsetDays * DAY).toISOString().slice(0, 10);
const at = (offsetDays, hh, mm = 0) => {
  const d = new Date(now.getTime() + offsetDays * DAY);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
};
const ts = (offsetDays) => Timestamp.fromDate(new Date(now.getTime() + offsetDays * DAY));

let uid = '';
const meta = (offsetDays = -1) => ({ createdAt: ts(offsetDays), updatedAt: ts(Math.min(0, offsetDays + 2)), createdBy: uid, updatedBy: uid });

const writes = [];
const put = (col, id, data, offsetDays) => writes.push([`${col}/${id}`, { ...data, ...meta(offsetDays) }]);

async function reset() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

async function ensureUser({ email, password, displayName }) {
  try {
    return (await auth.getUserByEmail(email)).uid;
  } catch {
    return (await auth.createUser({ email, password, displayName, emailVerified: true })).uid;
  }
}

// ── People, homes, dogs ────────────────────────────────────────────────────
const households = [
  { id: 'hh_rivera', name: 'Rivera–Lee household', neighborhood: 'Astoria', address: '31-14 Fictional Ave, Apt 4B, Astoria NY', homeType: 'Apartment — walk-up', accessNotes: 'Buzz 4B. Three flights; Juniper waits behind a gate at the top.', members: [{ name: 'Maya Rivera', relationship: 'Guardian' }, { name: 'Jordan Lee', relationship: 'Guardian' }], otherAnimals: '' },
  { id: 'hh_okafor', name: 'Okafor household', neighborhood: 'Park Slope', address: '418 Sample St, Brooklyn NY', homeType: 'Townhouse / brownstone', members: [{ name: 'Chidi Okafor', relationship: 'Guardian' }, { name: 'Ada Okafor', relationship: 'Daughter (9)' }], otherAnimals: 'One indoor cat, Professor (12).' },
  { id: 'hh_brennan', name: 'Brennan household', neighborhood: 'Upper West Side', address: '200 W Example St, Apt 11C, New York NY', homeType: 'Apartment — elevator building', accessNotes: 'Doorman. Theo is calmer if we meet in the lobby first.', members: [{ name: 'Siobhan Brennan', relationship: 'Guardian' }] },
  { id: 'hh_patel', name: 'Patel–Goldberg household', neighborhood: 'Williamsburg', address: '77 Placeholder Ave, Brooklyn NY', homeType: 'Apartment — elevator building', members: [{ name: 'Priya Patel', relationship: 'Guardian' }, { name: 'Sam Goldberg', relationship: 'Guardian' }, { name: 'Noor', relationship: 'Child (6)' }] },
  { id: 'hh_nakamura', name: 'Nakamura household', neighborhood: 'Long Island City', address: '5-10 Demo Blvd, Apt 22F, LIC NY', homeType: 'Apartment — elevator building', members: [{ name: 'Kenji Nakamura', relationship: 'Guardian' }] },
  { id: 'hh_delacroix', name: 'Delacroix household', neighborhood: 'Harlem', address: '140 W Imaginary St, New York NY', homeType: 'Townhouse / brownstone', accessNotes: 'Bruno goes to the back room before anyone enters.', members: [{ name: 'Renée Delacroix', relationship: 'Guardian' }, { name: 'Marcus Delacroix', relationship: 'Adult son, visits weekends' }] },
  { id: 'hh_moreno', name: 'Moreno foster home', neighborhood: 'Sunnyside', address: '43-01 Mock St, Sunnyside NY', homeType: 'Apartment — walk-up', members: [{ name: 'Alex Moreno', relationship: 'Foster volunteer' }], otherAnimals: 'Rotating foster dogs via Second Chance Paws (fictional).' },
  { id: 'hh_huang', name: 'Huang household', neighborhood: 'Bushwick', address: '9 Sample Pl, Brooklyn NY', homeType: 'Apartment — walk-up', members: [{ name: 'Tess Huang', relationship: 'Guardian' }, { name: 'Ollie Park', relationship: 'Roommate' }] },
  { id: 'hh_kowalski', name: 'Kowalski household', neighborhood: 'Greenpoint', address: '12 Pretend St, Brooklyn NY', homeType: 'Apartment — walk-up', members: [{ name: 'Marta Kowalski', relationship: 'Guardian' }] },
  { id: 'hh_abernathy', name: 'Abernathy household', neighborhood: 'Forest Hills', homeType: 'House with yard', members: [{ name: 'Grace Abernathy', relationship: 'Guardian' }, { name: 'Tom Abernathy', relationship: 'Spouse' }] },
  { id: 'hh_fitzgerald', name: 'Fitzgerald household', neighborhood: 'Crown Heights', members: [{ name: 'Liam Fitzgerald', relationship: 'Guardian' }] },
  { id: 'hh_haddad', name: 'Haddad household', neighborhood: 'Bay Ridge', address: '88 Example Ave, Brooklyn NY', homeType: 'House with yard', members: [{ name: 'Nadia Haddad', relationship: 'Guardian' }, { name: 'Omar Haddad', relationship: 'Spouse' }] },
  { id: 'hh_thompson', name: 'Thompson household', neighborhood: 'Jersey City (virtual)', homeType: 'Apartment — elevator building', members: [{ name: 'Ben Thompson', relationship: 'Guardian' }] },
  { id: 'hh_morales', name: 'Morales household', neighborhood: 'Inwood', homeType: 'Apartment — walk-up', members: [{ name: 'Dani Morales', relationship: 'Guardian' }] },
];

const clients = [
  { id: 'c_maya', firstName: 'Maya', lastName: 'Rivera', pronouns: 'she/her', email: 'maya.rivera@example.com', phone: '(555) 201-4410', preferredContact: 'text', bestTimes: 'Weekday evenings', status: 'active', householdId: 'hh_rivera', referralSource: 'Instagram', communicationNotes: 'Prefers a short text before calls. Jordan joins sessions on Saturdays.', notes: 'Very consistent with homework; keeps a walk journal.', privateNotes: 'Feels guilty about the dog fight in March — reassure, keep tone non-judgmental.' },
  { id: 'c_jordan', firstName: 'Jordan', lastName: 'Lee', pronouns: 'they/them', email: 'jordan.lee@example.com', phone: '(555) 201-4411', preferredContact: 'email', status: 'active', householdId: 'hh_rivera' },
  { id: 'c_chidi', firstName: 'Chidi', lastName: 'Okafor', email: 'chidi.o@example.com', phone: '(555) 310-2290', preferredContact: 'call', bestTimes: 'Mornings before 9', status: 'new', householdId: 'hh_okafor', referralSource: 'Vet referral — Slope Animal Clinic (fictional)' },
  { id: 'c_siobhan', firstName: 'Siobhan', lastName: 'Brennan', email: 'siobhan.b@example.com', phone: '(555) 442-8013', preferredContact: 'email', status: 'active', householdId: 'hh_brennan', referralSource: 'Fear Free directory', notes: 'Works from home Tue/Thu.' },
  { id: 'c_priya', firstName: 'Priya', lastName: 'Patel', email: 'priya.patel@example.com', phone: '(555) 618-0021', preferredContact: 'text', status: 'active', householdId: 'hh_patel', communicationNotes: 'Text first. Noor is usually home after 3pm.' },
  { id: 'c_sam', firstName: 'Sam', lastName: 'Goldberg', email: 'sam.g@example.com', phone: '(555) 618-0022', preferredContact: 'text', status: 'active', householdId: 'hh_patel' },
  { id: 'c_kenji', firstName: 'Kenji', lastName: 'Nakamura', email: 'kenji.n@example.com', phone: '(555) 733-5501', preferredContact: 'email', status: 'active', householdId: 'hh_nakamura', referralSource: 'Friend (Tess Huang)' },
  { id: 'c_renee', firstName: 'Renée', lastName: 'Delacroix', email: 'renee.d@example.com', phone: '(555) 824-1199', preferredContact: 'call', status: 'returning', householdId: 'hh_delacroix', notes: 'Worked together in 2025 on visitor greetings; back after a move.', privateNotes: 'Son Marcus is skeptical of “positive-only” training. Include him in the next session.' },
  { id: 'c_alex', firstName: 'Alex', lastName: 'Moreno', email: 'alex.m@example.com', phone: '(555) 930-4470', preferredContact: 'text', status: 'active', householdId: 'hh_moreno', referralSource: 'Second Chance Paws (fictional rescue partner)', notes: 'Rescue partner rate.' },
  { id: 'c_tess', firstName: 'Tess', lastName: 'Huang', email: 'tess.h@example.com', phone: '(555) 108-6620', preferredContact: 'text', status: 'active', householdId: 'hh_huang', referralSource: 'Adopted Rocket from Alex’s foster home' },
  { id: 'c_marta', firstName: 'Marta', lastName: 'Kowalski', email: 'marta.k@example.com', phone: '(555) 247-3318', preferredContact: 'call', status: 'inactive', householdId: 'hh_kowalski', notes: 'Pierogi graduated. Holiday card list.' },
  { id: 'c_grace', firstName: 'Grace', lastName: 'Abernathy', email: 'grace.a@example.com', phone: '(555) 516-7781', preferredContact: 'email', status: 'inquiry', householdId: 'hh_abernathy', inquiryDate: iso(-1), inquirySummary: 'Adopted a 6-month-old rescue puppy two weeks ago. He growls at her husband when he comes home and hides under the bed. Asking about a consultation.', referralSource: 'Website contact form' },
  { id: 'c_liam', firstName: 'Liam', lastName: 'Fitzgerald', email: 'liam.f@example.com', phone: '(555) 662-9014', preferredContact: 'text', status: 'inquiry', householdId: 'hh_fitzgerald', inquiryDate: iso(-3), inquirySummary: 'Olive (2, terrier mix) pulls hard and barks at scooters. Moving to a smaller apartment next month.', referralSource: 'Instagram DM' },
  { id: 'c_nadia', firstName: 'Nadia', lastName: 'Haddad', email: 'nadia.h@example.com', phone: '(555) 371-2266', preferredContact: 'text', status: 'new', householdId: 'hh_haddad' },
  { id: 'c_ben', firstName: 'Ben', lastName: 'Thompson', email: 'ben.t@example.com', phone: '(555) 455-0193', preferredContact: 'email', status: 'active', householdId: 'hh_thompson', communicationNotes: 'Virtual only. Sends videos through a shared folder.' },
  { id: 'c_dani', firstName: 'Dani', lastName: 'Morales', email: 'dani.m@example.com', phone: '(555) 589-7720', preferredContact: 'text', status: 'inactive', householdId: 'hh_morales' },
];

const dogs = [
  { id: 'd_juniper', name: 'Juniper', breed: 'Pit bull terrier mix', sex: 'female', altered: true, birthDate: iso(-365 * 3 - 40), weightLbs: 52, coat: 'Brindle with white chest', householdId: 'hh_rivera', acquisition: 'Rescue or shelter', acquisitionDate: iso(-540), rescueOrg: 'Second Chance Paws (fictional)', vetClinic: 'Ditmars Vet (fictional)', concerns: ['Reactivity', 'Multi-dog household conflict', 'Leash walking'], safetyNotes: [{ level: 'caution', text: 'Lunges at dogs within half a block on leash. Use the harness clip, not the collar.' }], summary: 'Sweet, people-loving, and very food motivated. Leash reactive to dogs; recovering well with pattern games. One scuffle with Pickles over a chew in March.', status: 'active' },
  { id: 'd_pickles', name: 'Pickles', breed: 'Chihuahua mix', sex: 'male', altered: true, birthDate: iso(-365 * 7 - 100), weightLbs: 11, coat: 'Fawn', householdId: 'hh_rivera', acquisition: 'Previous owner / rehome', acquisitionDate: iso(-365 * 4), concerns: ['Resource guarding', 'Multi-dog household conflict'], safetyNotes: [{ level: 'important', text: 'Guards chews and the couch. Never reach toward him while he has a chew; trade from a distance.' }], summary: 'Senior, opinionated, guards chews and resting spots from Juniper. Gentle with people if not cornered.', status: 'active' },
  { id: 'd_biscuit', name: 'Biscuit', breed: 'Golden retriever', sex: 'male', altered: false, birthDate: iso(-245), weightLbs: 48, coat: 'Light gold', householdId: 'hh_okafor', acquisition: 'Breeder', acquisitionDate: iso(-190), vetClinic: 'Slope Animal Clinic (fictional)', concerns: ['Puppy development', 'Jumping / mouthing'], safetyNotes: [], summary: 'Joyful adolescent. Mouthy with Ada (9). Cat-curious.', status: 'active' },
  { id: 'd_theo', name: 'Theo', breed: 'Shiba Inu', sex: 'male', altered: true, birthDate: iso(-365 * 5 - 20), weightLbs: 23, coat: 'Red sesame', householdId: 'hh_brennan', acquisition: 'Breeder', acquisitionDate: iso(-365 * 5 + 60), vetClinic: 'West Side Animal Hospital (fictional)', concerns: ['Handling / cooperative care', 'Bite history', 'Fear or anxiety'], safetyNotes: [{ level: 'important', text: 'Bit a groomer (Level 3, single puncture) during a nail trim in 2025. Muzzle conditioned — use it for any handling beyond touch.' }, { level: 'caution', text: 'Do not reach over his head or grab the collar.' }], summary: 'Dignified and independent. Panics with restraint. Muzzle conditioning complete; working on chin-rest consent for nails and ears.', status: 'active' },
  { id: 'd_mango', name: 'Mango', breed: 'Australian cattle dog mix', sex: 'female', altered: true, birthDate: iso(-365 * 2 - 60), weightLbs: 38, coat: 'Red heeler', householdId: 'hh_patel', acquisition: 'Rescue or shelter', acquisitionDate: iso(-400), concerns: ['Jumping / mouthing', 'Fear or anxiety'], safetyNotes: [{ level: 'caution', text: 'Nips at running feet, especially Noor’s. Supervise or gate when Noor plays.' }], summary: 'Bright, busy, needs a job. Herding-style nipping toward the child during play.', status: 'active' },
  { id: 'd_lentil', name: 'Lentil', breed: 'Beagle', sex: 'female', altered: true, birthDate: iso(-365 * 4 - 200), weightLbs: 26, householdId: 'hh_patel', acquisition: 'Rescue or shelter', acquisitionDate: iso(-365 * 3), concerns: ['Fear or anxiety'], safetyNotes: [], summary: 'Noise sensitive — construction and fireworks. Otherwise easygoing.', status: 'paused' },
  { id: 'd_mochi', name: 'Mochi', breed: 'French bulldog', sex: 'female', altered: true, birthDate: iso(-540), weightLbs: 21, coat: 'Cream', householdId: 'hh_nakamura', acquisition: 'Breeder', acquisitionDate: iso(-470), concerns: ['Separation-related behavior'], safetyNotes: [], summary: 'Vocalizes and scratches at the door within 2 minutes of departure. Comfortable alone time growing steadily.', status: 'active' },
  { id: 'd_bruno', name: 'Bruno', breed: 'Rottweiler mix', sex: 'male', altered: true, birthDate: iso(-365 * 6), weightLbs: 96, coat: 'Black and tan', householdId: 'hh_delacroix', acquisition: 'Rescue or shelter', acquisitionDate: iso(-365 * 4), rescueOrg: 'Harlem Hounds (fictional)', concerns: ['Aggression', 'Barking', 'Fear or anxiety'], safetyNotes: [{ level: 'important', text: 'Air-snapped at a delivery worker (2025). Visitors enter only after Bruno is behind the gate with a chew.' }, { level: 'caution', text: 'Startles at hats and hoods. Approach sideways, no eye contact, let him come to you.' }], summary: 'Gentle giant with family; fearful of strangers entering the home. Returning client — visitor protocol slipped after a move.', status: 'active' },
  { id: 'd_clementine', name: 'Clementine', breed: 'Hound mix', sex: 'female', altered: true, ageNote: 'about 2', weightLbs: 44, coat: 'Tri-color', householdId: 'hh_moreno', acquisition: 'Foster (current)', acquisitionDate: iso(-24), rescueOrg: 'Second Chance Paws (fictional)', concerns: ['Rescue transition / decompression', 'Fear or anxiety'], safetyNotes: [], summary: 'Transported from a rural shelter three weeks ago. Shut down on busy streets; blossoming at home.', status: 'active' },
  { id: 'd_rocket', name: 'Rocket', breed: 'Terrier mix', sex: 'male', altered: true, ageNote: 'about 1', weightLbs: 19, coat: 'Wiry grey', householdId: 'hh_huang', acquisition: 'Rescue or shelter', acquisitionDate: iso(-120), rescueOrg: 'Second Chance Paws (fictional)', concerns: ['Recall', 'Leash walking'], safetyNotes: [], summary: 'Fostered by Alex, adopted by Tess in the summer. Zoomy, social, selective hearing.', status: 'active' },
  { id: 'd_pierogi', name: 'Pierogi', breed: 'Dachshund', sex: 'male', altered: true, birthDate: iso(-365 * 11), weightLbs: 14, householdId: 'hh_kowalski', acquisition: 'Breeder', concerns: ['Barking'], safetyNotes: [], summary: 'Graduated after window-barking plan. Check in yearly.', status: 'graduated' },
  { id: 'd_olive', name: 'Olive', breed: 'Terrier mix', sex: 'female', ageNote: 'about 2', householdId: 'hh_fitzgerald', concerns: ['Leash walking', 'Reactivity'], safetyNotes: [], summary: 'Inquiry only — not yet assessed.', status: 'active' },
  { id: 'd_sesame', name: 'Sesame', breed: 'Australian shepherd', sex: 'male', altered: true, birthDate: iso(-365 * 3), weightLbs: 47, coat: 'Blue merle', householdId: 'hh_haddad', acquisition: 'Breeder', concerns: ['Reactivity'], safetyNotes: [{ level: 'caution', text: 'Lunges at skateboards and bikes; has pulled Nadia over once.' }], summary: 'Motion-reactive (bikes, skateboards). Lovely with dogs.', status: 'active' },
  { id: 'd_zaatar', name: 'Za’atar', breed: 'Greyhound', sex: 'female', altered: true, birthDate: iso(-365 * 5), weightLbs: 60, householdId: 'hh_haddad', acquisition: 'Rescue or shelter', rescueOrg: 'Retired racer adoption group (fictional)', concerns: ['Fear or anxiety'], safetyNotes: [{ level: 'caution', text: 'May startle-snap if woken suddenly (sleep startle). Call her name before touching her on her bed.' }], summary: 'Retired racer, still learning stairs and city noise.', status: 'active' },
  { id: 'd_hazel', name: 'Hazel', breed: 'Labrador mix', sex: 'female', altered: true, birthDate: iso(-365 * 4), weightLbs: 58, householdId: 'hh_thompson', acquisition: 'Rescue or shelter', concerns: ['Separation-related behavior'], safetyNotes: [], summary: 'Virtual client. Panting and pacing when alone; now settles for 25 minutes on camera.', status: 'active' },
  { id: 'd_ziggy', name: 'Ziggy', breed: 'Siberian husky', sex: 'male', altered: true, birthDate: iso(-365 * 3), householdId: 'hh_morales', acquisition: 'Breeder', concerns: ['Recall'], safetyNotes: [], summary: 'Two sessions on recall in 2025. Inactive.', status: 'archived', archived: true },
];

const links = [
  ['c_maya', 'd_juniper', 'guardian', true, -540],
  ['c_jordan', 'd_juniper', 'co-guardian', false, -540],
  ['c_maya', 'd_pickles', 'guardian', true, -365 * 4],
  ['c_jordan', 'd_pickles', 'co-guardian', false, -365 * 2],
  ['c_chidi', 'd_biscuit', 'guardian', true, -190],
  ['c_siobhan', 'd_theo', 'guardian', true, -365 * 5 + 60],
  ['c_priya', 'd_mango', 'guardian', true, -400],
  ['c_sam', 'd_mango', 'co-guardian', false, -400],
  ['c_priya', 'd_lentil', 'guardian', true, -365 * 3],
  ['c_sam', 'd_lentil', 'co-guardian', false, -365 * 3],
  ['c_kenji', 'd_mochi', 'guardian', true, -470],
  ['c_renee', 'd_bruno', 'guardian', true, -365 * 4],
  ['c_alex', 'd_clementine', 'foster', true, -24],
  ['c_alex', 'd_rocket', 'foster', false, -200, -120],
  ['c_tess', 'd_rocket', 'guardian', true, -120],
  ['c_marta', 'd_pierogi', 'guardian', true, -365 * 9],
  ['c_liam', 'd_olive', 'guardian', true, -700],
  ['c_nadia', 'd_sesame', 'guardian', true, -365 * 2],
  ['c_nadia', 'd_zaatar', 'guardian', true, -300],
  ['c_ben', 'd_hazel', 'guardian', true, -365 * 2],
  ['c_dani', 'd_ziggy', 'guardian', true, -365 * 2],
];

// ── Assessment profiles (compact → full responses) ─────────────────────────
const A = (value, source) => ({ status: 'answered', value, ...(source ? { source } : {}) });
const NA = { status: 'notApplicable', value: null };
const NOT = { status: 'notAssessed', value: null };

function responses(p) {
  const r = {
    hh_acquired_from: A(p.from, 'reported'),
    hh_members: A(p.members, 'reported'),
    hh_children: A(p.children ? 'yes' : 'no', 'reported'),
    ...(p.children ? { hh_children_detail: A(p.children, 'reported') } : {}),
    hh_other_animals: A(p.otherAnimals ?? [], 'reported'),
    hh_home_type: A(p.home, 'reported'),
    hh_routine: A(p.routine, 'reported'),
    hh_alone_time: A(p.alone ?? 4, 'reported'),
    hh_exercise: A(p.exercise ?? 'Two 30-minute walks, one longer weekend outing.', 'reported'),
    hh_enrichment: A(p.enrichment ?? ['Food puzzles', 'Chews'], 'reported'),
    co_reason: A(p.reason, 'reported'),
    co_main_concerns: A(p.concerns, 'reported'),
    co_description: A(p.description, 'reported'),
    co_onset: A(p.onset ?? 'Gradual over the past year.', 'reported'),
    co_frequency: A(p.frequency ?? 'Daily', 'reported'),
    co_context: A(p.context ?? '', 'reported'),
    co_goals: A(p.goals, 'reported'),
    co_priorities: A(p.priorities ?? [], 'reported'),
    md_vet: A(p.vet ?? 'Primary vet on file', 'reported'),
    md_conditions: p.conditions ? A(p.conditions, 'reported') : NOT,
    md_medications: A(p.meds ?? [], 'reported'),
    md_behavior_meds: A(p.behaviorMeds ? 'yes' : 'no', 'reported'),
    ...(p.behaviorMeds ? { md_behavior_meds_detail: A(p.behaviorMeds, 'reported') } : {}),
    md_pain_signs: A(p.pain ?? ['None noticed'], 'reported'),
    md_vet_involved: A(p.vetInvolved ?? 'Not yet', 'reported'),
    md_previous_training: A(p.previousTraining ?? 'Group puppy class.', 'reported'),
    md_previous_tools: A(p.tools ?? ['Harness'], 'reported'),
    tr_known: A(p.triggers, p.triggersSource ?? 'reported'),
    tr_contexts: A(p.contexts ?? '', 'reported'),
    tr_distance: A(p.distance ?? 'Varies', 'observed'),
    tr_body_language: A(p.body ?? [], 'observed'),
    tr_response: A(p.response ?? '', 'reported'),
    tr_recovery: A(p.recovery ?? 'A few minutes with sniffing.', 'observed'),
    tr_antecedents: A(p.antecedents ?? '', 'reported'),
    tr_consequences: A(p.consequences ?? '', 'reported'),
    tr_predictability: A(p.predictable ?? 'Somewhat predictable', 'reported'),
    sf_bite_history: A(p.bite ? 'yes' : 'no', 'reported'),
    ...(p.bite ? { sf_incidents: A(p.bite, 'reported'), sf_target: A(p.biteTarget ?? [], 'reported'), sf_injury: A(p.injury ?? 'No injury reported.', 'reported') } : {}),
    sf_handling_risks: p.handlingRisks ? A(p.handlingRisks, 'reported') : NA,
    sf_management: A(p.management ?? ['None yet'], 'reported'),
    sf_precautions: A(p.precautions ?? 'Standard management while we work.', 'observed'),
    sf_referral: A(p.referral ?? ['None at this time'], 'observed'),
    sk_cues: A(p.cues ?? ['Sit — reliable at home', 'Down — at home only'], 'observed'),
    sk_reinforcers: A(p.reinforcers ?? ['Soft treats', 'Sniffing'], 'observed'),
    sk_food_motivation: A(p.food ?? 'Takes food readily everywhere', 'observed'),
    sk_handling: A(p.handling ?? 'Tolerates gentle handling of body; paws are sensitive.', 'observed'),
    ob_observed: A(p.observed, 'observed'),
    ob_reported_summary: A(p.reported ?? p.description, 'reported'),
    ob_environment: A(p.environment ?? '', 'observed'),
    ob_stress: A(p.stress ?? ['Lip licking', 'Scanning'], 'observed'),
    ob_hypotheses: A(p.hypotheses, 'observed'),
    ob_further: A(p.further ?? '', 'observed'),
    rc_management: A(p.rcManagement, 'observed'),
    rc_goals: A(p.rcGoals, 'observed'),
    rc_exercises: A(p.rcExercises, 'observed'),
    rc_homework: A(p.rcHomework, 'observed'),
    rc_followup: A(p.rcFollowup ?? 'Follow-up session in 2 weeks', 'observed'),
    rc_success: A(p.rcSuccess, 'observed'),
    ...(p.extra ?? {}),
  };
  return r;
}

const profiles = {
  d_juniper: {
    from: 'Rescue or shelter', members: ['Maya (32)', 'Jordan (34)'], otherAnimals: ['Pickles, 7yo chihuahua mix — tense around chews'], home: 'Apartment — walk-up',
    routine: '7am walk (Maya), crate-free while home, midday walker, 6pm walk (Jordan), training games after dinner.', alone: 5,
    reason: 'Juniper lunges and barks at dogs on walks; Maya was pulled off her feet in January. Also a fight with Pickles over a bully stick in March.',
    concerns: ['Reactivity', 'Multi-dog household conflict', 'Leash walking'],
    description: 'On leash she fixates, stiffens, then lunges and barks at dogs approaching on the same sidewalk. Off leash at a friend’s yard she played well with a calm male dog.',
    context: 'Narrow Astoria sidewalks, corners where dogs appear suddenly, evenings.', goals: 'Walk around the block in the evening without lunging; Juniper and Pickles relaxed in the same room with chews.',
    priorities: ['Safe walks', 'Peace between the dogs', 'Loose leash'], triggers: ['Other dogs', 'Food or objects'], distance: 'About half a block when the dog is approaching head-on; across the street is usually OK.',
    body: ['Hard stare', 'Weight shifted forward', 'Tail high and stiff', 'Barking', 'Lunging'], response: 'Freezes and stares, then lunges with barking; redirects to the leash if held tight.',
    antecedents: 'Dog appears at a corner within 30 feet; tight leash.', consequences: 'Maya pulls her back and walks away fast; other dog leaves.', bite: null,
    management: ['Baby gates', 'Walk at quiet times'], precautions: 'Separate chews in different rooms; gate between dogs during unsupervised time.',
    observed: 'On our walk Juniper noticed a dog at roughly 60 feet, oriented for 2 seconds, then took food and followed a U-turn. Closer than 40 feet she stopped taking treats.',
    hypotheses: 'Frustration plus some fear on leash; resource competition indoors heightened by Pickles’ guarding.',
    rcManagement: 'Walk at quieter times and choose wide streets. Use U-turns early. Chews only when the dogs are separated by a gate.',
    rcGoals: ['Notice dogs at a distance and re-engage with Maya', 'Calm coexistence with Pickles during chew time', 'Loose-leash walking on the block'],
    rcExercises: ['Engage–Disengage game', '1-2-3 pattern walking', 'Emergency U-turn', 'Mat settle with chews behind a gate'],
    rcHomework: 'Practice pattern walking 5 minutes daily indoors, then in the hallway. Log every dog sighting: distance and whether she took food.',
    rcSuccess: ['Takes food and looks back at Maya with a dog across the street', 'Recovers within 10 seconds after a sighting', 'Both dogs chew in the same room with a gate between them, no stiffening'],
  },
  d_pickles: {
    from: 'Previous owner / rehome', members: ['Maya', 'Jordan'], otherAnimals: ['Juniper, 3yo pit mix'], home: 'Apartment — walk-up', routine: 'Short walks, sleeps most of the day on the couch.',
    reason: 'Pickles growls and snaps at Juniper when she comes near his chews or the couch. One scuffle in March.', concerns: ['Resource guarding', 'Multi-dog household conflict'],
    description: 'Stiffens over chews, hard eye, growls; snapped at Juniper once when she sniffed his bully stick.', goals: 'No more fights; Pickles can enjoy chews safely.',
    triggers: ['Food or objects', 'Being approached while resting'], body: ['Freezing / stillness', 'Hard stare', 'Growling', 'Lip lift / snarl'],
    bite: 'March: snapped at Juniper over a bully stick; Juniper retaliated. Brief scuffle, separated by Jordan with a cushion.', biteTarget: ['Another dog in household'], injury: 'Small scratch on Pickles’ ear; vet checked, no treatment needed.',
    handlingRisks: 'Guards the couch; do not lift him off while he is resting.', management: ['Baby gates', 'Separate rooms'],
    observed: 'Pickles stiffened when I walked past at 4 feet while he had a chew; relaxed when I tossed a treat and kept moving.',
    hypotheses: 'Guarding likely driven by age-related discomfort plus history of competition. Vet check for dental pain recommended.', referral: ['Veterinary exam', 'Pain workup'],
    rcManagement: 'High-value chews only behind a gate. Ramp to the couch so he can choose to get down.', rcGoals: ['Relaxed when people pass while he has a chew', 'Willing trades for low and medium value items'],
    rcExercises: ['Drive-by treat tossing', 'Trade-up game'], rcHomework: 'Ten drive-bys a day while he has a low-value chew.', rcSuccess: ['Keeps eating, soft body, when someone passes at 3 feet', 'Drops a toy for a trade without stiffening'],
  },
  d_theo: {
    from: 'Breeder', members: ['Siobhan'], home: 'Apartment — elevator building', routine: 'Long morning walk in the park, quiet day, evening sniff walk.', alone: 3,
    reason: 'Theo bit a groomer last year during a nail trim, and vet visits now need sedation. Siobhan wants to do basic care at home safely.', concerns: ['Handling / cooperative care', 'Fear or anxiety'],
    description: 'Freezes, then whips his head toward hands when paws or ears are handled. Fine with being petted when he solicits it.', goals: 'Trim nails at home without sedation; vet exams with only a muzzle.',
    triggers: ['Being handled', 'Vet or grooming'], body: ['Freezing / stillness', 'Whale eye', 'Lip licking', 'Ears pinned back'], bite: '2025: bit a groomer during restraint for nail trim. Single puncture to the hand.', biteTarget: ['Vet or groomer'], injury: 'Single puncture (reported as Level 3); groomer received first aid.',
    handlingRisks: 'Restraint of any kind, paws, ears, collar grabs.', management: ['Muzzle (conditioned)'], vetInvolved: 'Yes', behaviorMeds: 'Pre-visit gabapentin prescribed by Dr. Lin (fictional).', meds: ['Gabapentin — before vet visits only'],
    observed: 'Theo offered a chin rest on the towel for 3 seconds. When I moved my hand toward his paw he lifted his head off the rest (his stop signal), and settled again when I paused.',
    hypotheses: 'Learned that struggling ends handling; consent-based protocol should lower stakes.', referral: ['Veterinary behaviorist'],
    rcManagement: 'No nail trims or grooming for now beyond what he consents to. Muzzle for vet visits.', rcGoals: ['Chin-rest consent for paw handling', 'Nail trims at home with a file board', 'Calm vet exams with muzzle'],
    rcExercises: ['Chin rest (bucket game)', 'Scratch board for front nails', 'Muzzle wear games'], rcHomework: 'Three 2-minute chin-rest sessions daily. Stop the moment he lifts his chin.', rcSuccess: ['Holds chin rest 10 seconds while a paw is touched', 'Files two nails on the board unprompted'],
    extra: { cc_procedures: A(['Nail trims', 'Ear cleaning', 'Vet exam'], 'reported'), cc_consent: A('Chin rest on a towel, 3–5 seconds', 'observed') },
  },
  d_mango: {
    from: 'Rescue or shelter', members: ['Priya', 'Sam', 'Noor (6)'], children: 'Noor (6) plays chase games in the hallway; Mango chases and nips at her ankles.', otherAnimals: ['Lentil, 4yo beagle'], home: 'Apartment — elevator building', routine: 'Dog walker midday; fetch in the park after school.',
    reason: 'Mango nips at Noor’s feet when she runs. No broken skin, but Noor is getting scared.', concerns: ['Jumping / mouthing', 'Fear or anxiety'], description: 'When Noor runs or spins, Mango chases, barks and nips at ankles and clothing.', goals: 'Noor can play safely; Mango has better outlets for her energy.',
    triggers: ['Children', 'Other'], body: ['Barking', 'Weight shifted forward'], bite: null, management: ['Baby gates'], precautions: 'Gate during Noor’s active play; Noor practices “be a tree”.',
    observed: 'Mango tracked Noor’s movement intently and orbited her. Easily redirected to a flirt pole and settled on her mat with a lick mat.', hypotheses: 'Herding-type chase behavior; under-employed in the afternoon.',
    rcManagement: 'Gate or leash during active kid play. Daily herding-style outlets.', rcGoals: ['Settles on mat when Noor plays', 'Daily appropriate chase outlet'], rcExercises: ['Mat settle', 'Flirt pole with rules', 'Treat scatter when Noor runs'],
    rcHomework: 'Two flirt-pole sessions a day. Practice mat with Noor walking, then skipping.', rcSuccess: ['Stays on mat while Noor walks past', 'No nips during supervised play for a week'],
  },
  d_mochi: {
    from: 'Breeder', members: ['Kenji'], home: 'Apartment — elevator building', routine: 'Kenji works hybrid, in office Mon/Wed/Fri.', alone: 8,
    reason: 'Neighbors complained about barking; camera shows Mochi crying and scratching the door within minutes of Kenji leaving.', concerns: ['Separation-related behavior'],
    description: 'Vocalizing and scratching at the door; refuses food when alone.', goals: 'Mochi can stay home alone for a workday calmly.', triggers: ['Being left alone'], body: ['Pacing', 'Vocalizing'],
    bite: null, management: ['Dog walker'], observed: 'Watched live camera: whining at 90 seconds, scratching at 2 minutes. Settled within 30 seconds of Kenji’s return.',
    hypotheses: 'Isolation distress; fine with any person present.', rcManagement: 'Suspend absences beyond threshold — daycare on office days.', rcGoals: ['Relaxed alone for 30 minutes', 'Relaxed alone for 2 hours'],
    rcExercises: ['Departure desensitization', 'Mat relaxation protocol'], rcHomework: 'Daily departure practice below threshold; log on the shared sheet.', rcSuccess: ['Lies down within 2 minutes of departure on camera', 'No vocalizing for the whole absence'],
    extra: { se_signs: A(['Vocalizing', 'Destruction near exits', 'Not eating'], 'observed'), se_video: A('yes', 'reported'), se_video_notes: A('Whining 1:30, scratching 2:00, howling by 5:00.', 'observed'), se_any_person: A('Yes, anyone', 'reported'), se_coverage: A(['Daycare', 'Dog sitter'], 'reported') },
  },
  d_bruno: {
    from: 'Rescue or shelter', members: ['Renée', 'Marcus (weekends)'], home: 'Townhouse / brownstone', routine: 'Backyard access, two walks a day, quiet house.',
    reason: 'After moving, Bruno is barking and lunging at visitors again. He air-snapped at a delivery worker last month.', concerns: ['Aggression', 'Barking', 'Fear or anxiety'], description: 'Barks, hackles up, rushes the door when anyone arrives; settles once guests sit for 10+ minutes.',
    goals: 'Visitors can come in safely; Bruno stays relaxed behind a gate.', triggers: ['Unfamiliar people', 'Door / visitors'], body: ['Raised hackles', 'Barking', 'Lunging', 'Hard stare'],
    bite: 'Last month: air snap toward a delivery worker who reached over the gate. No contact.', biteTarget: ['Stranger'], injury: 'No contact.', handlingRisks: 'Avoid reaching over his head; collar grabs make him freeze.', management: ['Baby gates', 'Visitors restricted', 'Muzzle (not yet conditioned)'],
    observed: 'Behind the gate Bruno barked for 40 seconds, then took tossed treats. Ears relaxed once I sat sideways and ignored him.', hypotheses: 'Fear-based; the move removed familiar routines and his “safe room”.', referral: ['Veterinary exam'],
    rcManagement: 'Bruno behind the gate with a chew before the door opens. Delivery drop box outside.', rcGoals: ['Station on mat behind the gate when the doorbell rings', 'Calm greetings with familiar visitors'],
    rcExercises: ['Doorbell = treat pattern', 'Station / mat behind gate', 'Treat-and-retreat'], rcHomework: 'Ring the doorbell recording 10 times a day, toss treats to the mat.', rcSuccess: ['Goes to his mat on the doorbell without barking', 'Takes treats from a visitor sitting sideways'],
    extra: { ag_context: A(['Visitors entering'], 'reported'), ag_warning: A('Hard stare, closed mouth, stiff tail before barking.', 'observed'), ag_muzzle: A('In progress', 'observed') },
  },
  d_rocket: {
    from: 'Rescue or shelter', members: ['Tess', 'Ollie (roommate)'], home: 'Apartment — walk-up', routine: 'Long weekend park visits; dog run.',
    reason: 'Rocket doesn’t come back at the dog run and pulls hard on leash.', concerns: ['Recall', 'Leash walking'], description: 'Ignores recall when playing; pulls toward smells and dogs.', goals: 'Reliable recall at the dog run.', triggers: ['Other dogs'], body: [],
    bite: null, observed: 'Rocket responded to his name 4/5 times in the hallway, 1/5 at the run entrance.', hypotheses: 'Recall poisoned by being called to leave; low value reinforcement.',
    rcManagement: 'Long line in the park; leave the run only after calm recalls.', rcGoals: ['Recall from play at the run', 'Loose leash on the block'], rcExercises: ['Recall game with new cue “Pup pup!”', 'Silky leash'], rcHomework: 'Ten recalls a day with chicken; never call for something unpleasant.', rcSuccess: ['Comes away from play 4/5 times at the run', 'Walks one block on a loose leash'],
  },
  d_hazel: {
    from: 'Rescue or shelter', members: ['Ben'], home: 'Apartment — elevator building', routine: 'Ben works from home most days.', alone: 1,
    reason: 'Hazel pants and paces when Ben leaves even briefly; he can’t go to the gym.', concerns: ['Separation-related behavior'], description: 'Pacing and panting starts within 5 minutes alone.', goals: 'Ben can leave for 90 minutes.',
    triggers: ['Being left alone'], bite: null, observed: 'On video: settled for 6 minutes, then paced near door. Calm when Ben returned.', hypotheses: 'Mild isolation distress; responds well to gradual absences.',
    rcManagement: 'Absences only within comfortable duration; sitter for longer.', rcGoals: ['Settled alone for 45 minutes', 'Settled alone for 90 minutes'], rcExercises: ['Graduated departures', 'Enrichment before leaving'], rcHomework: 'Daily absences, film each one, share in folder.', rcSuccess: ['Lies down within 5 minutes and stays down', 'No pacing for the full absence'],
  },
  d_sesame: {
    from: 'Breeder', members: ['Nadia', 'Omar'], otherAnimals: ['Za’atar, 5yo greyhound'], home: 'House with yard', routine: 'Shore Road walks morning and evening.',
    reason: 'Sesame lunges at skateboards and bikes along Shore Road and pulled Nadia over.', concerns: ['Reactivity'], description: 'Crouches, stares, then lunges and barks at fast-moving wheels.', goals: 'Enjoy Shore Road walks again.',
    triggers: ['Bikes / scooters'], body: ['Freezing / stillness', 'Hard stare', 'Lunging'], bite: null, observed: 'Noticed a scooter at 80 feet, took food; at 30 feet he froze and could not disengage.', hypotheses: 'Motion-triggered herding behavior plus excitement.',
    rcManagement: 'Walk away from the bike path; use side streets for now.', rcGoals: ['Disengage from bikes at 50 feet', 'Loose leash on side streets'], rcExercises: ['Look at That', 'Find it scatter'], rcHomework: 'LAT sessions at the park bench far from the path, 5 minutes daily.', rcSuccess: ['Looks at a bike and back to Nadia at 50 feet', 'Recovers within 5 seconds'],
  },
  d_clementine: {
    from: 'Foster (current)', members: ['Alex (foster)'], home: 'Apartment — walk-up', routine: 'Short quiet walks at dawn; lots of sleep.',
    reason: 'Clementine shuts down on busy streets and won’t eat outside. Rescue wants her adoption-ready.', concerns: ['Rescue transition / decompression', 'Fear or anxiety'], description: 'Tail tucked, freezes on busy blocks, refuses food; relaxed and playful indoors.', goals: 'Comfortable on quieter streets; ready for adoption meet-and-greets.',
    triggers: ['Loud noises', 'Unfamiliar people'], body: ['Tail tucked', 'Freezing / stillness', 'Avoidance / turning away'], bite: null, observed: 'Indoors: soft, wiggly. Outside: froze at a truck passing; recovered after 2 minutes sniffing a planter.', hypotheses: 'Under-socialized to urban environment; still decompressing.',
    rcManagement: 'Dawn walks on quiet blocks; let her choose to turn home.', rcGoals: ['Takes food on her home block', 'Explores a quiet park for 10 minutes'], rcExercises: ['Sniffaris', 'Treat scatter at the doorstep'], rcHomework: 'Doorstep sniff sessions twice a day; stop if she won’t eat.', rcSuccess: ['Eats treats on the doorstep', 'Loose tail while sniffing a new block'],
  },
  d_pierogi: {
    from: 'Breeder', members: ['Marta'], home: 'Apartment — walk-up', routine: 'Retired life.', reason: 'Barking at the window at every passer-by.', concerns: ['Barking'], description: 'Barks at people passing below the window.', goals: 'Quiet afternoons.',
    triggers: ['Unfamiliar people'], body: ['Barking'], bite: null, observed: 'Barked 3 times then came for a treat on cue.', hypotheses: 'Alert barking reinforced by people leaving.', rcManagement: 'Window film on the lower pane.', rcGoals: ['Quiet at the window'], rcExercises: ['Thank-you cue'], rcHomework: 'Practice “thank you” at the window.', rcSuccess: ['Two barks max then checks in'],
  },
};

const EXERCISES = {
  'Engage–Disengage game': '1. Stand well away from where dogs pass.\n2. When your dog looks at a dog, mark ("yes") and feed.\n3. When they look at the dog and then back to you on their own, mark and jackpot.\n4. If they stop eating, add distance.',
  '1-2-3 pattern walking': 'Count "1, 2, 3" out loud and feed on 3, at your knee, in a steady rhythm. Practice indoors until boring, then use it when a trigger appears.',
  'Emergency U-turn': 'Say "this way!" in a happy voice, turn, and jog a few steps away; reward when your dog catches up.',
  'Mat settle with chews behind a gate': 'Each dog on their own mat, gate between. Chews only during these sessions. End before anyone gets up to investigate.',
  'Drive-by treat tossing': 'Walk past at a comfortable distance and toss a tasty treat near (not at) your dog while they have a chew. Keep walking.',
  'Trade-up game': 'Offer something better, let them choose to drop, then give the item back most of the time.',
  'Chin rest (bucket game)': 'Reward chin on the towel. Chin lifted = all handling stops. Build seconds before adding touch.',
  'Scratch board for front nails': 'Sandpaper board at a slight angle. Reward each scratch.',
  'Muzzle wear games': 'Squeeze cheese inside the basket; nose in = treat. Build duration in tiny steps.',
  'Mat settle': 'Reward calm on the mat; gradually add distractions.',
  'Flirt pole with rules': 'Chase on cue, "drop" ends a round, a sit restarts it. Two minutes is plenty.',
  'Departure desensitization': 'Practice leaving steps (keys, shoes, door) in tiny pieces your dog can ignore. Never go past calm.',
  'Mat relaxation protocol': 'Daily short sessions of rewarding relaxation on the mat with small movements away.',
  'Doorbell = treat pattern': 'Play the doorbell sound, then toss treats to the mat. Repeat until the bell makes your dog look for the mat.',
  'Station / mat behind gate': 'Mat behind the gate with a chew ready before any visitor arrives.',
  'Treat-and-retreat': 'Visitor tosses a treat behind your dog so they can move away to eat, then choose to come back.',
  'Look at That': 'Mark the moment your dog looks at the trigger, then feed. Stay far enough away that they can eat.',
  'Find it scatter': 'Scatter a handful of treats on the ground to help your dog decompress.',
  'Sniffaris': 'Slow, dog-led walks where sniffing is the point.',
  'Treat scatter at the doorstep': 'Sit on the stoop and scatter treats; leave before she stops eating.',
  'Thank-you cue': 'After one or two barks, say "thank you" and reward checking in with you.',
};

// ── Run ────────────────────────────────────────────────────────────────────
if (process.argv.includes('--reset')) await reset();

uid = await ensureUser(DEMO_USERS.haley);
await ensureUser(DEMO_USERS.intruder);
await db.doc(`authorizedUsers/${uid}`).set({ email: DEMO_USERS.haley.email, displayName: DEMO_USERS.haley.displayName, role: 'owner', active: true });

put('assessmentTemplates', 'master', { ...MASTER_TEMPLATE, currentVersion: 1, currentVersionId: 'master_v1', archived: false }, -90);
put('assessmentTemplateVersions', 'master_v1', { ...MASTER_TEMPLATE, templateId: 'master', version: 1, changeNote: 'Initial master template', archived: false }, -90);

households.forEach((h) => put('households', h.id, h, -200));
clients.forEach((c) => put('clients', c.id, { archived: false, ...c }, -150));
dogs.forEach((d) => put('dogs', d.id, { archived: false, ...d }, -150));
links.forEach(([clientId, dogId, role, isPrimary, start, end], i) => put('clientDogs', `link_${i}`, { clientId, dogId, role, isPrimary, startDate: iso(start), endDate: end ? iso(end) : null }, -150));

const clientsOf = (dogId) => links.filter((l) => l[1] === dogId && !l[5]).map((l) => l[0]);
const modulesFor = (concerns) => MASTER_TEMPLATE.modules.filter((m) => m.suggestedFor?.some((c) => concerns.includes(c))).map((m) => m.id);

// Initial assessments (complete) with dated history.
const initialDates = { d_juniper: -84, d_pickles: -84, d_theo: -70, d_mango: -56, d_mochi: -63, d_bruno: -35, d_rocket: -49, d_hazel: -42, d_sesame: -21, d_clementine: -17, d_pierogi: -400 };
for (const [dogId, p] of Object.entries(profiles)) {
  const r = responses(p);
  for (const k of Object.keys(r)) if (r[k] === undefined) delete r[k];
  const id = `a_${dogId.slice(2)}_initial`;
  const data = { dogId, clientIds: clientsOf(dogId), templateId: 'master', templateVersionId: 'master_v1', templateVersion: 1, mode: 'initial', status: 'complete', date: iso(initialDates[dogId]), enabledModules: modulesFor(p.concerns), responses: r, privateNotes: p.hypotheses, previousAssessmentId: null, revision: 1, completedAt: at(initialDates[dogId], 16) };
  put('assessments', id, data, initialDates[dogId]);
  writes.push([`assessments/${id}/revisions/r1`, { assessmentId: id, revision: 1, reason: 'Completed', status: 'complete', enabledModules: data.enabledModules, responses: r, privateNotes: data.privateNotes, ...meta(initialDates[dogId]) }]);
}

// Follow-up assessments.
const followUpAssessments = [
  { dogId: 'd_juniper', days: -21, changes: 'Walks are calmer. Juniper takes food with dogs across the street most days. Two lunges this week, both at corners. No conflict with Pickles since the gate routine started.', observed: 'Engaged with Maya at 35 feet from a passing dog; one bark then turned back on her own.' },
  { dogId: 'd_bruno', days: -7, changes: 'Doorbell practice daily. Bruno goes to the gate on his own. Still barks at Marcus’s friends.', observed: 'Barked twice when I arrived, then lay on his mat within a minute.' },
  { dogId: 'd_mochi', days: -14, changes: 'Comfortable alone time up to 20 minutes on camera. Daycare on office days is working.', observed: 'Video: lay down at 3 minutes, chewed her Kong, one short whine at 14 minutes.' },
];
for (const f of followUpAssessments) {
  const id = `a_${f.dogId.slice(2)}_followup`;
  const base = responses(profiles[f.dogId]);
  const r = {
    co_main_concerns: base.co_main_concerns,
    co_description: base.co_description,
    co_goals: base.co_goals,
    co_reason: A('Scheduled follow-up assessment.', 'reported'),
    co_changes_since: A(f.changes, 'reported'),
    tr_known: base.tr_known,
    sf_bite_history: base.sf_bite_history,
    ...(base.sf_incidents ? { sf_incidents: base.sf_incidents } : {}),
    hh_members: base.hh_members,
    hh_routine: base.hh_routine,
    ob_observed: A(f.observed, 'observed'),
    rc_management: base.rc_management,
    rc_goals: base.rc_goals,
    rc_success: base.rc_success,
    sk_progress: A('Steady progress on the first goal; second goal started.', 'observed'),
    md_conditions: NOT,
  };
  put('assessments', id, { dogId: f.dogId, clientIds: clientsOf(f.dogId), templateId: 'master', templateVersionId: 'master_v1', templateVersion: 1, mode: 'followUp', status: 'complete', date: iso(f.days), enabledModules: modulesFor(profiles[f.dogId].concerns), responses: r, privateNotes: '', previousAssessmentId: `a_${f.dogId.slice(2)}_initial`, revision: 1, completedAt: at(f.days, 17) }, f.days);
  writes.push([`assessments/${id}/revisions/r1`, { assessmentId: id, revision: 1, reason: 'Completed', status: 'complete', enabledModules: [], responses: r, privateNotes: '', ...meta(f.days) }]);
}

// Drafts in progress.
put('assessments', 'a_biscuit_initial', { dogId: 'd_biscuit', clientIds: ['c_chidi'], templateId: 'master', templateVersionId: 'master_v1', templateVersion: 1, mode: 'initial', status: 'draft', date: iso(-2), enabledModules: ['mod_puppy'], responses: { hh_acquired_from: A('Breeder', 'reported'), hh_members: A(['Chidi', 'Ada (9)'], 'reported'), hh_children: A('yes', 'reported'), hh_children_detail: A('Ada (9) — Biscuit mouths her sleeves when she comes home from school.', 'reported'), co_main_concerns: A(['Puppy development', 'Jumping / mouthing'], 'reported') }, privateNotes: '', previousAssessmentId: null, revision: 1, completedAt: null }, -2);

// ── Training plans, goals, progress ────────────────────────────────────────
const planFor = { d_juniper: -80, d_pickles: -80, d_theo: -66, d_mango: -52, d_mochi: -60, d_bruno: -33, d_rocket: -45, d_hazel: -40, d_sesame: -19, d_clementine: -15 };
const milestoneSets = {
  d_juniper: [['Takes food with dogs across a wide street', 'Disengages at 50 ft', 'Disengages at 30 ft', 'Passes on same sidewalk with a parked car between'], ['Chews in separate rooms calmly', 'Chews with gate between, relaxed', 'Rests in same room after chews']],
  d_theo: [['Chin rest 5 seconds', 'Chin rest with paw touch', 'Chin rest with nail clipper present', 'One nail trimmed'], ['Wears muzzle for 5 minutes at home', 'Wears muzzle in vet lobby']],
  d_mochi: [['Alone 5 minutes calmly', 'Alone 15 minutes', 'Alone 30 minutes'], ['Alone 1 hour', 'Alone 2 hours']],
  d_bruno: [['Goes to mat on doorbell recording', 'Goes to mat on real doorbell', 'Stays on mat while door opens'], ['Takes treat from seated visitor', 'Sniffs a seated visitor and returns to mat']],
  d_rocket: [['Recall in hallway 5/5', 'Recall on long line in park', 'Recall from play at run']],
  d_hazel: [['Alone 15 minutes', 'Alone 30 minutes', 'Alone 45 minutes'], ['Alone 60 minutes', 'Alone 90 minutes']],
};
const reached = { d_juniper: [3, 2], d_theo: [2, 2], d_mochi: [2, 0], d_bruno: [2, 0], d_rocket: [2], d_hazel: [2, 0], d_pickles: [1, 0], d_mango: [1, 0], d_sesame: [1, 0], d_clementine: [1, 0] };

const goalsByDog = {};
for (const [dogId, startDays] of Object.entries(planFor)) {
  const p = profiles[dogId];
  const dog = dogs.find((d) => d.id === dogId);
  const planId = `p_${dogId.slice(2)}`;
  put('trainingPlans', planId, { dogId, title: `${dog.name}’s training plan`, status: 'active', startDate: iso(startDays), reviewDate: iso(startDays + 84), summary: `${p.goals} We’ll build skills in small, successful steps, always below ${dog.name}’s comfort threshold.`, management: p.rcManagement, assessmentId: `a_${dogId.slice(2)}_initial` }, startDays);
  goalsByDog[dogId] = [];
  p.rcGoals.forEach((title, i) => {
    const goalId = `g_${dogId.slice(2)}_${i + 1}`;
    const ms = (milestoneSets[dogId]?.[i] ?? [`First step toward: ${title.toLowerCase()}`, 'Practiced in a new location', 'Reliable for a week']).map((label, mi) => ({ label, reachedOn: mi < (reached[dogId]?.[i] ?? 0) ? iso(startDays + 10 + mi * 12) : null }));
    const status = ms.every((m) => m.reachedOn) ? 'achieved' : ms.some((m) => m.reachedOn) ? 'inProgress' : 'notStarted';
    put('goals', goalId, {
      planId, dogId, title, priority: i + 1, why: i === 0 ? p.goals : undefined,
      successCriteria: i === 0 ? p.rcSuccess : [p.rcSuccess[p.rcSuccess.length - 1]],
      exercises: p.rcExercises.slice(i, i + 2).map((name) => ({ name, instructions: EXERCISES[name] ?? 'Short sessions, high-value treats, stop before your dog gets worried.' })),
      homework: i === 0 ? p.rcHomework : undefined, status, milestones: ms,
    }, startDays);
    goalsByDog[dogId].push({ goalId, planId, ms });
  });
}
// Completed plan for the graduate.
put('trainingPlans', 'p_pierogi', { dogId: 'd_pierogi', title: 'Pierogi’s window plan', status: 'completed', startDate: iso(-395), reviewDate: iso(-300), summary: 'Quiet afternoons at the window.', management: 'Window film on the lower pane.', assessmentId: 'a_pierogi_initial' }, -395);
put('goals', 'g_pierogi_1', { planId: 'p_pierogi', dogId: 'd_pierogi', title: 'Quiet at the window', priority: 1, successCriteria: ['Two barks max then checks in'], exercises: [{ name: 'Thank-you cue', instructions: EXERCISES['Thank-you cue'] }], status: 'achieved', milestones: [{ label: 'Checks in after barking', reachedOn: iso(-360) }, { label: 'Quiet for a full afternoon', reachedOn: iso(-310) }] }, -395);

// ── Sessions (history) ─────────────────────────────────────────────────────
const sessions = [];
function session(id, dogIds, type, days, fields, goalNotes = []) {
  const planId = planFor[dogIds[0]] !== undefined ? `p_${dogIds[0].slice(2)}` : null;
  sessions.push(id);
  put('consultations', id, {
    dogIds, clientIds: [...new Set(dogIds.flatMap(clientsOf))], type, date: iso(days), durationMinutes: type === 'checkIn' ? 20 : 60,
    location: type === 'virtual' ? 'Video call' : `Home · ${households.find((h) => h.id === dogs.find((d) => d.id === dogIds[0]).householdId).neighborhood}`,
    format: fields.freeformNotes ? 'freeform' : 'structured', planId, goalIds: goalNotes.map((g) => g[0]), appointmentId: `ap_${id}`, ...fields,
  }, days);
  put('appointments', `ap_${id}`, { dogIds, clientIds: [...new Set(dogIds.flatMap(clientsOf))], type, start: at(days, 10 + (sessions.length % 6)), durationMinutes: type === 'checkIn' ? 20 : 60, status: 'completed', consultationId: id, location: type === 'virtual' ? 'Zoom' : 'Home visit' }, days - 7);
  goalNotes.forEach(([goalId, observation, source], i) => {
    const g = Object.values(goalsByDog).flat().find((x) => x.goalId === goalId);
    put('progressObservations', `o_${id}_${i}`, { goalId, planId: g.planId, dogId: dogIds[0], date: iso(days), observation, source, consultationId: id, milestone: null }, days);
  });
}

session('s_juniper_1', ['d_juniper', 'd_pickles'], 'initial', -84, { observations: 'Met both dogs at home, then a short walk with Juniper. See assessment for detail. Juniper over threshold at ~40 ft; Pickles stiff around chews.', exercisesPracticed: 'Introduced pattern walking (1-2-3) indoors; drive-by treats for Pickles.', homework: 'Pattern walking 5 min/day indoors. Chews only in separate rooms.', nextSteps: 'Follow-up in 2 weeks: take pattern games outside.', privateNotes: 'Maya teared up describing the March fight. Lots of reassurance.' });
session('s_juniper_2', ['d_juniper'], 'followUp', -63, { changesSinceLast: 'Pattern walking solid indoors and in the hallway. Two big reactions on 31st St.', observations: 'Juniper did 1-2-3 smoothly on a quiet block. Saw a dog at 60 ft, took food, turned with Maya.', exercisesPracticed: 'Engage–Disengage at the schoolyard fence (no dogs), then with a neighbor’s calm dog at 70 ft.', homework: 'Engage–Disengage at 60+ ft, 3 sessions/week. Keep the sighting log.', nextSteps: 'Add U-turns.' }, [['g_juniper_1', 'Took food and re-engaged with a dog at 60 ft, three times in a row.', 'observed']]);
session('s_juniper_3', ['d_juniper'], 'followUp', -35, { changesSinceLast: 'Maya reports 4 of 5 sightings handled with food this week.', observations: 'At 35 ft she oriented, looked back at Maya without a cue. One bark at a corner surprise; recovered in 8 seconds.', exercisesPracticed: 'Emergency U-turn, parallel walking with a helper dog across the street.', homework: 'U-turn practice daily. Parallel walk with neighbor’s dog on Saturday.', nextSteps: 'Follow-up assessment in 2 weeks.' }, [['g_juniper_1', 'Looked back to Maya on her own at 35 ft; one bark at a corner surprise, recovered in ~8 seconds.', 'observed'], ['g_juniper_2', 'Both dogs chewed with the gate between them for 10 minutes, no stiffening (Jordan’s video).', 'reported']]);
session('s_juniper_4', ['d_juniper'], 'checkIn', -10, { freeformNotes: 'Quick text check-in with Maya. Juniper walked past the dog run on the far side of the street with no reaction! Pickles had his dental — two extractions. Guarding seems softer already. Asked Maya to keep chew sessions gated for two more weeks.' });
session('s_theo_1', ['d_theo'], 'initial', -70, { observations: 'Theo greeted me in the lobby, investigated, then ignored me. Chin rest attempts: offered 2–3 s on a towel.', exercisesPracticed: 'Chin rest shaping; muzzle check (fits well).', homework: 'Chin rest 3x/day, 2 minutes. Stop when chin lifts.', nextSteps: 'Add paw touch when chin rest reaches 8 s.', privateNotes: 'Siobhan blames herself for the groomer bite. The groomer used a noose.' });
session('s_theo_2', ['d_theo'], 'followUp', -42, { changesSinceLast: 'Chin rest up to 10 seconds. Muzzle on for walks around the block.', observations: 'Chin rest held while I touched his shoulder and leg; lifted chin when I touched the paw — paused, he returned.', exercisesPracticed: 'Paw touch on chin rest, scratch board intro.', homework: 'Scratch board: 1 stroke = jackpot.', nextSteps: 'Clipper visible during chin rest.' }, [['g_theo_1', 'Held chin rest through a paw touch on the second try after a pause.', 'observed']]);
session('s_theo_3', ['d_theo'], 'virtual', -14, { changesSinceLast: 'Filing 2 front nails on the board daily.', observations: 'On video Theo scratched the board 6 times, offered chin rest with clippers in view.', exercisesPracticed: 'Clipper presence, sound of clipping uncooked spaghetti.', homework: 'Clipper sound + treat. One real nail if chin stays down.', nextSteps: 'Vet visit prep: muzzle in the clinic lobby.' }, [['g_theo_1', 'Chin rest held with clippers in view; one nail trimmed with no stop signal.', 'observed'], ['g_theo_2', 'Wore muzzle in the vet lobby for 4 minutes, ate treats through it (Siobhan’s report).', 'reported']]);
session('s_mango_1', ['d_mango', 'd_lentil'], 'initial', -56, { observations: 'Mango orbited Noor during play; nipped a sock once. Lentil hid during building construction noise.', exercisesPracticed: 'Mat settle, flirt pole rules.', homework: 'Flirt pole 2x/day. Mat with Noor walking past.', nextSteps: 'Add kid-skipping distraction.' });
session('s_mango_2', ['d_mango'], 'followUp', -28, { changesSinceLast: 'No nips this week with the gate routine. Mat works with Noor walking.', observations: 'Mango stayed on mat while Noor walked and hopped; broke once when Noor ran.', exercisesPracticed: 'Treat scatter when Noor runs.', homework: 'Noor tosses treats to the mat (with adult).', nextSteps: 'Check-in by email in 2 weeks.' }, [['g_mango_1', 'Stayed on mat while Noor walked and hopped; broke when she ran.', 'observed']]);
session('s_mochi_1', ['d_mochi'], 'initial', -63, { observations: 'Mochi calm with me present. Camera at departure: whining 1:30.', exercisesPracticed: 'Door sequence below threshold.', homework: 'Departures under 60 seconds, 5x/day.', nextSteps: 'Daycare on office days.' });
session('s_mochi_2', ['d_mochi'], 'virtual', -35, { changesSinceLast: 'Up to 8 minutes alone on camera.', observations: 'Video: lay down at 2 min.', exercisesPracticed: 'Vary departure cues.', homework: 'Increase by 1–2 min only when calm.', nextSteps: 'Follow-up assessment.' }, [['g_mochi_1', 'Settled alone for 8 minutes on camera, lay down at 2 minutes.', 'observed']]);
session('s_bruno_1', ['d_bruno'], 'initial', -35, { observations: 'Bruno behind gate: barking 40 s, then took tossed treats. Sat sideways; he sniffed my shoe through the gate.', exercisesPracticed: 'Doorbell = treat to mat.', homework: 'Doorbell recording 10x/day.', nextSteps: 'Real doorbell with Marcus outside.', privateNotes: 'Marcus wants to use a prong collar. Explained risks; schedule time with him.' });
session('s_bruno_2', ['d_bruno'], 'followUp', -7, { changesSinceLast: 'Goes to mat on the recording 9/10. Marcus has been practicing too.', observations: 'Real doorbell: Bruno ran to mat, two barks, then lay down.', exercisesPracticed: 'Door opening while on mat; visitor tosses treat.', homework: 'Door opens 1 inch, then wider.', nextSteps: 'Visitor sitting sideways next time.' }, [['g_bruno_1', 'Real doorbell: went to mat, two barks, lay down within a minute.', 'observed']]);
session('s_rocket_1', ['d_rocket'], 'initial', -49, { observations: 'Recall 4/5 in hallway, 1/5 at run gate.', exercisesPracticed: 'New recall cue, long line.', homework: 'Ten recalls/day with chicken.', nextSteps: 'Long line in Maria Hernandez Park.' });
session('s_rocket_2', ['d_rocket'], 'followUp', -20, { freeformNotes: 'Long line at the park — Rocket came on the new cue 7/8 times, including once away from a squirrel! Leash pulling better with silky leash. Tess is thrilled. Next: try recall at the run during a quiet time.' }, [['g_rocket_1', 'Came on the new cue 7/8 times on the long line, once away from a squirrel.', 'observed']]);
session('s_hazel_1', ['d_hazel'], 'virtual', -42, { observations: 'Watched Ben leave: Hazel paced at 6 min.', exercisesPracticed: 'Graduated departures plan.', homework: 'Daily absences under 5 min.', nextSteps: 'Weekly video review.' });
session('s_hazel_2', ['d_hazel'], 'virtual', -14, { changesSinceLast: 'Up to 25 minutes settled.', observations: 'Video: lay on bed at 3 min, chewed, slept.', exercisesPracticed: 'Pre-departure enrichment.', homework: 'Add 3 min per day when calm.', nextSteps: 'Aim for 45 minutes.' }, [['g_hazel_1', 'Settled for 25 minutes; lay on her bed at 3 minutes.', 'observed']]);
session('s_sesame_1', ['d_sesame', 'd_zaatar'], 'initial', -21, { observations: 'Sesame noticed scooter at 80 ft and took food; froze at 30 ft. Za’atar startled by the radiator clank.', exercisesPracticed: 'Look at That on a park bench.', homework: 'LAT at 80+ ft, 5 min/day.', nextSteps: 'Za’atar: full assessment next visit.' });
session('s_clementine_1', ['d_clementine'], 'initial', -17, { observations: 'Clementine soft and playful indoors. Froze at a passing truck on the block; recovered after sniffing a planter for 2 min.', exercisesPracticed: 'Doorstep sniffing, treat scatter.', homework: 'Doorstep sniff 2x/day.', nextSteps: 'Check-in in 10 days.' });
session('s_pierogi_1', ['d_pierogi'], 'initial', -400, { observations: 'Barked 3x, then took a treat on cue.', homework: 'Thank-you cue.', nextSteps: 'Window film.' });

// ── Upcoming appointments ──────────────────────────────────────────────────
const upcoming = [
  ['ap_up_1', ['d_juniper'], 'followUp', 0, 10],
  ['ap_up_2', ['d_bruno'], 'followUp', 0, 14],
  ['ap_up_3', ['d_biscuit'], 'initial', 1, 9],
  ['ap_up_4', ['d_hazel'], 'virtual', 1, 17],
  ['ap_up_5', ['d_theo'], 'followUp', 3, 11],
  ['ap_up_6', ['d_sesame', 'd_zaatar'], 'followUp', 4, 10],
  ['ap_up_7', ['d_clementine'], 'checkIn', 6, 8],
  ['ap_up_8', ['d_mochi'], 'virtual', 9, 18],
];
upcoming.forEach(([id, dogIds, type, days, hh]) =>
  put('appointments', id, { dogIds, clientIds: [...new Set(dogIds.flatMap(clientsOf))], type, start: at(days, hh), durationMinutes: type === 'checkIn' ? 20 : 60, status: 'scheduled', location: type === 'virtual' ? 'Zoom' : 'Home visit', consultationId: null }, -5),
);
put('appointments', 'ap_up_call', { dogIds: [], clientIds: ['c_grace'], type: 'discoveryCall', start: at(2, 12, 30), durationMinutes: 20, status: 'scheduled', location: 'Phone', notes: 'Free consultation call about new rescue puppy.', consultationId: null }, -1);
put('appointments', 'ap_cancel', { dogIds: ['d_mango'], clientIds: ['c_priya', 'c_sam'], type: 'followUp', start: at(-6, 15), durationMinutes: 60, status: 'cancelled', notes: 'Noor sick — reschedule.', consultationId: null }, -12);
put('appointments', 'ap_noshow', { dogIds: ['d_rocket'], clientIds: ['c_tess'], type: 'checkIn', start: at(-3, 18), durationMinutes: 20, status: 'noShow', consultationId: null }, -8);

// ── Follow-ups ─────────────────────────────────────────────────────────────
const fu = [
  ['Email Mango’s family to reschedule', -4, 'open', 'd_mango', 'c_priya'],
  ['Send Pickles’ vet a behavior summary', -2, 'open', 'd_pickles', 'c_maya'],
  ['Check in on Clementine’s doorstep homework', -1, 'open', 'd_clementine', 'c_alex'],
  ['Review Hazel’s new alone-time videos', 0, 'open', 'd_hazel', 'c_ben'],
  ['Reply to Liam’s inquiry about Olive', 1, 'open', 'd_olive', 'c_liam'],
  ['Muzzle progress check with Renée', 3, 'open', 'd_bruno', 'c_renee'],
  ['Send Rocket’s recall handout', 5, 'open', 'd_rocket', 'c_tess'],
  ['Annual check-in with Marta & Pierogi', 30, 'open', 'd_pierogi', 'c_marta'],
  ['Share leash handling video with Maya', -20, 'done', 'd_juniper', 'c_maya'],
  ['Send Theo’s chin-rest handout', -40, 'done', 'd_theo', 'c_siobhan'],
  ['Confirm daycare schedule for Mochi', -30, 'done', 'd_mochi', 'c_kenji'],
];
fu.forEach(([title, days, status, dogId, clientId], i) => put('followUps', `fu_${i}`, { title, dueDate: iso(days), status, dogId, clientId, consultationId: null, completedAt: status === 'done' ? at(days, 12) : null }, days - 7));

// Commit in batches of 400.
for (let i = 0; i < writes.length; i += 400) {
  const batch = db.batch();
  for (const [path, data] of writes.slice(i, i + 400)) {
    batch.set(db.doc(path), stripUndefined(data));
  }
  await batch.commit();
}

function stripUndefined(o) {
  if (o instanceof Timestamp) return o;
  if (Array.isArray(o)) return o.map(stripUndefined);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, stripUndefined(v)]));
  return o;
}

console.log(`Seeded ${clients.length} clients, ${dogs.length} dogs, ${households.length} households, ${writes.length} documents.`);
console.log(`Sign in: ${DEMO_USERS.haley.email} / ${DEMO_USERS.haley.password}`);
process.exit(0);
