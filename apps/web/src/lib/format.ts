const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/// Short, glanceable age of a timestamp: "just now", "3m", "2h", "yesterday",
/// "12 Sep", "12 Sep 2024".
///
/// `now` is injectable so callers that render many timestamps compare them all
/// against the same instant instead of drifting across the list.
export function relativeTime(value: Date | string | number, now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const elapsed = now.getTime() - date.getTime();

  // A clock skewed slightly ahead of the server should read as "just now"
  // rather than as a negative age.
  if (elapsed < 45_000) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;

  const dayDelta = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (dayDelta === 0) return `${Math.floor(elapsed / HOUR)}h`;
  if (dayDelta === 1) return 'yesterday';

  const month = MONTHS[date.getMonth()] ?? '';
  const day = date.getDate();
  if (date.getFullYear() === now.getFullYear()) return `${day} ${month}`;
  return `${day} ${month} ${date.getFullYear()}`;
}

/// Full timestamp for `title` attributes and anywhere the exact moment matters
/// more than its age.
export function absoluteTime(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const month = MONTHS[date.getMonth()] ?? '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${month} ${date.getFullYear()}, ${hours}:${minutes}`;
}
