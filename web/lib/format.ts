import { formatDistanceToNow, parseISO } from 'date-fns';

export function relativeTime(value: string) {
  try { return formatDistanceToNow(parseISO(value), { addSuffix: true }); } catch { return value; }
}
export function titleCase(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
