import { CollaborationError } from '@/features/collaboration/logic/types';
import { rows, type SqlTransaction } from './transaction';

// Counters are per process; durable health (outbox/integrity) comes from SQL.
export const collaborationFailures = { denied: 0, storage: 0, conflicts: 0 };
export function recordCollaborationFailure(error: unknown) {
  const category =
    error instanceof CollaborationError
      ? error.status === 401 || error.status === 403
        ? 'denied'
        : error.status < 500
          ? 'conflicts'
          : 'storage'
      : 'storage';
  collaborationFailures[category]++;
  console.warn(
    JSON.stringify({
      event: 'collaboration_failure',
      category,
      code: error instanceof CollaborationError ? error.code : 'storage_failure',
    })
  );
}
export async function collaborationDiagnostics(sql: SqlTransaction) {
  const [health] = await rows<{
    phase: string;
    compatibility: boolean;
    documents: number;
    pending_deliveries: number;
    oldest_pending_at: number | null;
    integrity_errors: number;
    schema_errors: number;
    application_conflicts: number;
    pending_exports: number;
    failed_exports: number;
  }>(
    sql,
    `select phase,compatibility,
    (select count(*)::int from collaboration_document where not deleted) as documents,
    (select count(*)::int from collaboration_document where schema_version<>1 and not deleted) as schema_errors,
    (select count(*)::int from collaboration_document where integrity_error is not null and not deleted) as integrity_errors,
    (select count(*)::int from collaboration_outbox where delivered_at is null) as pending_deliveries,
    (select min(created_at) from collaboration_outbox where delivered_at is null) as oldest_pending_at,
    (select count(*)::int from collaboration_proposal p join collaboration_document d on d.id=p.document_id where p.application_status='conflict' and not d.deleted) as application_conflicts,
    (select count(*)::int from studio_export where status in ('queued','running')) as pending_exports,
    (select count(*)::int from studio_export where status='failed') as failed_exports
    from collaboration_control where singleton`
  );
  if (!health) throw new CollaborationError('collaboration_not_initialized', 503);
  return {
    ...health,
    schemaVersion: 1,
    writeReady: health.phase === 'active' && health.schema_errors === 0,
    pendingDeliveryAgeMs:
      health.oldest_pending_at === null
        ? 0
        : Math.max(0, Date.now() - Number(health.oldest_pending_at)),
    failures: { ...collaborationFailures },
  };
}
