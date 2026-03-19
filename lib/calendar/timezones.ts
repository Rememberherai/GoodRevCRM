const FALLBACK_TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
] as const;

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
};

export function getSupportedTimezones(): string[] {
  const timezones = (Intl as IntlWithSupportedValues).supportedValuesOf?.('timeZone');

  if (timezones && timezones.length > 0) {
    return timezones;
  }

  return [...FALLBACK_TIMEZONES];
}

export function formatTimezoneLabel(timezone: string): string {
  return timezone.replace(/_/g, ' ');
}
