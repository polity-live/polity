const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_INPUT_PATTERN = /^\d{2}:\d{2}$/;
const DATE_TIME_LOCAL_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

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

export function parseLocalDateInput(value?: string | null): Date | undefined {
  const parts = parseDateInputParts(value);
  if (!parts) {
    return undefined;
  }

  const date = new Date(parts.year, parts.month - 1, parts.day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? undefined : date;
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

  return Number.isNaN(date.getTime()) ? null : date.getTime();
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
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function getIsoWeekdayIndex(value: Date | number | string): number {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  const weekday = date.getDay();
  return weekday === 0 ? 6 : weekday - 1;
}
