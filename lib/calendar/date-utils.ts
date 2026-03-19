export function formatCalendarDateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getMonthDateRange(year: number, monthIndex: number): {
  startDate: string;
  endDate: string;
} {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return {
    startDate: formatCalendarDateKey(year, monthIndex, 1),
    endDate: formatCalendarDateKey(year, monthIndex, daysInMonth),
  };
}

export function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const lookup = (type: string) => parts.find((part) => part.type === type)?.value || '00';

  return `${lookup('year')}-${lookup('month')}-${lookup('day')}`;
}

export function getTodayDateKey(timeZone: string): string {
  return getDateKeyInTimeZone(new Date(), timeZone);
}

export function formatDateKeyLabel(
  dateKey: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-US', {
    ...options,
    timeZone,
  });
}
