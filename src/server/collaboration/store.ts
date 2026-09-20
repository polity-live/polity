import { createHash } from 'node:crypto';
import * as Y from 'yjs';
import {
  candidateDocument,
  projectDocument,
  seedDocument,
  stableJson,
} from '@/features/collaboration/logic/codec';
import {
  CollaborationError,
  type CollaborationReference,
  type DocumentKind,
} from '@/features/collaboration/logic/types';
import { rows, type SqlTransaction } from './transaction';
import { suggestionIds } from '@/features/collaboration/logic/proposals';

export interface StoredDocument {
  id: string;
  kind: DocumentKind;
  entity_id: string;
  branch_id: string | null;
  workspace_id: string | null;
  workspace_type: 'canonical' | 'proposal' | 'followup';
  owner_id: string | null;
  base_document_id: string | null;
  base_revision: number | null;
  generation: string;
  revision: number;
  checksum: string;
  state: Uint8Array;
  projection: unknown;
  frozen: boolean;
  deleted: boolean;
  shared: boolean;
  integrity_error?: string | null;
  readableRevision?: number;
}
export function checksum(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}
export function assertStoredIntegrity(doc: StoredDocument) {
  const snapshot = candidateDocument(doc.kind, doc.state, new Uint8Array([0, 0]));
  if (checksum(snapshot.projection) !== doc.checksum || checksum(doc.projection) !== doc.checksum) {
    console.error('Collaboration integrity violation', {
      documentId: doc.id,
      revision: doc.revision,
    });
    throw new CollaborationError('integrity_violation', 503);
  }
}
export async function loadStored(tx: SqlTransaction, id: string, readable = false) {
  const [doc] = await rows<StoredDocument>(
    tx,
    'select * from collaboration_document where id=$1 for update',
    [id]
  );
  if (!doc || doc.deleted) throw new CollaborationError('document_not_found', 404);
  doc.revision = Number(doc.revision);
  if (readable) return readableStored(tx, doc);
  if (doc.integrity_error) throw new CollaborationError('integrity_violation', 503);
  assertStoredIntegrity(doc);
  return doc;
}
export async function verifiedRevision(tx: SqlTransaction, doc: StoredDocument) {
  const history = await rows<
    Pick<StoredDocument, 'state' | 'projection' | 'checksum' | 'revision'>
  >(
    tx,
    'select state,projection,checksum,revision from collaboration_revision where document_id=$1 order by revision desc',
    [doc.id]
  );
  for (const revision of history) {
    try {
      assertStoredIntegrity({ ...doc, ...revision });
      return { ...revision, revision: Number(revision.revision) };
    } catch {
      /* Continue to an earlier immutable revision. */
    }
  }
  throw new CollaborationError('verified_revision_missing', 503);
}
async function readableStored(tx: SqlTransaction, doc: StoredDocument) {
  try {
    if (doc.integrity_error) throw new Error('blocked');
    assertStoredIntegrity(doc);
    return doc;
  } catch {
    const revision = await verifiedRevision(tx, doc);
    await tx.query(
      "update collaboration_document set integrity_error='integrity_violation',integrity_checked_at=$2 where id=$1",
      [doc.id, Date.now()]
    );
    return {
      ...doc,
      state: revision.state,
      projection: revision.projection,
      checksum: revision.checksum,
      readableRevision: revision.revision,
      integrity_error: 'integrity_violation',
    };
  }
}
export async function findStored(
  tx: SqlTransaction,
  reference: CollaborationReference,
  readable = false
): Promise<StoredDocument | undefined> {
  const [doc] = await rows<StoredDocument>(
    tx,
    `select * from collaboration_document where kind=$1 and entity_id=$2
    and branch_id is not distinct from $3::uuid and workspace_id is not distinct from $4::uuid for update`,
    [reference.kind, reference.entityId, reference.branchId, reference.workspaceId]
  );
  if (doc) {
    doc.revision = Number(doc.revision);
    if (readable) return readableStored(tx, doc);
    if (doc.integrity_error) throw new CollaborationError('integrity_violation', 503);
    assertStoredIntegrity(doc);
  }
  return doc;
}
export async function recordRevision(
  tx: SqlTransaction,
  doc: StoredDocument,
  actor: string | null,
  operationId: string,
  reason: string
) {
  const id = crypto.randomUUID();
  await tx.query(
    `insert into collaboration_revision(id,document_id,generation,revision,checksum,state,projection,actor_id,operation_id,reason,created_at)
    values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,
    [
      id,
      doc.id,
      doc.generation,
      doc.revision,
      doc.checksum,
      Buffer.from(doc.state),
      doc.projection,
      actor,
      operationId,
      reason,
      Date.now(),
    ]
  );
  await tx.query(
    'insert into collaboration_outbox(document_id,generation,revision,created_at) values($1,$2,$3,$4)',
    [doc.id, doc.generation, doc.revision, Date.now()]
  );
  return id;
}
export async function createStored(
  tx: SqlTransaction,
  reference: CollaborationReference,
  value: unknown,
  actor: string | null,
  workspace?: { type: 'proposal' | 'followup'; base: StoredDocument }
) {
  const existing = await findStored(tx, reference);
  if (existing) return existing;
  if (!workspace && ['document', 'blog'].includes(reference.kind) && suggestionIds(value).size)
    throw new CollaborationError('proposal_requires_workspace', 422);
  const ydoc = seedDocument(reference.kind, value);
  try {
    const projection = projectDocument(reference.kind, ydoc);
    const doc: StoredDocument = {
      id: crypto.randomUUID(),
      kind: reference.kind,
      entity_id: reference.entityId,
      branch_id: reference.branchId,
      workspace_id: reference.workspaceId,
      workspace_type: workspace?.type ?? 'canonical',
      owner_id: workspace ? actor : null,
      base_document_id: workspace?.base.id ?? null,
      base_revision: workspace?.base.revision ?? null,
      generation: crypto.randomUUID(),
      revision: 1,
      checksum: checksum(projection),
      state: Y.encodeStateAsUpdate(ydoc),
      projection,
      frozen: false,
      deleted: false,
      shared: false,
    };
    await tx.query(
      `insert into collaboration_document(id,kind,entity_id,branch_id,workspace_id,workspace_type,owner_id,base_document_id,base_revision,generation,checksum,state,projection,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$14)`,
      [
        doc.id,
        doc.kind,
        doc.entity_id,
        doc.branch_id,
        doc.workspace_id,
        doc.workspace_type,
        doc.owner_id,
        doc.base_document_id,
        doc.base_revision,
        doc.generation,
        doc.checksum,
        Buffer.from(doc.state),
        doc.projection,
        Date.now(),
      ]
    );
    await recordRevision(tx, doc, actor, 'bootstrap', 'bootstrap');
    return doc;
  } finally {
    ydoc.destroy();
  }
}
export async function persistProjection(tx: SqlTransaction, doc: StoredDocument) {
  if (doc.workspace_type !== 'canonical') return;
  await tx.query("select set_config('polity.collaboration_projection',$1,true)", [
    `${doc.kind}:${doc.entity_id}`,
  ]);
  const json = doc.projection;
  if (doc.kind === 'document' || doc.kind === 'blog') {
    const table = doc.kind === 'document' ? 'document' : 'blog';
    await tx.query(
      `update ${table} set content=$1::jsonb,updated_at=to_timestamp($2::double precision/1000) where id=$3`,
      [json, Date.now(), doc.entity_id]
    );
  } else if (doc.kind === 'city' && !doc.branch_id) {
    const { createCityDesignPersistenceSnapshot } =
      await import('@/features/amendments/city-design/logic/cityDesignChangeRequestDiff');
    const persistence = createCityDesignPersistenceSnapshot(
      doc.projection as Parameters<typeof createCityDesignPersistenceSnapshot>[0]
    );
    await tx.query(
      `update amendment_city_design set design_state=$1::jsonb,bbox=$2::jsonb,center_lat=$3,center_lon=$4,
      osm_snapshot=$5::jsonb,currency=$6,estimated_total_cost_minor=$7,cost_catalog_version=$8,cost_summary=$9::jsonb,updated_at=to_timestamp($10::double precision/1000) where id=$11`,
      [
        persistence.design_state,
        persistence.bbox,
        persistence.center_lat,
        persistence.center_lon,
        persistence.osm_snapshot,
        persistence.currency,
        persistence.estimated_total_cost_minor,
        persistence.cost_catalog_version,
        persistence.cost_summary,
        Date.now(),
        doc.entity_id,
      ]
    );
  } else if (doc.kind === 'studio') {
    await tx.query(
      'update studio_state set state=$1,document=$2::jsonb,updated_at=$3 where project_id=$4',
      [Buffer.from(doc.state), json, Date.now(), doc.entity_id]
    );
    await tx.query(
      'update studio_project set title=$1,version=version+1,updated_at=$2 where id=$3',
      [(doc.projection as { title: string }).title, Date.now(), doc.entity_id]
    );
  }
  await tx.query("select set_config('polity.collaboration_projection','',true)", []);
}
export async function commitState(
  tx: SqlTransaction,
  doc: StoredDocument,
  update: Uint8Array,
  actor: string,
  operationId: string,
  reason = 'edit'
) {
  const [duplicate] = await rows<{ id: string; revision: number }>(
    tx,
    'select id,revision from collaboration_revision where document_id=$1 and operation_id=$2',
    [doc.id, operationId]
  );
  if (duplicate) return { document: doc, revisionId: duplicate.id, duplicate: true };
  const candidate = candidateDocument(doc.kind, doc.state, update);
  if (Buffer.from(candidate.state).equals(Buffer.from(doc.state))) {
    const [current] = await rows<{ id: string }>(
      tx,
      'select id from collaboration_revision where document_id=$1 and revision=$2',
      [doc.id, doc.revision]
    );
    return { document: doc, revisionId: current.id, duplicate: true };
  }
  const next = {
    ...doc,
    ...candidate,
    revision: doc.revision + 1,
    checksum: checksum(candidate.projection),
  };
  await tx.query(
    'update collaboration_document set state=$1,projection=$2::jsonb,revision=$3,checksum=$4,updated_at=$5 where id=$6',
    [Buffer.from(next.state), next.projection, next.revision, next.checksum, Date.now(), doc.id]
  );
  const revisionId = await recordRevision(tx, next, actor, operationId, reason);
  await persistProjection(tx, next);
  return { document: next, revisionId, duplicate: false };
}
