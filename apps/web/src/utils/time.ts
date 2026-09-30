/**
 * "Tue 08:00" in a time zone. null when the time zone is not known or not
 * correct.
 */
export function formatLocalTime({
  date,
  timeZone,
}: {
  date: Date;
  timeZone: string | null;
}): string | null {
  if (timeZone === null) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  } catch {
    // An unknown time zone gives a RangeError.
    return null;
  }
}
