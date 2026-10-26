import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '../stores/auth';
import { Button, ErrorNote } from '../components/ui';
import { TextInput } from '../components/form';
import { demoMode, usingEmulators } from '../lib/firebase';

const schema = z.object({
  email: z.string().trim().email('Enter the email address for your account.'),
  password: z.string().min(1, 'Enter your password.'),
});

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="gooddog" className="grid min-h-dvh bg-olive lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-cream lg:flex">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-11 rounded-xl ring-1 ring-cream/20" />
          <div className="leading-none">
            <p className="text-lg font-extrabold tracking-[0.03em]">GOOD DOG</p>
            <p className="mt-1 text-[0.6875rem] font-semibold tracking-[0.24em] text-sage">BEHAVIOR CONSULTANTS</p>
          </div>
        </div>
        <div className="max-w-md">
          <p className="font-serif text-[2.75rem] leading-[1.08] font-normal">Every dog really is a Good Dog.</p>
          <p className="mt-5 text-[0.9375rem] leading-relaxed text-sage">Cases, assessments, plans and progress — kept together, kept private, and ready when you are.</p>
        </div>
        <p className="text-xs tracking-wide text-sage/80">Compassionate. Professional. Effective.</p>
        <svg aria-hidden viewBox="0 0 400 400" className="pointer-events-none absolute -right-24 -bottom-24 size-[28rem] text-cream/[0.04]" fill="currentColor">
          <ellipse cx="200" cy="250" rx="80" ry="66" />
          <ellipse cx="110" cy="165" rx="32" ry="42" transform="rotate(-18 110 165)" />
          <ellipse cx="166" cy="112" rx="32" ry="44" transform="rotate(-6 166 112)" />
          <ellipse cx="234" cy="112" rx="32" ry="44" transform="rotate(6 234 112)" />
          <ellipse cx="290" cy="165" rx="32" ry="42" transform="rotate(18 290 165)" />
        </svg>
      </div>
      <div className="paper flex items-center justify-center px-5 py-12 lg:rounded-s-[2.5rem]">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const signIn = useAuth((s) => s.signIn);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    // The public demo opens with its fictional account filled in.
    defaultValues: demoMode ? { email: 'haley@gooddog.demo', password: 'GoodDog!2026' } : undefined,
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(code.includes('too-many-requests') ? 'Too many attempts. Wait a minute and try again.' : 'That email and password don’t match an account.');
    }
  });

  return (
    <Frame>
      <div className="mb-8 lg:hidden">
        <img src="/favicon.svg" alt="" className="mb-4 size-12 rounded-xl" />
      </div>
      <h1 className="font-serif text-[2rem] font-medium text-olive">Welcome back</h1>
      <p className="mt-1 mb-8 text-[0.9375rem] text-fg-muted">Sign in to Good Dog Companion.</p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextInput label="Email" type="email" autoComplete="username" error={formState.errors.email?.message} {...register('email')} />
        <TextInput label="Password" type="password" autoComplete="current-password" error={formState.errors.password?.message} {...register('password')} />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" size="lg" busy={formState.isSubmitting} className="mt-2 w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-fg-muted">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Private practice records. Accounts are created by the practice owner; there is no public sign-up.
      </p>
      {usingEmulators || demoMode ? (
        <div className="mt-6 rounded-2xl border border-honey/25 bg-honey-soft/60 p-4 text-xs leading-relaxed text-[#6d4b0b]">
          <p className="font-semibold">{demoMode ? 'Demo sign-in (fictional practice)' : 'Preview sign-in (fictional data)'}</p>
          <p className="mt-1">haley@gooddog.demo · GoodDog!2026</p>
          {demoMode ? <p className="mt-1">Everything you change stays in this browser.</p> : null}
        </div>
      ) : null}
    </Frame>
  );
}

export function NoAccessPage() {
  const { user, signOut } = useAuth();
  return (
    <Frame>
      <h1 className="font-serif text-[2rem] font-medium text-olive">No access</h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-fg-muted">
        You’re signed in as <strong className="text-olive">{user?.email}</strong>, but this account isn’t authorized to view practice records.
        Ask the practice owner to grant access.
      </p>
      <Button variant="secondary" className="mt-8" onClick={() => void signOut()}>
        Sign out
      </Button>
    </Frame>
  );
}
