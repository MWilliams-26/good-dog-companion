import { forwardRef, useId, useLayoutEffect, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@mwilliams/ui';

export const controlClass =
  'block w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[0.9375rem] text-olive placeholder:text-fg-muted/70 shadow-[inset_0_1px_1px_rgb(35_44_8/0.03)] transition-colors focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20 disabled:bg-mist aria-[invalid=true]:border-clay';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-olive">
        {label}
        {required ? (
          <span className="ms-1 text-clay" aria-hidden>
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="-mt-1 text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {children({ id, describedBy, invalid: !!error })}
      {error ? (
        <p id={errId} className="text-sm font-medium text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; error?: string; wrapClass?: string };

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput({ label, hint, error, required, wrapClass, className, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapClass}>
      {({ id, describedBy, invalid }) => (
        <input ref={ref} id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} aria-required={required || undefined} className={cn(controlClass, className)} {...rest} />
      )}
    </Field>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; hint?: ReactNode; error?: string; wrapClass?: string; badge?: ReactNode };

/** Auto-growing textarea, so long notes never hide inside a scroll box. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextArea({ label, hint, error, required, wrapClass, className, badge, rows = 3, ...rest }, ref) {
  return (
    <Field label={<span className="inline-flex items-center gap-2">{label}{badge}</span>} hint={hint} error={error} required={required} className={wrapClass}>
      {({ id, describedBy, invalid }) => (
        <AutoGrow ref={ref} id={id} rows={rows} aria-describedby={describedBy} aria-invalid={invalid || undefined} aria-required={required || undefined} className={cn(controlClass, 'resize-none leading-relaxed', className)} {...rest} />
      )}
    </Field>
  );
});

export const AutoGrow = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AutoGrow({ onInput, ...props }, ref) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const fit = () => {
    const el = inner.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  };
  useLayoutEffect(fit);
  return (
    <textarea
      ref={(el) => {
        inner.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      onInput={(e) => {
        fit();
        onInput?.(e);
      }}
      {...props}
    />
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  wrapClass?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
};

export const SelectInput = forwardRef<HTMLSelectElement, SelectProps>(function SelectInput({ label, hint, error, required, wrapClass, options, placeholder, className, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapClass}>
      {({ id, describedBy, invalid }) => (
        <select ref={ref} id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} aria-required={required || undefined} className={cn(controlClass, 'appearance-none bg-[url(/chevron.svg)] bg-[length:1rem] bg-[right_0.875rem_center] bg-no-repeat pe-10', className)} {...rest}>
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
});

export function Checkbox({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-line-strong accent-moss" {...rest} />
      <label htmlFor={id} className="cursor-pointer text-[0.9375rem] text-olive">
        {label}
        {hint ? <span className="block text-xs text-fg-muted">{hint}</span> : null}
      </label>
    </div>
  );
}

/** Pill multi-select (native checkboxes) used for concerns and similar tags. */
export function ChipSelect({
  legend,
  options,
  value,
  onChange,
  hint,
}: {
  legend: ReactNode;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  hint?: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-olive">{legend}</legend>
      {hint ? <p className="-mt-1 mb-1 text-xs text-fg-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = value.includes(opt);
          return (
            <label
              key={opt}
              className={cn(
                'relative inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-moss/40',
                on ? 'border-moss bg-moss text-paper' : 'border-line bg-white text-olive hover:border-line-strong',
              )}
            >
              <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? value.filter((v) => v !== opt) : [...value, opt])} />
              {opt}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-8 flex justify-end gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur md:bottom-0">{children}</div>;
}
