import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { FileOutput, Pencil, Flag, Eye } from 'lucide-react';
import { db } from '../lib/firebase';
import { useQuery, useRecord, newId } from '../lib/db';
import { usePractice, clientName } from '../stores/practice';
import { Button, ButtonLink, Card, Loading, NotFound, PageHeader, PrivateLabel, Prose, SectionTitle } from '../components/ui';
import { DogAvatar } from '../components/DogAvatar';
import { CONSULT_TYPE } from '../lib/labels';
import { fmtDate } from '../lib/dates';
import type { Consultation, FollowUp, Goal, ProgressObservation } from '../lib/types';

export function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: s, loading } = useRecord<Consultation>('consultations', id);
  const { dogs, clients } = usePractice();
  const obs = useQuery<ProgressObservation>(id ? query(collection(db, 'progressObservations'), where('consultationId', '==', id)) : null, `obs-${id}`);
  const fus = useQuery<FollowUp>(id ? query(collection(db, 'followUps'), where('consultationId', '==', id)) : null, `fus-${id}`);
  const goals = useQuery<Goal>(s?.planId ? query(collection(db, 'goals'), where('planId', '==', s.planId)) : null, `sg-${s?.planId}`);

  if (loading) return <Loading />;
  if (!s) return <NotFound what="Session" back={{ to: '/sessions', label: 'Sessions' }} />;
  const ds = s.dogIds.map((d) => dogs.find((x) => x.id === d)).filter(Boolean);
  const goalMap = new Map(goals.data.map((g) => [g.id, g]));

  const block = (title: string, text?: string) =>
    text ? (
      <div>
        <h3 className="mb-1 text-sm font-bold tracking-[0.06em] text-fg-muted uppercase">{title}</h3>
        <Prose>{text}</Prose>
      </div>
    ) : null;

  return (
    <div>
      <PageHeader
        title={CONSULT_TYPE[s.type]}
        eyebrow={`${fmtDate(s.date, 'EEEE, MMMM d, yyyy')}${s.durationMinutes ? ` · ${s.durationMinutes} min` : ''}`}
        back={{ to: '/sessions', label: 'Sessions' }}
        actions={
          <>
            <ButtonLink to={`/sessions/${s.id}/edit`} variant="secondary" size="sm">
              <Pencil className="size-4" aria-hidden />
              Edit
            </ButtonLink>
            <Button size="sm" onClick={() => navigate(`/reports/new?kind=consultation&source=${s.id}&id=${newId('reportDrafts')}`)}>
              <FileOutput className="size-4" aria-hidden />
              Client summary
            </Button>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {ds.map((d) => (
          <Link key={d!.id} to={`/dogs/${d!.id}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 ps-1 pe-3.5 font-semibold hover:border-moss/40">
            <DogAvatar dog={d!} size="sm" className="size-8 rounded-full" />
            {d!.name}
          </Link>
        ))}
        {s.clientIds.map((c) => (
          <Link key={c} to={`/clients/${c}`} className="inline-flex items-center rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-semibold hover:border-moss/40">
            {clientName(clients.find((x) => x.id === c))}
          </Link>
        ))}
        {s.location ? <span className="inline-flex items-center px-2 text-sm text-fg-muted">{s.location}</span> : null}
      </div>
      <div className="grid gap-5 [&>*]:min-w-0 lg:grid-cols-[1.5fr_1fr]">
        <Card className="flex flex-col gap-5 p-5 sm:p-6">
          {s.format === 'freeform' ? (
            block('Notes', s.freeformNotes)
          ) : (
            <>
              {block('Changes since last session', s.changesSinceLast)}
              {block('Observations', s.observations)}
              {block('Exercises', s.exercisesPracticed)}
              {block('Client homework', s.homework)}
              {block('Next steps', s.nextSteps)}
            </>
          )}
          {s.privateNotes ? (
            <div className="rounded-2xl bg-paper p-4">
              <PrivateLabel />
              <Prose className="mt-2">{s.privateNotes}</Prose>
            </div>
          ) : null}
        </Card>
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <SectionTitle>Progress recorded</SectionTitle>
            {obs.data.length ? (
              <ul className="flex flex-col gap-3">
                {obs.data.map((o) => (
                  <li key={o.id} className="text-[0.9375rem]">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Eye className="size-4 text-moss" aria-hidden />
                      {goalMap.get(o.goalId)?.title ?? 'Goal'}
                    </p>
                    <p className="mt-0.5 text-olive/90">{o.observation}</p>
                    <p className="text-xs text-fg-muted">{o.source === 'observed' ? 'Observed' : 'Reported'}{o.milestone ? ` · milestone: ${o.milestone}` : ''}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">No goal observations linked to this session.</p>
            )}
            {s.planId ? (
              <Link to={`/plans/${s.planId}`} className="mt-3 inline-block text-sm font-semibold text-moss hover:underline">
                Open training plan
              </Link>
            ) : null}
          </Card>
          <Card className="p-5">
            <SectionTitle>Follow-up</SectionTitle>
            {fus.data.length ? (
              fus.data.map((f) => (
                <p key={f.id} className="flex items-start gap-2 text-[0.9375rem]">
                  <Flag className="mt-1 size-4 text-honey" aria-hidden />
                  <span>
                    {f.title}
                    <span className="block text-sm text-fg-muted">
                      {f.status === 'done' ? 'Done' : `Due ${fmtDate(f.dueDate)}`}
                    </span>
                  </span>
                </p>
              ))
            ) : (
              <Link to={`/schedule?followup=new&dog=${s.dogIds[0]}`} className="text-sm font-semibold text-moss hover:underline">
                Add a follow-up reminder
              </Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
