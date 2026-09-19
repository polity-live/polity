import { commandReceipt } from './receipts';
import { createHash } from 'node:crypto';
import * as Y from 'yjs';
import {
  createZeroContext,
  executeZeroTransaction,
  type ZeroTransaction,
} from '@/server/zero-mutate';
import {
  CollaborationError,
  roomName,
  type CollaborationReference,
  type CollaborationSession,
} from '@/features/collaboration/logic/types';
import { assertActive, lockAuthority, migrationState, rows, sqlTransaction } from './transaction';
import { resolveAccess } from './access';
import { commitState, createStored, findStored, loadStored, type StoredDocument } from './store';

export function referenceOf(doc: StoredDocument): CollaborationReference {
  return {
    kind: doc.kind,
    entityId: doc.entity_id,
    branchId: doc.branch_id,
    workspaceId: doc.workspace_id,
  };
}
export async function authorizeStored(
  tx: ZeroTransaction,
  actor: string,
  doc: StoredDocument,
  generation?: string,
  write = false
) {
  if (doc.deleted) throw new CollaborationError('document_not_found', 404);
  if (generation && doc.generation !== generation)
    throw new CollaborationError('generation_changed');
  const access = await resolveAccess(tx, actor, referenceOf(doc));
  if (doc.workspace_type === 'canonical') {
    const [ballot] = await rows(
      sqlTransaction(tx),
      `select 1 from collaboration_ballot b join vote v on v.id=b.vote_id
      where b.document_id=$1 and b.change_request_id is null and v.status in ('internal','indicative','final') limit 1`,
      [doc.id]
    );
    if (ballot) access.capabilities.edit = false;
  }
  if (doc.workspace_type !== 'canonical') {
    if (doc.owner_id !== actor && (!doc.shared || !access.capabilities.suggest))
      throw new CollaborationError('access_denied', 403);
    access.capabilities.edit = access.capabilities.suggest && !doc.frozen;
  }
  if (write && (doc.frozen || !access.capabilities.edit))
    throw new CollaborationError('write_denied', 403);
  return access;
}
function session(
  doc: StoredDocument,
  capabilities: CollaborationSession['capabilities'],
  compatibility = false,
  amendmentId: string | null = null
): CollaborationSession {
  return {
    id: doc.id,
    reference: referenceOf(doc),
    generation: doc.generation,
    revision: doc.revision,
    checksum: doc.checksum,
    state: Buffer.from(doc.state).toString('base64'),
    capabilities,
    websocket: process.env.COLLABORATION_WEBSOCKET_URL || 'ws://localhost:1236',
    room: roomName(doc.id, doc.generation),
    transport: compatibility ? 'http' : 'websocket',
    draftAction: amendmentId ? 'proposal' : 'publish',
    ...(doc.integrity_error
      ? {
          integrityError: doc.integrity_error,
          readableRevision: doc.readableRevision,
          capabilities: { ...capabilities, edit: false, suggest: false, comment: false },
        }
      : {}),
  };
}
export async function openSession(actor: string, reference: CollaborationReference) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await lockAuthority(sql);
    const phase = await migrationState(sql);
    if (phase !== 'active') return { phase };
    const access = await resolveAccess(tx, actor, reference);
    let doc = await findStored(sql, access.reference, true);
    if (!doc) {
      if (reference.workspaceId) throw new CollaborationError('document_not_found', 404);
      doc = await createStored(sql, access.reference, access.content, actor);
    }
    const current = await authorizeStored(tx, actor, doc);
    const [control] = await rows<{ compatibility: boolean }>(
      sql,
      'select compatibility from collaboration_control where singleton'
    );
    return {
      phase,
      session: session(doc, current.capabilities, control.compatibility, current.amendmentId),
    };
  });
}
export async function readSession(actor: string, id: string, generation: string) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await lockAuthority(sql);
    await assertActive(sql);
    const doc = await loadStored(sql, id, true);
    const access = await authorizeStored(tx, actor, doc, generation);
    const [control] = await rows<{ compatibility: boolean }>(
      sql,
      'select compatibility from collaboration_control where singleton'
    );
    return session(doc, access.capabilities, control.compatibility, access.amendmentId);
  });
}
/** Called before Hocuspocus applies/broadcasts an incoming update. */
export async function acceptUpdate(
  actor: string,
  id: string,
  generation: string,
  update: Uint8Array,
  allowUnchangedRead = false
) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await lockAuthority(sql);
    await assertActive(sql);
    const doc = await loadStored(sql, id);
    await authorizeStored(
      tx,
      actor,
      doc,
      generation,
      !allowUnchangedRead || !isEmptyUpdate(doc.state, update)
    );
    const operationId = `update:${generation}:${createHash('sha256').update(update).digest('hex')}`;
    if ((doc.kind === 'document' || doc.kind === 'blog') && doc.workspace_type === 'canonical') {
      const { candidateDocument } = await import('@/features/collaboration/logic/codec');
      const { suggestionIds } = await import('@/features/collaboration/logic/proposals');
      const candidate = candidateDocument(doc.kind, doc.state, update);
      if (suggestionIds(candidate.projection).size)
        throw new CollaborationError('proposal_requires_workspace', 422);
    }
    if (doc.kind === 'studio') {
      const { candidateDocument } = await import('@/features/collaboration/logic/codec');
      const { validateStudioAssetsInTransaction } = await import('./studio-assets');
      const candidate = candidateDocument(doc.kind, doc.state, update);
      await validateStudioAssetsInTransaction(sql, doc.entity_id, candidate.projection);
    }
    return commitState(sql, doc, update, actor, operationId);
  });
}
export function acceptSync(actor: string, id: string, generation: string, update: Uint8Array) {
  return acceptUpdate(actor, id, generation, update, true);
}
export async function createWorkspace(
  actor: string,
  id: string,
  generation: string,
  expectedRevision: number,
  operationId: string,
  type: 'proposal' | 'followup'
) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await lockAuthority(sql);
    await assertActive(sql);
    const base = await loadStored(sql, id);
    const access = await authorizeStored(tx, actor, base);
    if (!access.capabilities.suggest || base.workspace_type !== 'canonical')
      throw new CollaborationError('suggestion_denied', 403);
    const receipt = await commandReceipt<{ id: string }>(sql, id, actor, operationId, {
      operation: 'workspace',
      generation,
      expectedRevision,
      type,
    });
    if (receipt.previous) {
      const existing = await loadStored(sql, receipt.previous.id);
      const rights = await authorizeStored(tx, actor, existing);
      return session(existing, rights.capabilities, false, rights.amendmentId);
    }
    const reference = { ...referenceOf(base), workspaceId: operationId };
    if (base.generation !== generation || base.revision !== expectedRevision)
      throw new CollaborationError('revision_changed');
    const draft = await createStored(sql, reference, base.projection, actor, { type, base });
    await receipt.record({ id: draft.id });
    return session(draft, { ...access.capabilities, edit: true }, false, access.amendmentId);
  });
}

export async function listWorkspaces(actor: string, reference: CollaborationReference) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await assertActive(sql);
    const access = await resolveAccess(tx, actor, { ...reference, workspaceId: null });
    const documents = await rows<StoredDocument>(
      sql,
      `select * from collaboration_document where kind=$1 and entity_id=$2 and branch_id is not distinct from $3::uuid
      and workspace_type<>'canonical' and not deleted and (owner_id=$4 or (shared and $5)) order by updated_at desc`,
      [
        reference.kind,
        reference.entityId,
        access.reference.branchId,
        actor,
        access.capabilities.suggest,
      ]
    );
    return documents.map(doc => {
      if (!doc.workspace_id) throw new CollaborationError('invalid_workspace', 503);
      return {
        id: doc.workspace_id,
        owner: doc.owner_id === actor,
        shared: doc.shared,
        frozen: doc.frozen,
        type: doc.workspace_type,
      };
    });
  });
}
export async function shareWorkspace(
  actor: string,
  id: string,
  generation: string,
  shared: boolean
) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await assertActive(sql);
    const doc = await loadStored(sql, id);
    await authorizeStored(tx, actor, doc, generation);
    if (doc.workspace_type === 'canonical' || doc.owner_id !== actor)
      throw new CollaborationError('share_denied', 403);
    await sql.query(
      'update collaboration_document set shared=$1,generation=gen_random_uuid(),updated_at=$2 where id=$3',
      [shared, Date.now(), id]
    );
    await sql.query(
      'insert into collaboration_outbox(document_id,generation,revision,created_at) select id,generation,revision,updated_at from collaboration_document where id=$1',
      [id]
    );
    return { shared };
  });
}
/** A send and the permission read use one authority lock, including revocation races. */
export async function authorizedDelivery(
  actor: string,
  id: string,
  generation: string,
  send: () => void
) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await lockAuthority(sql);
    await assertActive(sql);
    await authorizeStored(tx, actor, await loadStored(sql, id), generation);
    send();
  });
}
export async function committedState(actor: string, id: string, generation: string) {
  const loaded = await readSession(actor, id, generation);
  return { ...loaded, bytes: Buffer.from(loaded.state, 'base64') };
}
export function isEmptyUpdate(state: Uint8Array, incoming: Uint8Array) {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, state);
    return Y.snapshotContainsUpdate(Y.snapshot(doc), incoming);
  } finally {
    doc.destroy();
  }
}
