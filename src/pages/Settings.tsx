import { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { ChevronRight, Database, FileSpreadsheet, LogOut, ShieldCheck, SlidersHorizontal, History, RotateCcw } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../stores/auth';
import { usePractice, clientName } from '../stores/practice';
import { useQuery, friendlyError } from '../lib/db';
import { buildBackup, plain } from '../lib/exports';
import { download, toCSV } from '../lib/csv';
import { Button, Card, PageHeader, SectionTitle } from '../components/ui';
import { Checkbox } from '../components/form';
import { CONSULT_TYPE } from '../lib/labels';
import { fmtDate, todayISO } from '../lib/dates';
import { toast } from '../stores/toast';
import type { Appointment, AuditEvent, Consultation, FollowUp, Goal } from '../lib/types';
import { demoMode, usingEmulators } from '../lib/firebase';

export function SettingsPage() {
  const { profile, user, signOut } = useAuth();
  const { clients, dogs, households, links } = usePractice();
  const [busy, setBusy] = useState<string | null>(null);
  const [includePrivate, setIncludePrivate] = useState(false);
  const audit = useQuery<AuditEvent & { changedFields?: string[] }>(query(collection(db, 'auditEvents'), orderBy('at', 'desc'), limit(12)), 'audit-recent');

  const hhName = (id: string) => households.find((h) => h.id === id)?.name ?? '';
  const dogName = (id?: string | null) => dogs.find((d) => d.id === id)?.name ?? '';
  const cName = (id?: string | null) => clientName(clients.find((c) => c.id === id));

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const fetchAll = async <T,>(name: string) => (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...(plain(d.data()) as object) }) as T);

  const csv = {
    clients: async () =>
      download(
        `good-dog-clients-${todayISO()}.csv`,
        toCSV(clients, [
          { header: 'First name', value: (c) => c.firstName },
          { header: 'Last name', value: (c) => c.lastName },
          { header: 'Status', value: (c) => c.status },
          { header: 'Email', value: (c) => c.email },
          { header: 'Phone', value: (c) => c.phone },
          { header: 'Prefers', value: (c) => c.preferredContact },
          { header: 'Household', value: (c) => hhName(c.householdId) },
          { header: 'Neighborhood', value: (c) => households.find((h) => h.id === c.householdId)?.neighborhood },
          { header: 'Dogs', value: (c) => links.filter((l) => l.clientId === c.id && !l.endDate).map((l) => dogName(l.dogId)) },
          { header: 'Referred by', value: (c) => c.referralSource },
          { header: 'Notes', value: (c) => c.notes },
          ...(includePrivate ? [{ header: 'Consultant-only notes', value: (c: (typeof clients)[number]) => c.privateNotes }] : []),
          { header: 'Archived', value: (c) => (c.archived ? 'yes' : '') },
          { header: 'ID', value: (c) => c.id },
        ]),
        'text/csv',
      ),
    dogs: async () =>
      download(
        `good-dog-dogs-${todayISO()}.csv`,
        toCSV(dogs, [
          { header: 'Name', value: (d) => d.name },
          { header: 'Breed', value: (d) => d.breed },
          { header: 'Sex', value: (d) => d.sex },
          { header: 'Birthday', value: (d) => d.birthDate },
          { header: 'Weight (lb)', value: (d) => d.weightLbs },
          { header: 'Status', value: (d) => d.status },
          { header: 'Household', value: (d) => hhName(d.householdId ?? '') },
          { header: 'People', value: (d) => links.filter((l) => l.dogId === d.id && !l.endDate).map((l) => `${cName(l.clientId)} (${l.role})`) },
          { header: 'Concerns', value: (d) => d.concerns },
          { header: 'Came from', value: (d) => d.acquisition },
          { header: 'Rescue', value: (d) => d.rescueOrg },
          { header: 'Vet', value: (d) => d.vetClinic },
          ...(includePrivate ? [{ header: 'Safety notes', value: (d: (typeof dogs)[number]) => d.safetyNotes.map((n) => `${n.level}: ${n.text}`) }] : []),
          { header: 'ID', value: (d) => d.id },
        ]),
        'text/csv',
      ),
    sessions: async () => {
      const rows = await fetchAll<Consultation>('consultations');
      download(
        `good-dog-sessions-${todayISO()}.csv`,
        toCSV(rows.sort((a, b) => b.date.localeCompare(a.date)), [
          { header: 'Date', value: (s) => s.date },
          { header: 'Type', value: (s) => CONSULT_TYPE[s.type] },
          { header: 'Dogs', value: (s) => s.dogIds.map(dogName) },
          { header: 'Clients', value: (s) => s.clientIds.map(cName) },
          { header: 'Minutes', value: (s) => s.durationMinutes },
          { header: 'Location', value: (s) => s.location },
          { header: 'Changes since last', value: (s) => s.changesSinceLast },
          { header: 'Observations', value: (s) => s.observations ?? s.freeformNotes },
          { header: 'Exercises', value: (s) => s.exercisesPracticed },
          { header: 'Homework', value: (s) => s.homework },
          { header: 'Next steps', value: (s) => s.nextSteps },
          ...(includePrivate ? [{ header: 'Consultant-only notes', value: (s: Consultation) => s.privateNotes }] : []),
          { header: 'ID', value: (s) => s.id },
        ]),
        'text/csv',
      );
    },
    appointments: async () => {
      const rows = await fetchAll<Appointment>('appointments');
      download(
        `good-dog-appointments-${todayISO()}.csv`,
        toCSV(rows.sort((a, b) => a.start.localeCompare(b.start)), [
          { header: 'Start', value: (a) => a.start },
          { header: 'Minutes', value: (a) => a.durationMinutes },
          { header: 'Type', value: (a) => CONSULT_TYPE[a.type] },
          { header: 'Status', value: (a) => a.status },
          { header: 'Dogs', value: (a) => a.dogIds.map(dogName) },
          { header: 'Clients', value: (a) => a.clientIds.map(cName) },
          { header: 'Location', value: (a) => a.location },
          { header: 'ID', value: (a) => a.id },
        ]),
        'text/csv',
      );
    },
    followUps: async () => {
      const rows = await fetchAll<FollowUp>('followUps');
      download(
        `good-dog-follow-ups-${todayISO()}.csv`,
        toCSV(rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [
          { header: 'Due', value: (f) => f.dueDate },
          { header: 'Reminder', value: (f) => f.title },
          { header: 'Status', value: (f) => f.status },
          { header: 'Dog', value: (f) => dogName(f.dogId) },
          { header: 'Client', value: (f) => (f.clientId ? cName(f.clientId) : '') },
          { header: 'Notes', value: (f) => f.notes },
        ]),
        'text/csv',
      );
    },
    goals: async () => {
      const rows = await fetchAll<Goal>('goals');
      download(
        `good-dog-goals-${todayISO()}.csv`,
        toCSV(rows, [
          { header: 'Dog', value: (g) => dogName(g.dogId) },
          { header: 'Priority', value: (g) => g.priority },
          { header: 'Goal', value: (g) => g.title },
          { header: 'Status', value: (g) => g.status },
          { header: 'Success criteria', value: (g) => g.successCriteria },
          { header: 'Milestones', value: (g) => g.milestones.map((m) => `${m.reachedOn ? '✓ ' : ''}${m.label}`) },
          { header: 'Plan ID', value: (g) => g.planId },
        ]),
        'text/csv',
      );
    },
  };

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-5">
        <Card className="p-5">
          <SectionTitle>Account</SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{profile?.displayName}</p>
              <p className="text-sm text-fg-muted">
                {user?.email} · {profile?.role}
              </p>
            </div>
            <Button variant="secondary" onClick={() => void signOut()}>
              <LogOut className="size-4" aria-hidden />
              Sign out
            </Button>
          </div>
          {demoMode ? null : <p className="mt-3 text-xs text-fg-muted">Signing out also removes the offline copy of practice records from this device.</p>}
        </Card>

        {demoMode ? (
          <Card className="p-5">
            <SectionTitle>Demo data</SectionTitle>
            <p className="text-sm text-fg-muted">
              This demo keeps its fictional practice in this browser only. Nothing you enter is sent anywhere. Start over to erase your changes and
              restore the original demo records, dated from today.
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => {
                if (confirm('Erase your changes on this device and restore the demo practice?')) void import('../demo/store').then((m) => m.resetDemo());
              }}
            >
              <RotateCcw className="size-4" aria-hidden />
              Start over with fresh demo data
            </Button>
          </Card>
        ) : null}

        <Link to="/settings/template" className="block">
          <Card className="flex items-center gap-4 p-5 transition-colors hover:border-moss/40">
            <span className="flex size-11 items-center justify-center rounded-xl bg-mist text-moss">
              <SlidersHorizontal className="size-5" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Assessment template</span>
              <span className="block text-sm text-fg-muted">Edit sections, questions, options and conditions. Publishing creates a new version; past assessments keep theirs.</span>
            </span>
            <ChevronRight className="size-5 text-fg-muted" aria-hidden />
          </Card>
        </Link>

        <Card className="p-5">
          <SectionTitle>Export</SectionTitle>
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ['clients', 'Clients'],
                ['dogs', 'Dogs'],
                ['sessions', 'Sessions'],
                ['appointments', 'Appointments'],
                ['followUps', 'Follow-ups'],
                ['goals', 'Goals'],
              ] as const
            ).map(([k, label]) => (
              <Button key={k} variant="secondary" size="sm" busy={busy === k} onClick={() => void run(k, csv[k])}>
                <FileSpreadsheet className="size-4" aria-hidden />
                {label} CSV
              </Button>
            ))}
          </div>
          <Checkbox checked={includePrivate} onChange={(e) => setIncludePrivate(e.target.checked)} label="Include consultant-only notes and safety notes in CSVs" />
          <div className="mt-5 border-t border-line pt-5">
            <Button
              busy={busy === 'backup'}
              onClick={() =>
                void run('backup', async () => {
                  const backup = await buildBackup();
                  download(`good-dog-backup-${todayISO()}.json`, JSON.stringify(backup, null, 2), 'application/json');
                  toast(`Backup downloaded (${Object.values(backup.counts).reduce((a, b) => a + b, 0)} records)`);
                })
              }
            >
              <Database className="size-4" aria-hidden />
              Download complete backup (JSON)
            </Button>
            <p className="mt-2 text-xs text-fg-muted">Every record, including private notes and assessment history. Store it somewhere safe. Restore steps are in docs/DATA_RECOVERY.md.</p>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>
            <span className="inline-flex items-center gap-1.5">
              <History className="size-3.5" aria-hidden />
              Recent activity (audit trail)
            </span>
          </SectionTitle>
          {audit.data.length ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {audit.data.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>
                    <span className="font-semibold">{e.action}</span> {e.collection}
                    {e.changedFields?.length ? <span className="text-fg-muted"> · {e.changedFields.slice(0, 4).join(', ')}</span> : null}
                  </span>
                  <span className="shrink-0 text-fg-muted">{e.at ? fmtDate(e.at.toDate().toISOString(), 'MMM d, h:mm a') : ''}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">{demoMode ? 'Changes you make in the demo appear here.' : 'Recorded server-side by Cloud Functions for every change.'}</p>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" aria-hidden />
              Privacy
            </span>
          </SectionTitle>
          <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-fg-muted">
            <li>Only accounts the practice owner authorizes can read or write any record.</li>
            <li>Consultant-only notes and safety notes are never added to client reports unless you include them.</li>
            <li>No analytics or tracking. Nothing is emailed automatically.</li>
            {usingEmulators ? <li>This preview runs on a local Firebase emulator with fictional records.</li> : null}
            {demoMode ? <li>This demo has no server: its fictional records are stored only in this browser.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
