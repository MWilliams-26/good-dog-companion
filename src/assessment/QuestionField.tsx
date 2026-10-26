import { memo, useId, useRef, useState } from 'react';
import { cn } from '@mwilliams/ui';
import { Plus, X, MessageSquarePlus, History } from 'lucide-react';
import type { AnswerValue, Question, QuestionResponse } from '../lib/types';
import { AutoGrow, controlClass } from '../components/form';
import { formatAnswer, hasValue } from './logic';

interface Props {
  question: Question;
  response: QuestionResponse | undefined;
  previous?: QuestionResponse;
  onChange: (id: string, next: QuestionResponse | undefined) => void;
}

const pill = (on: boolean) =>
  cn(
    'relative inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-moss/40',
    on ? 'border-moss bg-moss text-paper' : 'border-line bg-white text-olive hover:border-line-strong',
  );

function SourceToggle({ question, response, set }: { question: Question; response?: QuestionResponse; set: (s: 'reported' | 'observed') => void }) {
  if (question.source !== 'either') {
    return (
      <span className={cn('rounded-full px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] uppercase', question.source === 'observed' ? 'bg-sky-soft text-sky' : 'bg-cream text-honey')}>
        {question.source === 'observed' ? 'Observed' : 'Client reported'}
      </span>
    );
  }
  const current = response?.source ?? 'reported';
  return (
    <span role="group" aria-label="Source of this answer" className="inline-flex overflow-hidden rounded-full border border-line text-[0.6875rem] font-bold tracking-[0.06em] uppercase">
      {(['reported', 'observed'] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={current === s}
          onClick={() => set(s)}
          className={cn('px-2.5 py-1', current === s ? (s === 'observed' ? 'bg-sky text-white' : 'bg-honey text-white') : 'bg-white text-fg-muted hover:text-olive')}
        >
          {s === 'reported' ? 'Reported' : 'Observed'}
        </button>
      ))}
    </span>
  );
}

function ListInput({ value, onChange, label }: { value: string[]; onChange: (v: string[]) => void; label: string }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const rows = value.length ? value : [''];
  const update = (i: number, text: string) => onChange(rows.map((r, j) => (j === i ? text : r)));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-4 text-center text-sm text-sage" aria-hidden>
            •
          </span>
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={row}
            aria-label={`${label}, item ${i + 1}`}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onChange([...rows.slice(0, i + 1), '', ...rows.slice(i + 1)]);
                setTimeout(() => refs.current[i + 1]?.focus());
              } else if (e.key === 'Backspace' && row === '' && rows.length > 1) {
                e.preventDefault();
                onChange(rows.filter((_, j) => j !== i));
                setTimeout(() => refs.current[Math.max(0, i - 1)]?.focus());
              }
            }}
            className={cn(controlClass, 'py-2')}
          />
          {rows.length > 1 ? (
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove item ${i + 1}`} className="rounded-full p-2 text-fg-muted hover:bg-mist">
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          onChange([...rows, '']);
          setTimeout(() => refs.current[rows.length]?.focus());
        }}
        className="inline-flex w-fit items-center gap-1 ps-6 text-sm font-semibold text-moss hover:underline"
      >
        <Plus className="size-4" aria-hidden />
        Add item
      </button>
    </div>
  );
}

function Input({ question, value, set, labelId }: { question: Question; value: AnswerValue | undefined; set: (v: AnswerValue) => void; labelId: string }) {
  const name = useId();
  switch (question.type) {
    case 'text':
      return <input aria-labelledby={labelId} className={controlClass} value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} />;
    case 'longText':
      return <AutoGrow aria-labelledby={labelId} rows={3} className={cn(controlClass, 'resize-none leading-relaxed')} value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} />;
    case 'number':
      return <input aria-labelledby={labelId} type="number" inputMode="decimal" className={cn(controlClass, 'max-w-40')} value={value === null || value === undefined ? '' : String(value)} onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} />;
    case 'date':
      return <input aria-labelledby={labelId} type="date" className={cn(controlClass, 'max-w-52')} value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} />;
    case 'yesNo':
      return (
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
          {[
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unsure', 'Unsure'],
          ].map(([v, l]) => (
            <label key={v} className={pill(value === v)}>
              <input type="radio" className="sr-only" name={name} checked={value === v} onChange={() => set(v)} />
              {l}
            </label>
          ))}
        </div>
      );
    case 'singleChoice':
      return (
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
          {(question.options ?? []).map((o) => (
            <label key={o} className={pill(value === o)}>
              <input type="radio" className="sr-only" name={name} checked={value === o} onChange={() => set(o)} onClick={() => value === o && set(null)} />
              {o}
            </label>
          ))}
        </div>
      );
    case 'multiChoice': {
      const arr = Array.isArray(value) ? value : [];
      return (
        <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
          {(question.options ?? []).map((o) => {
            const on = arr.includes(o);
            return (
              <label key={o} className={pill(on)}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => set(on ? arr.filter((x) => x !== o) : [...arr, o])} />
                {o}
              </label>
            );
          })}
        </div>
      );
    }
    case 'scale': {
      const [lo, hi] = question.scaleLabels ?? ['', ''];
      return (
        <div>
          <div role="radiogroup" aria-labelledby={labelId} className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={cn(pill(value === n), 'w-11 justify-center')}>
                <input type="radio" className="sr-only" name={name} checked={value === n} onChange={() => set(n)} />
                {n}
              </label>
            ))}
          </div>
          {lo || hi ? (
            <div className="mt-1 flex max-w-[16.5rem] justify-between text-xs text-fg-muted">
              <span>{lo}</span>
              <span>{hi}</span>
            </div>
          ) : null}
        </div>
      );
    }
    case 'list':
      return <ListInput label={question.label} value={Array.isArray(value) ? (value as string[]) : []} onChange={set} />;
  }
}

export const QuestionField = memo(function QuestionField({ question, response, previous, onChange }: Props) {
  const labelId = useId();
  const [noteOpen, setNoteOpen] = useState(!!response?.note);
  const status = response?.status ?? 'answered';

  const patch = (p: Partial<QuestionResponse>) => {
    const next: QuestionResponse = { status: 'answered', ...(question.source !== 'either' ? { source: question.source } : {}), ...response, ...p };
    onChange(question.id, next);
  };

  return (
    <div id={`q-${question.id}`} className={cn('scroll-mt-40 rounded-2xl border bg-card p-4 transition-colors sm:p-5', status !== 'answered' ? 'border-dashed border-line-strong/50 bg-paper' : 'border-line/80')}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p id={labelId} className="font-semibold text-olive">
            {question.label}
            {question.required ? (
              <>
                <span className="ms-1 text-clay" aria-hidden>
                  *
                </span>
                <span className="sr-only"> (required)</span>
              </>
            ) : null}
          </p>
          {question.help ? <p className="mt-0.5 text-sm text-fg-muted">{question.help}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {question.private ? (
            <span className="rounded-full bg-olive px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] text-cream uppercase" title="Consultant-only by default">
              Private
            </span>
          ) : null}
          <SourceToggle question={question} response={response} set={(s) => patch({ source: s })} />
        </div>
      </div>

      {status === 'answered' ? (
        <Input question={question} value={response?.value} set={(v) => patch({ value: v, status: 'answered' })} labelId={labelId} />
      ) : (
        <p className="text-sm font-medium text-fg-muted">{status === 'notAssessed' ? 'Marked not assessed' : 'Marked not applicable'}</p>
      )}

      {previous && hasValue(previous) && !hasValue(response) && status === 'answered' ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-mist/60 px-3 py-2 text-sm">
          <History className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden />
          <p className="min-w-0 flex-1 whitespace-pre-line text-olive/90">
            <span className="font-semibold">Last time: </span>
            {formatAnswer(question, previous)}
          </p>
          <button type="button" onClick={() => onChange(question.id, { ...previous, note: undefined })} className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-moss hover:bg-cream">
            Still true
          </button>
        </div>
      ) : null}

      {noteOpen ? (
        <div className="mt-3">
          <AutoGrow
            aria-label={`Note for: ${question.label}`}
            placeholder="Note (context, uncertainty, follow-up)…"
            rows={1}
            className={cn(controlClass, 'resize-none bg-paper py-2 text-sm')}
            value={response?.note ?? ''}
            onChange={(e) => patch({ note: e.target.value })}
          />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1 text-xs">
        <div role="group" aria-label="Answer status" className="inline-flex rounded-full bg-mist/70 p-0.5">
          {(
            [
              ['answered', 'Answer'],
              ['notAssessed', 'Not assessed'],
              ['notApplicable', 'N/A'],
            ] as const
          ).map(([s, l]) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => (s === 'answered' ? patch({ status: 'answered' }) : patch({ status: s, value: null }))}
              className={cn('rounded-full px-2.5 py-1 font-semibold', status === s ? 'bg-white text-olive shadow-sm' : 'text-fg-muted hover:text-olive')}
            >
              {l}
            </button>
          ))}
        </div>
        {!noteOpen ? (
          <button type="button" onClick={() => setNoteOpen(true)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-fg-muted hover:bg-mist hover:text-olive">
            <MessageSquarePlus className="size-3.5" aria-hidden />
            Note
          </button>
        ) : null}
      </div>
    </div>
  );
});
