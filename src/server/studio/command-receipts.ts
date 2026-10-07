import type postgres from 'postgres';
import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';
import type { ZeroTransaction } from '@/server/zero-mutate';
import { withZeroTransaction } from '@/server/zero-mutate';
import { checksum } from '@/server/checksum';
import {
  encodeAppError,
  parseAppError,
  type AppErrorCode,
} from '@/features/shared/errors/app-error';
import { withStudioTransaction } from './context';
import { StudioError } from './db';

// This error crosses Zero's logging boundary. Database causes can contain tokens or documents.
function publicCommandError(code: AppErrorCode) {
  return new Error(encodeAppError(code));
}

export async function studioCommandResult(
  tx: Transaction<Schema>,
  actor: string,
  command: string,
  input: { operationId: string; projectId?: string },
  body: () => Promise<unknown>
) {
  if (!actor || actor === 'anon') throw new Error(encodeAppError('permission_denied'));
  if (tx.location !== 'server') throw new Error(encodeAppError('action_blocked'));
  const sql = tx.dbTransaction.wrappedTransaction;
  const hash = checksum({ command, input });
  const [prior] =
    await sql`select actor_id,input_hash,result,expires_at from studio_command_receipt where id=${input.operationId}`;
  if (prior) {
    if (prior.actor_id !== actor || prior.input_hash !== hash)
      throw new Error(encodeAppError('already_exists'));
    if (prior.expires_at !== null && prior.expires_at <= Date.now())
      throw new Error(encodeAppError('action_blocked'));
    return;
  }
  try {
    const result = await withZeroTransaction(tx as unknown as ZeroTransaction, () =>
      withStudioTransaction(sql as unknown as postgres.TransactionSql, input.operationId, body)
    );
    if (command === 'canvas') return;
    const expiresAt = command === 'beginUpload' ? Date.now() + 2 * 60 * 60 * 1000 : null;
    await sql`insert into studio_command_receipt(id,actor_id,project_id,command,input_hash,result,created_at,expires_at) values(${input.operationId},${actor},${input.projectId ?? null},${command},${hash},${JSON.stringify(result ?? null)}::text::jsonb,${Date.now()},${expiresAt})`;
  } catch (error) {
    if (error instanceof Error && parseAppError(error.message)) throw error;
    const code =
      error instanceof StudioError
        ? (error.code ??
          (
            {
              403: 'permission_denied',
              404: 'resource_not_found',
              409: 'project_revision_conflict',
              502: 'external_service_failed',
            } as const
          )[error.status as 403 | 404 | 409 | 502] ??
          'validation_failed')
        : 'mutation_server_failed';
    console.error('studio.command_failed', {
      operationId: input.operationId,
      mutator: command,
      code,
    });
    throw publicCommandError(code);
  }
}
