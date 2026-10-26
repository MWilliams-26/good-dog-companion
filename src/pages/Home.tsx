import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronRight, Inbox, NotebookPen, Sprout, UserPlus, Zap, CalendarPlus, Flag } from 'lucide-react';
import { useAuth } from '../stores/auth';
import { usePractice, clientName } from '../stores/practice';
import { useActivePlans, useOpenFollowUps, useUpcomingAppointments } from '../lib/queries';
import { Card, EmptyState, SectionTitle, SkeletonList, Tag } from '../components/ui';
import { DogAvatar, ClientInitials } from '../components/DogAvatar';
import { AppointmentRow, FollowUpItem } from './Schedule';
import { fmtDate, isoDateOffset, relativeDay, todayISO } from '../lib/dates';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function HomePage() {
  const profile = useAuth((s) => s.profile);
  const { dogs, clients } = usePractice();
  const start = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const upcoming = useUpcomingAppointments(start, 6);
  const followUps = useOpenFollowUps();
  const plans = useActivePlans();
  const today = todayISO();
  const due = followUps.data.filter((f) => f.dueDate <= isoDateOffset(7));
  const overdue = due.filter((f) => f.dueDate < today).length;
  const inquiries = clients.filter((c) => c.status === 'inquiry' && !c.archived).sort((a, b) => (b.inquiryDate ?? '').localeCompare(a.inquiryDate ?? ''));
  const recentDogs = [...dogs].filter((d) => !d.archived).sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0)).slice(0, 6);
  const recentClients = [...clients].filter((c) => !c.archived).sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0)).slice(0, 4);
  const dogMap = new Map(dogs.map((d) => [d.id, d]));
  const todayCount = upcoming.data.filter((a) => a.start.slice(0, 10) === start.slice(0, 10) || fmtDate(a.start, 'yyyy-MM-dd') === today).length;
  const firstName = profile?.displayName?.split(' ')[0] ?? '';

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="text-sm font-semibold text-moss-soft">{fmtDate(today, 'EEEE, MMMM d')}</p>
        <h1 className="mt-1 font-serif text-[2.25rem] leading-tight font-medium text-olive sm:text-[2.75rem]">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="mt-2 text-[0.9375rem] text-fg-muted">
          {todayCount ? `${todayCount} ${todayCount === 1 ? 'session' : 'sessions'} today` : 'No sessions today'}
          {overdue ? (
            <>
              {' · '}
              <Link to="/schedule?view=followups" className="font-semibold text-clay hover:underline">
                {overdue} overdue follow-up{overdue === 1 ? '' : 's'}
              </Link>
            </>
          ) : null}
          {inquiries.length ? ` · ${inquiries.length} new ${inquiries.length === 1 ? 'inquiry' : 'inquiries'}` : ''}
        </p>
      </header>

      <nav aria-label="Quick add" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { to: '/clients/new', icon: UserPlus, label: 'New client' },
          { to: '/sessions/new', icon: NotebookPen, label: 'Session notes' },
          { to: '/sessions/new?format=freeform', icon: Zap, label: 'Quick note' },
          { to: '/schedule/new', icon: CalendarPlus, label: 'Appointment' },
        ].map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className="flex items-center gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5 text-sm font-semibold transition-colors hover:border-moss/40 hover:bg-white">
            <Icon className="size-[1.125rem] text-moss" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="upcoming">
            <SectionTitle id="upcoming" action={<Link to="/schedule" className="text-sm font-semibold text-moss hover:underline">Schedule</Link>}>
              Upcoming consultations
            </SectionTitle>
            {upcoming.loading ? (
              <SkeletonList rows={3} />
            ) : upcoming.data.length ? (
              <div className="flex flex-col gap-3">
                {Object.entries(
                  upcoming.data.reduce<Record<string, typeof upcoming.data>>((acc, a) => {
                    const k = fmtDate(a.start, 'yyyy-MM-dd');
                    (acc[k] ??= []).push(a);
                    return acc;
                  }, {}),
                ).map(([day, items]) => (
                  <div key={day}>
                    <p className="mb-1.5 text-sm font-semibold text-fg-muted">
                      {relativeDay(day)} <span className="font-normal">· {fmtDate(day, 'EEE, MMM d')}</span>
                    </p>
                    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
                      {items.map((a) => (
                        <AppointmentRow key={a.id} a={a} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<CalendarClock className="size-7" />} title="Nothing on the calendar" />
            )}
          </section>

          <section aria-labelledby="plans">
            <SectionTitle id="plans">Active training plans</SectionTitle>
            {plans.loading ? (
              <SkeletonList rows={2} />
            ) : plans.data.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {plans.data
                  .map((p) => ({ p, d: dogMap.get(p.dogId) }))
                  .filter((x) => x.d && !x.d.archived)
                  .sort((a, b) => (a.p.reviewDate ?? '9').localeCompare(b.p.reviewDate ?? '9'))
                  .map(({ p, d }) => (
                    <li key={p.id}>
                      <Link to={`/plans/${p.id}`} className="flex items-center gap-3 rounded-card border border-line bg-card p-3 transition-colors hover:border-moss/40">
                        <DogAvatar dog={d!} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{d!.name}</span>
                          <span className="block truncate text-sm text-fg-muted">{p.reviewDate ? `Review ${relativeDay(p.reviewDate)}` : p.title}</span>
                        </span>
                        <Sprout className="size-4 text-moss" aria-hidden />
                      </Link>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">No active plans.</p>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="followups">
            <SectionTitle id="followups" action={<Link to="/schedule?view=followups" className="text-sm font-semibold text-moss hover:underline">All</Link>}>
              Follow-ups due
            </SectionTitle>
            {followUps.loading ? (
              <SkeletonList rows={2} />
            ) : due.length ? (
              <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
                {due.slice(0, 7).map((f) => (
                  <FollowUpItem key={f.id} f={f} compact />
                ))}
              </ul>
            ) : (
              <Card className="flex items-center gap-3 p-4 text-sm text-fg-muted">
                <Flag className="size-4 text-moss" aria-hidden />
                Nothing due this week.
              </Card>
            )}
          </section>

          <section aria-labelledby="inquiries">
            <SectionTitle id="inquiries" action={<Link to="/clients/new?inquiry=1" className="text-sm font-semibold text-moss hover:underline">Log inquiry</Link>}>
              New inquiries
            </SectionTitle>
            {inquiries.length ? (
              <ul className="divide-y divide-line overflow-hidden rounded-card border border-honey/30 bg-card">
                {inquiries.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link to={`/clients/${c.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-paper">
                      <Inbox className="mt-0.5 size-4 shrink-0 text-honey" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold">{clientName(c)}</span>
                          {c.inquiryDate ? <span className="shrink-0 text-xs text-fg-muted">{relativeDay(c.inquiryDate)}</span> : null}
                        </span>
                        {c.inquirySummary ? <span className="line-clamp-2 text-sm text-fg-muted">{c.inquirySummary}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">No open inquiries.</p>
            )}
          </section>

          <section aria-labelledby="recent">
            <SectionTitle id="recent">Recently updated</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {recentDogs.map((d) => (
                <Link key={d.id} to={`/dogs/${d.id}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 ps-1 pe-3.5 text-sm font-semibold hover:border-moss/40">
                  <DogAvatar dog={d} size="sm" className="size-8 rounded-full" />
                  {d.name}
                </Link>
              ))}
            </div>
            <ul className="mt-3 flex flex-col gap-1">
              {recentClients.map((c) => (
                <li key={c.id}>
                  <Link to={`/clients/${c.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-card">
                    <ClientInitials first={c.firstName} last={c.lastName} className="size-8 text-xs" />
                    <span className="flex-1 text-sm font-semibold">{clientName(c)}</span>
                    {c.status === 'returning' ? <Tag tone="sky">Returning</Tag> : null}
                    <ChevronRight className="size-4 text-fg-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
