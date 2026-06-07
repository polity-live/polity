import { z } from 'zod';

const dateInputPattern = /^\d{4}-\d{2}-\d{2}$/;
const timeInputPattern = /^\d{2}:\d{2}$/;
export const createEventTypeValues = [
  'delegate_assembly',
  'general_assembly',
  'open',
  'on_invite',
  'meeting',
] as const;

export type CreateEventType = (typeof createEventTypeValues)[number];

export const createEventSearchSchema = z.object({
  eventType: z.enum(createEventTypeValues).optional(),
  groupId: z.string().optional(),
  startDate: z.string().regex(dateInputPattern).optional(),
  startTime: z.string().regex(timeInputPattern).optional(),
  endDate: z.string().regex(dateInputPattern).optional(),
  endTime: z.string().regex(timeInputPattern).optional(),
  processTaskId: z.string().optional(),
  processRunId: z.string().optional(),
  stepRunId: z.string().optional(),
  amendmentId: z.string().optional(),
  minStartDate: z.string().regex(dateInputPattern).optional(),
  minStartTime: z.string().regex(timeInputPattern).optional(),
  maxStartDate: z.string().regex(dateInputPattern).optional(),
  maxStartTime: z.string().regex(timeInputPattern).optional(),
  returnTo: z.string().optional(),
});

export type CreateEventSearch = z.infer<typeof createEventSearchSchema>;

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

function formatTimeInput(date: Date): string {
  return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

function isValidDateInput(value?: string): value is string {
  return typeof value === 'string' && dateInputPattern.test(value);
}

function isValidTimeInput(value?: string): value is string {
  return typeof value === 'string' && timeInputPattern.test(value);
}

export function toCreateEventSearch(range: { start: Date; end: Date }): CreateEventSearch {
  return {
    startDate: formatDateInput(range.start),
    startTime: formatTimeInput(range.start),
    endDate: formatDateInput(range.end),
    endTime: formatTimeInput(range.end),
  };
}

export function getCreateEventSearchDefaults(search: CreateEventSearch): {
  eventType: CreateEventType;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
} {
  return {
    eventType: search.eventType ?? 'open',
    startDate: isValidDateInput(search.startDate) ? search.startDate : '',
    startTime: isValidTimeInput(search.startTime) ? search.startTime : '',
    endDate: isValidDateInput(search.endDate) ? search.endDate : '',
    endTime: isValidTimeInput(search.endTime) ? search.endTime : '',
  };
}
