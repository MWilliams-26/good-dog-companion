// Shared record shapes. Every Firestore document carries RecordMeta, which the
// security rules require on create and update (actor and server timestamps).

import type { Timestamp } from 'firebase/firestore';

export interface RecordMeta {
  id: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  createdBy: string;
  updatedBy: string;
  archived?: boolean;
}

/** ISO calendar date, e.g. 2026-10-26. */
export type ISODate = string;
/** ISO date-time with offset, e.g. 2026-10-26T14:00:00.000Z. */
export type ISODateTime = string;

export type ClientStatus = 'inquiry' | 'new' | 'active' | 'inactive' | 'returning';
export type ContactMethod = 'text' | 'call' | 'email';

export interface Client extends RecordMeta {
  firstName: string;
  lastName: string;
  pronouns?: string;
  email?: string;
  phone?: string;
  preferredContact: ContactMethod;
  bestTimes?: string;
  communicationNotes?: string;
  status: ClientStatus;
  referralSource?: string;
  householdId: string;
  notes?: string;
  privateNotes?: string;
  inquiryDate?: ISODate;
  inquirySummary?: string;
}

export interface HouseholdMember {
  name: string;
  relationship: string;
  notes?: string;
}

export interface Household extends RecordMeta {
  name: string;
  neighborhood?: string;
  address?: string;
  homeType?: string;
  accessNotes?: string;
  members: HouseholdMember[];
  otherAnimals?: string;
}

export type DogSex = 'female' | 'male' | 'unknown';
export type DogStatus = 'active' | 'paused' | 'graduated' | 'archived';
export type SafetyLevel = 'caution' | 'important';

export interface SafetyNote {
  level: SafetyLevel;
  text: string;
}

export interface Dog extends RecordMeta {
  name: string;
  breed?: string;
  sex: DogSex;
  altered?: boolean;
  birthDate?: ISODate;
  ageNote?: string;
  weightLbs?: number;
  coat?: string;
  photoPath?: string;
  /** The home the dog lives in. Empty until the dog is linked to a person. */
  householdId?: string;
  acquisition?: string;
  acquisitionDate?: ISODate;
  rescueOrg?: string;
  vetClinic?: string;
  concerns: string[];
  safetyNotes: SafetyNote[];
  summary?: string;
  status: DogStatus;
}

export type RelationshipRole = 'guardian' | 'co-guardian' | 'caregiver' | 'foster' | 'former guardian';

export interface ClientDogRelationship extends RecordMeta {
  clientId: string;
  dogId: string;
  role: RelationshipRole;
  isPrimary: boolean;
  startDate: ISODate;
  endDate?: ISODate | null;
}

// ─── Assessment templates ───────────────────────────────────────────────────

export type QuestionType =
  | 'text'
  | 'longText'
  | 'singleChoice'
  | 'multiChoice'
  | 'yesNo'
  | 'number'
  | 'date'
  | 'scale'
  | 'list';

/** Who the information comes from. "either" lets the consultant mark each answer. */
export type InfoSource = 'reported' | 'observed' | 'either';

export interface QuestionCondition {
  questionId: string;
  /** equals: value matches; includes: multi-choice contains; answered: any value. */
  operator: 'equals' | 'includes' | 'answered' | 'notEquals';
  value?: string;
}

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  help?: string;
  required?: boolean;
  options?: string[];
  /** Labels for the ends of a scale question (no numeric meaning implied). */
  scaleLabels?: [string, string];
  source: InfoSource;
  showIf?: QuestionCondition;
  /** Answers default to consultant-only (never shown in client reports unless chosen). */
  private?: boolean;
  /** Only shown in follow-up assessments, or only in initial ones. */
  mode?: 'initial' | 'followUp';
}

export interface TemplateSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  /** For modules: the concern tags that suggest turning this module on. */
  suggestedFor?: string[];
}

export interface TemplateDefinition {
  name: string;
  description: string;
  sections: TemplateSection[];
  modules: TemplateSection[];
}

export interface AssessmentTemplate extends RecordMeta, TemplateDefinition {
  currentVersion: number;
  currentVersionId: string;
}

/** Immutable published snapshot. Assessments point at one of these. */
export interface AssessmentTemplateVersion extends RecordMeta, TemplateDefinition {
  templateId: string;
  version: number;
  changeNote?: string;
}

// ─── Assessments ────────────────────────────────────────────────────────────

export type ResponseStatus = 'answered' | 'notAssessed' | 'notApplicable';
export type AnswerValue = string | number | boolean | string[] | null;

export interface QuestionResponse {
  status: ResponseStatus;
  value?: AnswerValue;
  /** Where the answer came from: what the client said or what Haley saw. */
  source?: 'reported' | 'observed';
  note?: string;
}

export type AssessmentMode = 'initial' | 'followUp';

export interface Assessment extends RecordMeta {
  dogId: string;
  clientIds: string[];
  templateId: string;
  templateVersionId: string;
  templateVersion: number;
  mode: AssessmentMode;
  status: 'draft' | 'complete';
  date: ISODate;
  enabledModules: string[];
  responses: Record<string, QuestionResponse>;
  privateNotes?: string;
  previousAssessmentId?: string | null;
  revision: number;
  completedAt?: ISODateTime | null;
}

export interface AssessmentRevision extends RecordMeta {
  assessmentId: string;
  revision: number;
  reason: string;
  status: Assessment['status'];
  enabledModules: string[];
  responses: Record<string, QuestionResponse>;
  privateNotes?: string;
}

// ─── Sessions, plans, progress ──────────────────────────────────────────────

export type ConsultationType = 'initial' | 'followUp' | 'virtual' | 'checkIn';

export interface Consultation extends RecordMeta {
  dogIds: string[];
  clientIds: string[];
  type: ConsultationType;
  date: ISODate;
  durationMinutes?: number;
  location?: string;
  format: 'structured' | 'freeform';
  observations?: string;
  exercisesPracticed?: string;
  changesSinceLast?: string;
  homework?: string;
  nextSteps?: string;
  privateNotes?: string;
  freeformNotes?: string;
  planId?: string | null;
  goalIds: string[];
  appointmentId?: string | null;
}

export type PlanStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface TrainingPlan extends RecordMeta {
  dogId: string;
  title: string;
  status: PlanStatus;
  startDate: ISODate;
  summary?: string;
  management?: string;
  assessmentId?: string | null;
  reviewDate?: ISODate;
}

export type GoalStatus = 'notStarted' | 'inProgress' | 'maintaining' | 'achieved' | 'paused' | 'revised';

export interface Exercise {
  name: string;
  instructions: string;
}

export interface Milestone {
  label: string;
  reachedOn?: ISODate | null;
}

export interface Goal extends RecordMeta {
  planId: string;
  dogId: string;
  title: string;
  priority: number;
  why?: string;
  successCriteria: string[];
  exercises: Exercise[];
  homework?: string;
  status: GoalStatus;
  milestones: Milestone[];
}

export interface ProgressObservation extends RecordMeta {
  goalId: string;
  planId: string;
  dogId: string;
  date: ISODate;
  observation: string;
  source: 'reported' | 'observed';
  consultationId?: string | null;
  milestone?: string | null;
}

// ─── Schedule ───────────────────────────────────────────────────────────────

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'noShow';

export interface Appointment extends RecordMeta {
  dogIds: string[];
  clientIds: string[];
  type: ConsultationType | 'discoveryCall';
  start: ISODateTime;
  durationMinutes: number;
  location?: string;
  status: AppointmentStatus;
  notes?: string;
  consultationId?: string | null;
}

export interface FollowUp extends RecordMeta {
  title: string;
  dueDate: ISODate;
  status: 'open' | 'done';
  dogId?: string | null;
  clientId?: string | null;
  consultationId?: string | null;
  notes?: string;
  completedAt?: ISODateTime | null;
}

// ─── Reports and files ──────────────────────────────────────────────────────

export interface ReportSection {
  id: string;
  heading: string;
  body: string;
  included: boolean;
  /** Private or safety-sensitive content; excluded unless explicitly chosen. */
  sensitive: boolean;
}

export interface ReportDraft extends RecordMeta {
  kind: 'consultation' | 'trainingPlan' | 'assessment';
  sourceId: string;
  dogId: string;
  title: string;
  recipient?: string;
  sections: ReportSection[];
  status: 'draft' | 'final';
}

export interface DogDocument extends RecordMeta {
  dogId: string;
  name: string;
  storagePath: string;
  contentType: string;
  size: number;
  kind: 'photo' | 'document';
}

export interface AuthorizedUser {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'staff';
  active: boolean;
}

export interface AuditEvent {
  id: string;
  collection: string;
  docId: string;
  action: 'create' | 'update' | 'delete';
  actor: string | null;
  at: Timestamp;
}

export type CollectionName =
  | 'clients'
  | 'households'
  | 'dogs'
  | 'clientDogs'
  | 'assessmentTemplates'
  | 'assessmentTemplateVersions'
  | 'assessments'
  | 'consultations'
  | 'trainingPlans'
  | 'goals'
  | 'progressObservations'
  | 'appointments'
  | 'followUps'
  | 'reportDrafts'
  | 'dogDocuments';
