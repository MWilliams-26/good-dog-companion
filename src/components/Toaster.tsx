import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { cn } from '@mwilliams/ui';
import { useToasts } from '../stores/toast';

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'settle pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg',
            t.tone === 'error' ? 'bg-clay text-white' : 'bg-olive text-cream',
          )}
        >
          {t.tone === 'success' ? <CheckCircle2 className="size-4 shrink-0" aria-hidden /> : t.tone === 'error' ? <AlertTriangle className="size-4 shrink-0" aria-hidden /> : <Info className="size-4 shrink-0" aria-hidden />}
          <span>{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} className="-me-1 rounded-full p-1 opacity-70 hover:opacity-100" aria-label="Dismiss">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
