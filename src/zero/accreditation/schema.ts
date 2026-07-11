import { z } from 'zod';
import { timestampSchema, nullableTimestampSchema } from '../shared/helpers';

export const accreditationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'revoked']);

const baseAccreditationSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  agenda_item_id: z.string(),
  user_id: z.string(),
  status: accreditationStatusSchema,
  requested_at: timestampSchema,
  decided_at: nullableTimestampSchema,
  decided_by: z.string().nullable(),
  decision_reason: z.string().nullable(),
  confirmed_at: nullableTimestampSchema,
  created_at: timestampSchema,
});

export const selectAccreditationSchema = baseAccreditationSchema;
export const requestAccreditationSchema = z.object({
  event_id: z.string(),
  agenda_item_id: z.string(),
  password: z.string().regex(/^\d{4}$/, 'Must be a 4-digit PIN'),
});
export const createAccreditationSchema = requestAccreditationSchema;
export const decideAccreditationSchema = z.object({
  accreditation_id: z.string(),
  reason: z.string().trim().max(1000).optional(),
});
export const deleteAccreditationSchema = z.object({ id: z.string() });

export type Accreditation = z.infer<typeof selectAccreditationSchema>;
export type AccreditationStatus = z.infer<typeof accreditationStatusSchema>;
