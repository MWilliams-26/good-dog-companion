import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@mwilliams/ui';
import { AlertTriangle, ChevronLeft, Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap';

const variants: Record<Variant, string> = {
  primary: 'bg-moss text-paper hover:bg-[#3f5133] shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_1px_2px_rgb(35_44_8/0.2)]',
  secondary: 'bg-card text-olive border border-line hover:border-line-strong hover:bg-white',
  ghost: 'text-olive hover:bg-olive/6',
  quiet: 'text-moss hover:text-olive underline-offset-4 hover:underline px-0',
  danger: 'bg-clay text-white hover:bg-[#8f3c21]',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[0.9375rem]',
  lg: 'h-12 px-5 text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], variant === 'quiet' ? 'h-auto' : sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', busy, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Card({ className, children, as: As = 'div', ...rest }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' | 'li' } & Record<string, unknown>) {
  return (
    <As className={cn('rounded-card border border-line/80 bg-card shadow-[0_1px_2px_rgb(35_44_8/0.04)]', className)} {...rest}>
      {children}
    </As>
  );
}

export function PageHeader({
  title,
  eyebrow,
  back,
  actions,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3">
      {back ? (
        <Link to={back.to} className="-ms-1 inline-flex w-fit items-center gap-1 rounded-control py-1 pe-2 text-sm font-medium text-fg-muted hover:text-olive">
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-moss-soft">{eyebrow}</p> : null}
          <h1 className="font-serif text-[2rem] leading-tight font-medium text-olive sm:text-[2.375rem]">{title}</h1>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-moss-soft">
        {children}
      </h2>
      {action}
    </div>
  );
}

type Tone = 'neutral' | 'moss' | 'clay' | 'honey' | 'sky' | 'olive';
const tones: Record<Tone, string> = {
  neutral: 'bg-mist text-olive',
  moss: 'bg-[#e3ead9] text-[#34452a]',
  clay: 'bg-clay-soft text-[#7f3219]',
  honey: 'bg-honey-soft text-[#6d4b0b]',
  sky: 'bg-sky-soft text-[#2c4757]',
  olive: 'bg-olive text-cream',
};

export function Tag({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong/50 px-6 py-10 text-center">
      {icon ? <div className="mb-1 text-sage">{icon}</div> : null}
      <p className="font-serif text-lg text-olive">{title}</p>
      {children ? <p className="max-w-sm text-sm text-fg-muted">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-fg-muted" aria-live="polite">
      <Loader2 className="size-5 animate-spin text-moss" aria-hidden />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-card bg-mist/70" />
      ))}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-card border border-clay/30 bg-clay-soft/60 px-4 py-3 text-sm text-[#7f3219]">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function NotFound({ what, back }: { what: string; back: { to: string; label: string } }) {
  return (
    <div className="settle">
      <PageHeader title={`${what} not found`} back={back} />
      <EmptyState title="Nothing here">This record may have been archived, or the link is incorrect.</EmptyState>
    </div>
  );
}

/** Label / value pair used across profile pages. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  if (children === undefined || children === null || children === '') return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-fg-muted">{label}</dt>
      <dd className="mt-0.5 break-words whitespace-pre-line text-[0.9375rem] text-olive">{children}</dd>
    </div>
  );
}

export function Prose({ children, className }: { children?: string | null; className?: string }) {
  if (!children) return null;
  return <p className={cn('whitespace-pre-line text-[0.9375rem] leading-relaxed text-olive', className)}>{children}</p>;
}

export function PrivateLabel() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-olive px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-cream">
      Private
    </span>
  );
}
