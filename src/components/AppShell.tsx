import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dialog, Drawer, SkipLink, cn } from '@mwilliams/ui';
import { CalendarDays, ClipboardList, Dog as DogIcon, Home, NotebookPen, Plus, Search, Settings, UserPlus, Users, CalendarPlus, ListTodo, ArrowRight } from 'lucide-react';
import { usePractice } from '../stores/practice';
import { searchPractice } from '../lib/search';
import { DogAvatar, ClientInitials } from './DogAvatar';
import { Toaster } from './Toaster';
import { demoMode, usingEmulators } from '../lib/firebase';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/dogs', label: 'Dogs', icon: DogIcon },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/sessions', label: 'Sessions', icon: NotebookPen },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
];

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-control text-cream" aria-label="Good Dog Companion, home">
      <img src="/favicon.svg" alt="" className="size-9 rounded-[0.7rem] ring-1 ring-cream/15" />
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="text-[0.95rem] font-extrabold tracking-[0.02em]">GOOD DOG</span>
          <span className="mt-1 text-[0.625rem] font-semibold tracking-[0.22em] text-sage">COMPANION</span>
        </span>
      ) : null}
    </Link>
  );
}

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="paper min-h-dvh md:ps-[5.5rem] lg:ps-60" data-theme="gooddog">
      <SkipLink href="#main">Skip to content</SkipLink>

      {/* Desktop / tablet rail */}
      <aside className="no-print fixed inset-y-0 start-0 z-30 hidden w-[5.5rem] flex-col bg-olive px-3 py-5 md:flex lg:w-60 lg:px-4">
        <div className="mb-8 hidden lg:block">
          <Wordmark />
        </div>
        <div className="mb-8 flex justify-center lg:hidden">
          <Wordmark compact />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[0.6875rem] font-semibold text-sage transition-colors hover:bg-cream/8 hover:text-cream lg:flex-row lg:gap-3 lg:px-3 lg:text-[0.9375rem]',
                  isActive && 'bg-cream/12 text-cream',
                )
              }
            >
              <Icon className="size-5" aria-hidden strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <NavLink to="/settings" className={({ isActive }) => cn('flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[0.6875rem] font-semibold text-sage hover:bg-cream/8 hover:text-cream lg:flex-row lg:gap-3 lg:px-3 lg:text-[0.9375rem]', isActive && 'bg-cream/12 text-cream')}>
            <Settings className="size-5" aria-hidden strokeWidth={1.75} />
            Settings
          </NavLink>
        </div>
      </aside>

      {/* Top bar */}
      <header className="no-print sticky top-0 z-20 border-b border-line/70 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <div className="shrink-0 md:hidden">
            <Link to="/" className="flex items-center gap-2" aria-label="Good Dog Companion, home">
              <img src="/favicon.svg" alt="" className="size-8 rounded-[0.6rem]" />
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full border border-line bg-card px-4 text-start text-[0.9375rem] text-fg-muted shadow-[0_1px_2px_rgb(35_44_8/0.04)] transition-colors hover:border-line-strong"
          >
            <Search className="size-4 text-moss" aria-hidden />
            <span className="flex-1 truncate"><span className="sm:hidden">Search</span><span className="hidden sm:inline">Search dogs, people, notes…</span></span>
            <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 font-sans text-[0.6875rem] text-fg-muted sm:inline">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-moss px-4 text-[0.9375rem] font-semibold text-paper shadow-sm hover:bg-[#3f5133]"
          >
            <Plus className="size-5" aria-hidden />
            <span className="hidden sm:inline">New</span>
            <span className="sr-only sm:hidden">New record</span>
          </button>
          <Link to="/settings" className="inline-flex size-11 items-center justify-center rounded-full text-olive hover:bg-olive/6 md:hidden" aria-label="Settings">
            <Settings className="size-5" aria-hidden />
          </Link>
        </div>
      </header>

      {usingEmulators || demoMode ? (
        <p className="no-print border-b border-honey/20 bg-honey-soft/70 px-4 py-1.5 text-center text-xs font-medium text-[#6d4b0b]">
          {demoMode
            ? 'Demo with fictional records. Your changes stay on this device.'
            : 'Preview with fictional demonstration records. No real client data.'}
        </p>
      ) : null}

      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 pt-6 pb-32 outline-none sm:px-6 md:pb-16">
        <div key={location.pathname} className="settle">
          <Outlet />
        </div>
      </main>

      {/* Phone tab bar */}
      <nav aria-label="Main" className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-olive-2 bg-olive md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold transition-colors', isActive ? 'text-cream' : 'text-sage')}
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-cream/15')}>
                      <Icon className="size-5" aria-hidden strokeWidth={isActive ? 2.25 : 1.75} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <QuickAdd open={addOpen} onOpenChange={setAddOpen} />
      <Toaster />
    </div>
  );
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const { dogs, clients, households } = usePractice();
  const navigate = useNavigate();
  const hits = searchPractice(q, { dogs, clients, households }, 8);
  const dogMap = new Map(dogs.map((d) => [d.id, d]));
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);
  useEffect(() => setActive(0), [q]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };
  const options = [...hits.map((h) => `/${h.kind === 'dog' ? 'dogs' : 'clients'}/${h.id}`), ...(q.trim() ? [`/search?q=${encodeURIComponent(q.trim())}`] : [])];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Search" hideTitle size="md" className="bg-paper">
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 focus-within:border-moss focus-within:ring-2 focus-within:ring-moss/20">
          <Search className="size-5 text-moss" aria-hidden />
          <span className="sr-only">Search dogs, people, and notes</span>
          <input
            data-autofocus
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, options.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter' && options[active]) {
                e.preventDefault();
                go(options[active]);
              }
            }}
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls="search-results"
            aria-activedescendant={options.length ? `search-opt-${active}` : undefined}
            placeholder="Name, breed, neighborhood, phone…"
            className="h-14 flex-1 bg-transparent text-lg text-olive outline-none placeholder:text-fg-muted/60"
          />
        </label>
        <ul id="search-results" role="listbox" aria-label="Results" className="flex flex-col gap-1">
          {hits.map((h, i) => (
            <li key={`${h.kind}-${h.id}`} id={`search-opt-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(options[i])}
                className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start', i === active ? 'bg-mist' : 'hover:bg-mist/60')}
              >
                {h.kind === 'dog' ? (
                  <DogAvatar dog={dogMap.get(h.id)!} size="sm" />
                ) : (
                  <ClientInitials first={clientMap.get(h.id)!.firstName} last={clientMap.get(h.id)!.lastName} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-olive">{h.title}</span>
                  <span className="block truncate text-sm text-fg-muted">{h.subtitle || (h.kind === 'dog' ? 'Dog' : 'Client')}</span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{h.kind}</span>
              </button>
            </li>
          ))}
          {q.trim() ? (
            <li id={`search-opt-${hits.length}`} role="option" aria-selected={active === hits.length}>
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActive(hits.length)}
                onClick={() => go(options[hits.length])}
                className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start text-moss', active === hits.length ? 'bg-mist' : 'hover:bg-mist/60')}
              >
                <ClipboardList className="size-5" aria-hidden />
                <span className="flex-1 font-semibold">Search all sessions, plans and notes for “{q.trim()}”</span>
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </li>
          ) : (
            <li className="px-3 py-6 text-center text-sm text-fg-muted">Start typing a dog’s name, a person, a breed, or a neighborhood.</li>
          )}
        </ul>
      </div>
    </Dialog>
  );
}

function QuickAdd({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };
  const items = [
    { to: '/clients/new', icon: UserPlus, title: 'New client & dog', text: 'Intake a new family in one step' },
    { to: '/clients/new?inquiry=1', icon: ClipboardList, title: 'Log an inquiry', text: 'Someone reached out — capture it before you forget' },
    { to: '/sessions/new', icon: NotebookPen, title: 'Session notes', text: 'Structured or quick free-form notes' },
    { to: '/schedule/new', icon: CalendarPlus, title: 'Appointment', text: 'Add a consultation to the schedule' },
    { to: '/schedule?followup=new', icon: ListTodo, title: 'Follow-up reminder', text: 'A check-in or task with a due date' },
  ];
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Add something new" side="bottom" className="bg-paper">
      <ul className="grid gap-2 pb-2 sm:grid-cols-2">
        {items.map(({ to, icon: Icon, title, text }) => (
          <li key={to}>
            <button type="button" onClick={() => go(to)} className="flex w-full items-start gap-3 rounded-2xl border border-line bg-card p-4 text-start transition-colors hover:border-moss/50 hover:bg-white">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mist text-moss">
                <Icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold text-olive">{title}</span>
                <span className="block text-sm text-fg-muted">{text}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}
