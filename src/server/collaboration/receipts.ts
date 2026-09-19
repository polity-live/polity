import { CollaborationError } from '@/features/collaboration/logic/types';
import { checksum } from './store';
import { rows, type SqlTransaction } from './transaction';

/** Call only after current authorization, under the authority transaction lock. */
export async function commandReceipt<T extends object>(
  sql: SqlTransaction,
  documentId: string,
  actor: string,
  operationId: string,
  request: object
) {
  const requestHash = checksum(request);
  const [previous] = await rows<{ actor_id: string; request_hash: string; result: T }>(
    sql,
    'select actor_id,request_hash,result from collaboration_command where document_id=$1 and operation_id=$2',
    [documentId, operationId]
  );
  if (previous && (previous.actor_id !== actor || previous.request_hash !== requestHash))
    throw new CollaborationError('operation_id_reused');
  return {
    previous: previous?.result,
    async record(result: T) {
      await sql.query(
        'insert into collaboration_command(document_id,operation_id,actor_id,request_hash,result,created_at) values($1,$2,$3,$4,$5::jsonb,$6)',
        [documentId, operationId, actor, requestHash, result, Date.now()]
      );
      return result;
    },
  };
}
