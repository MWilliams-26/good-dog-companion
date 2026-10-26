import type { AppointmentStatus, ClientStatus, ConsultationType, DogStatus, GoalStatus, PlanStatus, RelationshipRole } from './types';

export const CONCERNS = [
  'Reactivity',
  'Aggression',
  'Fear or anxiety',
  'Separation-related behavior',
  'Resource guarding',
  'Handling / cooperative care',
  'Puppy development',
  'Leash walking',
  'Recall',
  'House training',
  'Jumping / mouthing',
  'Barking',
  'Multi-dog household conflict',
  'Rescue transition / decompression',
  'Bite history',
];

export const CLIENT_STATUS: Record<ClientStatus, { label: string; tone: 'honey' | 'sky' | 'moss' | 'neutral' | 'clay' }> = {
  inquiry: { label: 'Inquiry', tone: 'honey' },
  new: { label: 'New', tone: 'sky' },
  active: { label: 'Active', tone: 'moss' },
  returning: { label: 'Returning', tone: 'sky' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

export const DOG_STATUS: Record<DogStatus, string> = {
  active: 'Working together',
  paused: 'Paused',
  graduated: 'Graduated',
  archived: 'Archived',
};

export const CONSULT_TYPE: Record<ConsultationType | 'discoveryCall', string> = {
  initial: 'Initial consultation',
  followUp: 'Follow-up',
  virtual: 'Virtual consultation',
  checkIn: 'Progress check-in',
  discoveryCall: 'Free consultation call',
};

export const CONSULT_TYPE_SHORT: Record<ConsultationType | 'discoveryCall', string> = {
  initial: 'Initial',
  followUp: 'Follow-up',
  virtual: 'Virtual',
  checkIn: 'Check-in',
  discoveryCall: 'Free call',
};

export const GOAL_STATUS: Record<GoalStatus, { label: string; tone: 'neutral' | 'moss' | 'honey' | 'sky' | 'olive' }> = {
  notStarted: { label: 'Not started', tone: 'neutral' },
  inProgress: { label: 'In progress', tone: 'sky' },
  maintaining: { label: 'Maintaining', tone: 'moss' },
  achieved: { label: 'Achieved', tone: 'olive' },
  paused: { label: 'Paused', tone: 'honey' },
  revised: { label: 'Revised', tone: 'neutral' },
};

export const PLAN_STATUS: Record<PlanStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

export const APPT_STATUS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  noShow: 'No-show',
};

export const ROLES: RelationshipRole[] = ['guardian', 'co-guardian', 'caregiver', 'foster', 'former guardian'];

export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
