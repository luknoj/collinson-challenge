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

// The API gives local dates of the town ("2026-03-04"). The formats below use
// UTC, so that the time zone of the user does not change the day.

const DAY_NAME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
});

const DAY_AND_DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** "2026-03-04" → "Wed". */
export function formatDayName(date: string): string {
  return DAY_NAME.format(utcDate(date));
}

/** "2026-03-04" → "Wed 4 Mar". */
export function formatDate(date: string): string {
  return DAY_AND_DATE.format(utcDate(date)).replace(',', '');
}
