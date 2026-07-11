import { table, string, number } from '@rocicorp/zero';

export const accreditation = table('accreditation')
  .columns({
    id: string(),
    event_id: string(),
    agenda_item_id: string(),
    user_id: string(),
    status: string(),
    requested_at: number(),
    decided_at: number().optional(),
    decided_by: string().optional(),
    decision_reason: string().optional(),
    confirmed_at: number().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const accreditationAudit = table('accreditation_audit')
  .columns({
    id: string(),
    accreditation_id: string(),
    event_id: string(),
    user_id: string(),
    from_status: string().optional(),
    to_status: string(),
    actor_id: string().optional(),
    reason: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');
