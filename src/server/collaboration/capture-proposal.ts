import type { Transaction } from '@rocicorp/zero';
import { zql, type Schema } from '@/zero/schema';
import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { activeCollaboration } from './governance';
import { checksum, createStored, findStored, loadStored } from './store';
import { rows, sqlTransaction } from './transaction';

export async function captureCreatedProposal(tx: Transaction<Schema>, id: string) {
  if (!(await activeCollaboration(tx))) return;
  const sql = sqlTransaction(tx),
    cr = await tx.run(zql.change_request.where('id', id).one());
  if (!cr) throw new CollaborationError('proposal_not_found');
  if (!['open', 'pending', 'pending_submission'].includes(cr.status ?? 'open'))
    throw new CollaborationError('proposal_requires_separate_decision');
  const amendment = await tx.run(zql.amendment.where('id', cr.amendment_id).one());
  const branch = cr.process_branch_id
    ? await tx.run(zql.amendment_process_branch.where('id', cr.process_branch_id).one())
    : null;
  const city = cr.source_type?.startsWith('city_design_');
  let entityId: string | null, content: unknown, submitted: unknown;
  if (city) {
    const props = (cr.new_properties ?? cr.original_properties) as { cityDesignId?: string } | null;
    const row = props?.cityDesignId
      ? await tx.run(zql.amendment_city_design.where('id', props.cityDesignId).one())
      : null;
    if (!row || row.amendment_id !== cr.amendment_id)
      throw new CollaborationError('proposal_document_mismatch');
    entityId = row.id;
    content = row.design_state;
    submitted = {
      source_type: cr.source_type,
      source_id: cr.source_id,
      original_properties: cr.original_properties,
      new_properties: cr.new_properties,
    };
  } else {
    entityId = branch?.document_id ?? amendment?.document_id ?? null;
    const row = entityId ? await tx.run(zql.document.where('id', entityId).one()) : null;
    content = row?.content;
  }
  if (!entityId) throw new CollaborationError('proposal_document_missing');
  const ref = {
    kind: city ? ('city' as const) : ('document' as const),
    entityId,
    branchId: cr.process_branch_id ?? null,
    workspaceId: null,
  };
  const doc = (await findStored(sql, ref)) ?? (await createStored(sql, ref, content, cr.user_id));
  const [context] = await rows<{ draft: string | null }>(
    sql,
    "select current_setting('polity.collaboration_draft',true) as draft"
  );
  const draft = context?.draft ? await loadStored(sql, context.draft) : null;
  if (!draft || draft.base_document_id !== doc.id || draft.frozen)
    throw new CollaborationError('proposal_requires_workspace');
  if (!city) {
    if (!cr.suggestion_id) throw new CollaborationError('proposal_anchor_missing');
    submitted = createChangeRequestDiffSnapshot(
      cr.suggestion_id,
      draft.projection as Parameters<typeof createChangeRequestDiffSnapshot>[1]
    );
    if (!(submitted as { change_type?: string }).change_type)
      throw new CollaborationError('proposal_anchor_missing');
  }
  const [base] = await rows<{ id: string }>(
    sql,
    'select id from collaboration_revision where document_id=$1 and revision=$2',
    [doc.id, draft.base_revision]
  );
  const [submission] = await rows<{ id: string }>(
    sql,
    'select id from collaboration_revision where document_id=$1 and revision=$2',
    [draft.id, draft.revision]
  );
  if (!base || !submission) throw new CollaborationError('submitted_revision_missing');
  await sql.query(
    `insert into collaboration_proposal(change_request_id,document_id,base_revision_id,submitted_revision_id,submitted_content,checksum,created_at)
    values($1,$2,$3,$4,$5::jsonb,$6,$7) on conflict(change_request_id) do nothing`,
    [id, doc.id, base.id, submission.id, submitted, checksum(submitted), Date.now()]
  );
}
