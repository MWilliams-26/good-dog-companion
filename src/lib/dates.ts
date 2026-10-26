import { differenceInCalendarDays, differenceInMonths, differenceInYears, format, parseISO } from 'date-fns';

export const todayISO = () => format(new Date(), 'yyyy-MM-dd');

export function isoDateOffset(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return format(d, 'yyyy-MM-dd');
}

export function fmtDate(iso?: string | null, pattern = 'MMM d, yyyy'): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

export function fmtTime(iso: string) {
  return format(parseISO(iso), 'h:mm a');
}

export function relativeDay(iso: string): string {
  const days = differenceInCalendarDays(parseISO(iso), new Date());
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${-days} days ago`;
  if (days < 7) return format(parseISO(iso), 'EEEE');
  return fmtDate(iso, 'MMM d');
}

export function daysUntil(iso: string) {
  return differenceInCalendarDays(parseISO(iso), new Date());
}

export function ageFrom(birthDate?: string, note?: string): string {
  if (!birthDate) return note ?? '';
  const b = parseISO(birthDate);
  const y = differenceInYears(new Date(), b);
  if (y >= 1) return `${y} yr${y === 1 ? '' : 's'}`;
  const m = differenceInMonths(new Date(), b);
  return `${m} mo`;
}

/** Local date + time inputs → ISO string. */
export function toISODateTime(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString();
}
