import { Link, useParams } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { Mail, MessageSquare, Phone, Pencil, Plus, Flag, NotebookPen } from 'lucide-react';
import { usePractice } from '../stores/practice';
import { db } from '../lib/firebase';
import { useQuery } from '../lib/db';
import { ButtonLink, Card, Detail, EmptyState, NotFound, PageHeader, PrivateLabel, Prose, SectionTitle, Tag } from '../components/ui';
import { DogAvatar } from '../components/DogAvatar';
import { CLIENT_STATUS, CONSULT_TYPE } from '../lib/labels';
import { fmtDate, relativeDay, todayISO } from '../lib/dates';
import type { Consultation, FollowUp } from '../lib/types';
import { cn } from '@mwilliams/ui';

export function ClientProfilePage() {
  const { id } = useParams();
  const { clients, households, dogs, links } = usePractice();
  const client = clients.find((c) => c.id === id);
  const sessions = useQuery<Consultation>(id ? query(collection(db, 'consultations'), where('clientIds', 'array-contains', id)) : null, `client-sessions-${id}`);
  const followUps = useQuery<FollowUp>(id ? query(collection(db, 'followUps'), where('clientId', '==', id)) : null, `client-fu-${id}`);

  if (!client) return <NotFound what="Client" back={{ to: '/clients', label: 'Clients' }} />;

  const household = households.find((h) => h.id === client.householdId);
  const housemates = clients.filter((c) => c.householdId === client.householdId && c.id !== client.id);
  const myLinks = links.filter((l) => l.clientId === client.id);
  const dogMap = new Map(dogs.map((d) => [d.id, d]));
  const status = CLIENT_STATUS[client.status];
  const sorted = [...sessions.data].sort((a, b) => b.date.localeCompare(a.date));
  const lastSession = sorted[0];
  const open = followUps.data.filter((f) => f.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const contact = [
    client.phone && { href: `sms:${client.phone}`, icon: MessageSquare, label: 'Text', pref: client.preferredContact === 'text' },
    client.phone && { href: `tel:${client.phone}`, icon: Phone, label: 'Call', pref: client.preferredContact === 'call' },
    client.email && { href: `mailto:${client.email}`, icon: Mail, label: 'Email', pref: client.preferredContact === 'email' },
  ].filter(Boolean) as { href: string; icon: typeof Mail; label: string; pref: boolean }[];

  return (
    <div>
      <PageHeader
        title={`${client.firstName} ${client.lastName}`}
        eyebrow={<span className="inline-flex items-center gap-2"><Tag tone={status.tone}>{status.label}</Tag>{client.pronouns ? <span className="normal-case tracking-normal text-fg-muted">{client.pronouns}</span> : null}</span>}
        back={{ to: '/clients', label: 'Clients' }}
        actions={
          <ButtonLink to={`/clients/${client.id}/edit`} variant="secondary" size="sm">
            <Pencil className="size-4" aria-hidden />
            Edit
          </ButtonLink>
        }
      />

      {contact.length ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {contact.map(({ href, icon: Icon, label, pref }) => (
            <a key={label} href={href} className={cn('inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold', pref ? 'border-moss bg-moss text-paper' : 'border-line bg-card text-olive hover:border-line-strong')}>
              <Icon className="size-4" aria-hidden />
              {label}
              {pref ? <span className="text-xs font-medium opacity-80">· preferred</span> : null}
            </a>
          ))}
        </div>
      ) : null}

      <div className="grid gap-5 [&>*]:min-w-0 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <SectionTitle action={<Link to={`/dogs/new?client=${client.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-moss hover:underline"><Plus className="size-4" aria-hidden />Add dog</Link>}>Dogs</SectionTitle>
            {myLinks.length ? (
              <ul className="flex flex-col gap-2">
                {myLinks
                  .sort((a, b) => Number(!!a.endDate) - Number(!!b.endDate))
                  .map((l) => {
                    const d = dogMap.get(l.dogId);
                    if (!d) return null;
                    return (
                      <li key={l.id}>
                        <Link to={`/dogs/${d.id}`} className={cn('flex items-center gap-3 rounded-2xl p-2 hover:bg-paper', l.endDate && 'opacity-60')}>
                          <DogAvatar dog={d} size="md" />
                          <span className="flex-1">
                            <span className="block font-serif text-lg font-medium">{d.name}</span>
                            <span className="block text-sm text-fg-muted">
                              {l.role}
                              {l.endDate ? ` · until ${fmtDate(l.endDate)}` : ''} · {d.breed}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <EmptyState title="No dogs linked yet" action={<ButtonLink size="sm" to={`/dogs/new?client=${client.id}`}>Add their dog</ButtonLink>} />
            )}
          </Card>

          {client.status === 'inquiry' || client.inquirySummary ? (
            <Card className="border-honey/30 bg-honey-soft/40 p-5">
              <SectionTitle>Inquiry {client.inquiryDate ? `· ${fmtDate(client.inquiryDate)}` : ''}</SectionTitle>
              <Prose>{client.inquirySummary || 'No details recorded.'}</Prose>
              {client.status === 'inquiry' ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink size="sm" to={`/schedule/new?client=${client.id}&type=discoveryCall`}>Schedule free consultation call</ButtonLink>
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card className="p-5">
            <SectionTitle action={myLinks[0] ? <Link to={`/sessions/new?dog=${myLinks[0].dogId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-moss hover:underline"><NotebookPen className="size-4" aria-hidden />New session</Link> : null}>Consultation history</SectionTitle>
            {sorted.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {sorted.map((s) => (
                  <li key={s.id}>
                    <Link to={`/sessions/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-moss">
                      <span>
                        <span className="block font-semibold">{CONSULT_TYPE[s.type]}</span>
                        <span className="block text-sm text-fg-muted">{s.dogIds.map((d) => dogMap.get(d)?.name).join(', ')}</span>
                      </span>
                      <span className="text-sm text-fg-muted">{fmtDate(s.date)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">{sessions.loading ? 'Loading…' : 'No sessions yet.'}</p>
            )}
          </Card>

          {client.notes || client.privateNotes ? (
            <Card className="p-5">
              <SectionTitle>Notes</SectionTitle>
              <Prose>{client.notes}</Prose>
              {client.privateNotes ? (
                <div className="mt-4 rounded-2xl bg-paper p-3.5">
                  <PrivateLabel />
                  <Prose className="mt-2">{client.privateNotes}</Prose>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <SectionTitle>Follow-up</SectionTitle>
            <dl className="mb-3 grid gap-3">
              <Detail label="Last session">{lastSession ? `${fmtDate(lastSession.date)} (${relativeDay(lastSession.date)})` : 'None yet'}</Detail>
            </dl>
            {open.length ? (
              <ul className="flex flex-col gap-2">
                {open.map((f) => (
                  <li key={f.id} className="flex gap-2 text-[0.9375rem]">
                    <Flag className={cn('mt-1 size-4 shrink-0', f.dueDate < todayISO() ? 'text-clay' : 'text-honey')} aria-hidden />
                    <span>
                      {f.title}
                      <span className={cn('block text-sm', f.dueDate < todayISO() ? 'font-semibold text-clay' : 'text-fg-muted')}>{f.dueDate < todayISO() ? 'Overdue · ' : 'Due '}{relativeDay(f.dueDate)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">No open follow-ups.</p>
            )}
            <Link to={`/schedule?followup=new&client=${client.id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-moss hover:underline">
              <Plus className="size-4" aria-hidden />
              Add follow-up
            </Link>
          </Card>

          <Card className="p-5">
            <SectionTitle>Contact</SectionTitle>
            <dl className="grid gap-3">
              <Detail label="Phone">{client.phone}</Detail>
              <Detail label="Email">{client.email}</Detail>
              <Detail label="Best times">{client.bestTimes}</Detail>
              <Detail label="Preferences">{client.communicationNotes}</Detail>
              <Detail label="Referred by">{client.referralSource}</Detail>
            </dl>
          </Card>

          {household ? (
            <Card className="p-5">
              <SectionTitle>{household.name}</SectionTitle>
              <dl className="grid gap-3">
                <Detail label="Neighborhood">{household.neighborhood}</Detail>
                <Detail label="Address">{household.address}</Detail>
                <Detail label="Home">{household.homeType}</Detail>
                <Detail label="Access">{household.accessNotes}</Detail>
                <Detail label="Members">{household.members.map((m) => `${m.name} (${m.relationship})`).join(', ')}</Detail>
                <Detail label="Other animals">{household.otherAnimals}</Detail>
              </dl>
              {housemates.length ? (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="mb-1 text-xs font-semibold tracking-[0.08em] text-fg-muted uppercase">Also in this household</p>
                  {housemates.map((h) => (
                    <Link key={h.id} to={`/clients/${h.id}`} className="block font-semibold text-moss hover:underline">
                      {h.firstName} {h.lastName}
                    </Link>
                  ))}
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
