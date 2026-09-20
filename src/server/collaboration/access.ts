import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';
import { can, type PermissionCheck } from '@/zero/rbac/can';
import { isPermissionError } from '@/zero/rbac/errors';
import {
  CollaborationError,
  type CollaborationCapabilities,
  type CollaborationReference,
} from '@/features/collaboration/logic/types';
import { rows, sqlTransaction } from './transaction';

export async function permitted(tx: Transaction<Schema>, userId: string, check: PermissionCheck) {
  try {
    await can(tx, { userID: userId }, check);
    return true;
  } catch (error) {
    if (isPermissionError(error)) return false;
    throw error;
  }
}
/** Only Studio uses Yjs. Cached clients cannot reopen former legacy-editor rooms. */
export async function resolveAccess(
  tx: Transaction<Schema>,
  userId: string,
  reference: CollaborationReference
) {
  if (!userId || userId === 'anon') throw new CollaborationError('authentication_required', 401);
  if (reference.kind !== 'studio') throw new CollaborationError('legacy_editor_required', 410);
  const [project] = await rows<{ document: unknown; read: boolean; edit: boolean }>(
    sqlTransaction(tx),
    'select s.document, studio_access($1::uuid,p.id,false) as read,studio_access($1::uuid,p.id,true) as edit from studio_project p join studio_state s on s.project_id=p.id where p.id=$2',
    [userId, reference.entityId]
  );
  if (!project?.read || reference.branchId) throw new CollaborationError('access_denied', 403);
  const capabilities: CollaborationCapabilities = {
    read: true,
    edit: project.edit,
    suggest: project.edit,
    comment: project.edit,
    vote: false,
    manage: project.edit,
  };
  return {
    reference,
    content: project.document,
    mode: 'edit',
    amendmentId: null as string | null,
    capabilities,
  };
}
