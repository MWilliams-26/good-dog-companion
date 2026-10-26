import { collection, orderBy, query, where, limit as qLimit } from 'firebase/firestore';
import { db } from './firebase';
import { useQuery } from './db';
import type {
  Appointment,
  Assessment,
  Consultation,
  DogDocument,
  FollowUp,
  Goal,
  ProgressObservation,
  ReportDraft,
  TrainingPlan,
} from './types';

const col = (name: string) => collection(db, name);

const byDateDesc = <T,>(get: (x: T) => string | undefined) => (a: T, b: T) => (get(b) ?? '').localeCompare(get(a) ?? '');

export function useDogRecords(dogId: string | undefined) {
  const k = dogId ?? 'none';
  const assessments = useQuery<Assessment>(dogId ? query(col('assessments'), where('dogId', '==', dogId)) : null, `a-${k}`);
  const consultations = useQuery<Consultation>(dogId ? query(col('consultations'), where('dogIds', 'array-contains', dogId)) : null, `c-${k}`);
  const plans = useQuery<TrainingPlan>(dogId ? query(col('trainingPlans'), where('dogId', '==', dogId)) : null, `p-${k}`);
  const goals = useQuery<Goal>(dogId ? query(col('goals'), where('dogId', '==', dogId)) : null, `g-${k}`);
  const observations = useQuery<ProgressObservation>(dogId ? query(col('progressObservations'), where('dogId', '==', dogId)) : null, `o-${k}`);
  const appointments = useQuery<Appointment>(dogId ? query(col('appointments'), where('dogIds', 'array-contains', dogId)) : null, `ap-${k}`);
  const followUps = useQuery<FollowUp>(dogId ? query(col('followUps'), where('dogId', '==', dogId)) : null, `f-${k}`);
  const documents = useQuery<DogDocument>(dogId ? query(col('dogDocuments'), where('dogId', '==', dogId)) : null, `d-${k}`);
  const reports = useQuery<ReportDraft>(dogId ? query(col('reportDrafts'), where('dogId', '==', dogId)) : null, `r-${k}`);

  const all = [assessments, consultations, plans, goals, observations, appointments, followUps, documents, reports];
  return {
    loading: all.some((x) => x.loading),
    error: all.find((x) => x.error)?.error ?? null,
    assessments: [...assessments.data].sort(byDateDesc((x) => x.date)),
    consultations: [...consultations.data].sort(byDateDesc((x) => x.date)),
    plans: [...plans.data].sort(byDateDesc((x) => x.startDate)),
    goals: [...goals.data].sort((a, b) => a.priority - b.priority),
    observations: [...observations.data].sort(byDateDesc((x) => x.date)),
    appointments: [...appointments.data].sort(byDateDesc((x) => x.start)),
    followUps: [...followUps.data].sort(byDateDesc((x) => x.dueDate)),
    documents: [...documents.data].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
    reports: [...reports.data].sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0)),
  };
}

export function useUpcomingAppointments(fromISO: string, max = 50) {
  return useQuery<Appointment>(
    query(col('appointments'), where('status', '==', 'scheduled'), where('start', '>=', fromISO), orderBy('start', 'asc'), qLimit(max)),
    `upcoming-${fromISO.slice(0, 13)}-${max}`,
  );
}

export function useOpenFollowUps() {
  return useQuery<FollowUp>(query(col('followUps'), where('status', '==', 'open'), orderBy('dueDate', 'asc')), 'open-followups');
}

export function useActivePlans() {
  return useQuery<TrainingPlan>(query(col('trainingPlans'), where('status', '==', 'active')), 'active-plans');
}
