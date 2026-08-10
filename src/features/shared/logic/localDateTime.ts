import { TZDate } from '@date-fns/tz';

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_INPUT_PATTERN = /^\d{2}:\d{2}$/;
const DATE_TIME_LOCAL_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const NAIVE_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

function toDateValue(value?: Date | number | string | null): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && value <= 0) {
    return null;
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateInputParts(value?: string | null) {
  if (!value || !DATE_INPUT_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function parseTimeInputParts(value?: string | null) {
  if (!value || !TIME_INPUT_PATTERN.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(':').map(Number);
  return { hours, minutes };
}

function normalizeTimeZone(timeZone?: string | null): string {
  const normalized = timeZone?.trim();
  if (!normalized) return 'UTC';

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(0);
    return normalized;
  } catch {
    return 'UTC';
  }
}

export function parseLocalDateInput(value?: string | null): Date | undefined {
  const parts = parseDateInputParts(value);
  if (!parts) {
    return undefined;
  }

  const date = new Date(parts.year, parts.month - 1, parts.day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatLocalDateInput(value?: Date | number | string | null): string {
  const date = toDateValue(value);
  if (!date) {
    return '';
  }

  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

export function formatLocalTimeInput(value?: Date | number | string | null): string {
  const date = toDateValue(value);
  if (!date) {
    return '';
  }

  return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

export function formatLocalDateTimeInput(value?: Date | number | string | null): string {
  const date = toDateValue(value);
  if (!date) {
    return '';
  }

  return `${formatLocalDateInput(date)}T${formatLocalTimeInput(date)}`;
}

export function formatDateInputInTimeZone(
  value: Date | number | string,
  timeZone?: string | null
): string {
  const zone = normalizeTimeZone(timeZone);
  const date =
    typeof value === 'string'
      ? new TZDate(value, zone)
      : value instanceof Date
        ? new TZDate(value, zone)
        : new TZDate(value, zone);
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

export function toLocalTimestamp(
  dateInput?: string | null,
  timeInput?: string | null
): number | null {
  const dateParts = parseDateInputParts(dateInput);
  if (!dateParts) {
    return null;
  }

  const timeParts = parseTimeInputParts(timeInput ?? '00:00') ?? { hours: 0, minutes: 0 };
  const date = new Date(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hours,
    timeParts.minutes,
    0,
    0
  );

  return date.getTime();
}

export function toLocalDateTimeTimestamp(value?: string | null): number | null {
  if (!value || !DATE_TIME_LOCAL_INPUT_PATTERN.test(value)) {
    return null;
  }

  const [dateInput, timeInput] = value.split('T');
  return toLocalTimestamp(dateInput, timeInput);
}

export function toLocalEndOfDayTimestamp(dateInput?: string | null): number | null {
  const dateParts = parseDateInputParts(dateInput);
  if (!dateParts) {
    return null;
  }

  const date = new Date(dateParts.year, dateParts.month - 1, dateParts.day, 23, 59, 59, 999);
  return date.getTime();
}

export function toLocalDayTimestamp(value?: Date | number | string | null): number | null {
  const date = toDateValue(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function toLocalDeadlineTimestamp(
  dateInput?: string | null,
  timeInput?: string | null
): number | null {
  if (!dateInput) return null;
  return timeInput ? toLocalTimestamp(dateInput, timeInput) : toLocalEndOfDayTimestamp(dateInput);
}

export function isLocalEndOfDay(value?: Date | number | string | null): boolean {
  const date = toDateValue(value);
  return Boolean(
    date &&
    date.getHours() === 23 &&
    date.getMinutes() === 59 &&
    date.getSeconds() === 59 &&
    date.getMilliseconds() === 999
  );
}

export function formatOptionalLocalTimeInput(value?: Date | number | string | null): string {
  return isLocalEndOfDay(value) ? '' : formatLocalTimeInput(value);
}

export function toTimestampInTimeZone(
  value?: string | null,
  timeZone?: string | null,
  options: { dateOnlyBoundary?: 'start' | 'end' } = {}
): number | null {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return null;

  const resolvedTimeZone = normalizeTimeZone(timeZone);
  const dateParts = parseDateInputParts(normalizedValue);
  if (dateParts) {
    const endOfDay = options.dateOnlyBoundary === 'end';
    return new TZDate(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
      resolvedTimeZone
    ).getTime();
  }

  const naiveDateTime = NAIVE_DATE_TIME_PATTERN.exec(normalizedValue);
  if (naiveDateTime) {
    const [, year, month, day, hours, minutes, seconds = '0', milliseconds = '0'] = naiveDateTime;
    return new TZDate(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
      Number(milliseconds.padEnd(3, '0')),
      resolvedTimeZone
    ).getTime();
  }

  const parsed = Date.parse(normalizedValue);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getIsoWeekdayIndex(value: Date | number | string): number {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  const weekday = date.getDay();
  return weekday === 0 ? 6 : weekday - 1;
}
