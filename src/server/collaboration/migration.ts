import type { Value } from 'platejs';
import {
  suggestionIds,
  normalized,
  isolateProposal,
} from '@/features/collaboration/logic/proposals';
import { migrateComments } from './migrate-comments';
import { applySuggestionToContent } from '@/features/change-requests/logic/applySuggestionToContent';
import { createHash } from 'node:crypto';
import {
  seedDocument,
  projectDocument,
  stableJson,
  textValue,
} from '@/features/collaboration/logic/codec';
import {
  CollaborationError,
  type CollaborationReference,
} from '@/features/collaboration/logic/types';
import { resolveCityDesignBaseState } from '@/features/amendments/city-design/logic/cityDesignChangeRequestDiff';
import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';
import {
  checksum,
  createStored,
  loadStored,
  persistProjection,
  assertStoredIntegrity,
  type StoredDocument,
} from './store';
import { rows, type SqlTransaction } from './transaction';

async function migrateBallots(tx: SqlTransaction, documents: StoredDocument[]) {
  const votes = await rows<{ id: string; amendment_id: string | null; purpose: string }>(
    tx,
    "select * from vote where status in ('internal','indicative','final') order by id"
  );
  for (const vote of votes) {
    const [existing] = await rows(
      tx,
      'select vote_id from collaboration_ballot_context where vote_id=$1',
      [vote.id]
    );
    if (existing) continue;
    const choices = await rows<{ process_branch_id: string | null }>(
      tx,
      'select * from vote_choice where vote_id=$1 order by order_index,id',
      [vote.id]
    );
    if (!choices.length) throw new CollaborationError(`ambiguous_ballot_choices:${vote.id}`);
    const links = await rows<{
      change_request_id: string | null;
      process_branch_id: string | null;
    }>(tx, 'select * from agenda_item_change_request where vote_id=$1 order by id', [vote.id]);
    const proposals = links.filter(l => l.change_request_id);
    if (proposals.length) {
      for (const link of proposals) {
        const [proof] = await rows<{
          document_id: string;
          submitted_revision_id: string;
          checksum: string;
        }>(tx, 'select * from collaboration_proposal where change_request_id=$1', [
          link.change_request_id,
        ]);
        if (!proof?.submitted_revision_id)
          throw new CollaborationError(`ambiguous_ballot_proposal:${vote.id}`);
        await tx.query(
          'insert into collaboration_ballot(vote_id,document_id,revision_id,change_request_id,checksum,created_at) values($1,$2,$3,$4,$5,$6) on conflict do nothing',
          [
            vote.id,
            proof.document_id,
            proof.submitted_revision_id,
            link.change_request_id,
            proof.checksum,
            Date.now(),
          ]
        );
      }
    } else if (vote.amendment_id) {
      const archives = await rows<{
        id: string;
        kind: CollaborationReference['kind'];
        entity_id: string;
        branch_id: string | null;
        projection: unknown;
        checksum: string;
        version_id: string | null;
      }>(tx, 'select * from collaboration_legacy_snapshot where vote_id=$1', [vote.id]);
      if (!archives.length) throw new CollaborationError(`ambiguous_ballot:${vote.id}`);
      const expected =
        vote.purpose === 'merge_variant'
          ? [...new Set(choices.map(c => c.process_branch_id).filter(Boolean))]
          : [links[0]?.process_branch_id ?? null];
      if (vote.purpose === 'merge_variant' && expected.length < 2)
        throw new CollaborationError(`ambiguous_ballot_variants:${vote.id}`);
      for (const branch of expected)
        if (!archives.some(a => a.branch_id === branch && a.kind === 'document'))
          throw new CollaborationError(`missing_ballot_variant:${vote.id}:${branch}`);
      const [owner] = await rows<{ created_by_id: string }>(
        tx,
        'select created_by_id from amendment where id=$1',
        [vote.amendment_id]
      );
      for (const archive of archives) {
        if (checksum(archive.projection) !== archive.checksum)
          throw new CollaborationError('legacy_snapshot_checksum_mismatch');
        if (archive.version_id) {
          const [version] = await rows<{ content: unknown; document_id: string }>(
            tx,
            'select content,document_id from document_version where id=$1',
            [archive.version_id]
          );
          if (
            !version ||
            version.document_id !== archive.entity_id ||
            checksum(version.content) !== archive.checksum
          )
            throw new CollaborationError('legacy_snapshot_version_mismatch');
        } else if (archive.kind === 'document')
          throw new CollaborationError('legacy_ballot_version_missing');
        const canonical = documents.find(
          d =>
            d.kind === archive.kind &&
            d.entity_id === archive.entity_id &&
            d.branch_id === archive.branch_id
        );
        if (!canonical) throw new CollaborationError('legacy_ballot_document_missing');
        const saved = await createStored(
          tx,
          {
            kind: archive.kind,
            entityId: archive.entity_id,
            branchId: archive.branch_id,
            workspaceId: archive.id,
          },
          archive.projection,
          owner.created_by_id,
          { type: 'followup', base: canonical }
        );
        await tx.query('update collaboration_document set frozen=true where id=$1', [saved.id]);
        const [revision] = await rows<{ id: string }>(
          tx,
          'select id from collaboration_revision where document_id=$1 and revision=$2',
          [saved.id, saved.revision]
        );
        await tx.query(
          'insert into collaboration_ballot(vote_id,document_id,revision_id,checksum,created_at) values($1,$2,$3,$4,$5) on conflict do nothing',
          [vote.id, canonical.id, revision.id, archive.checksum, Date.now()]
        );
      }
    }
    await tx.query(
      'insert into collaboration_ballot_context(vote_id,context,created_at) values($1,$2::jsonb,$3)',
      [vote.id, { vote, choices, links }, Date.now()]
    );
  }
}

const protectedTables = [
  'role',
  'action_right',
  'group_membership',
  'group_membership_role',
  'amendment_collaborator',
  'document_collaborator',
  'blog_blogger',
  'event_participant',
  'event_participant_role',
  'change_request',
  'change_request_vote',
  'vote',
  'vote_choice',
  'voter',
  'indicative_voter_participation',
  'indicative_choice_decision',
  'final_voter_participation',
  'final_choice_decision',
  'election',
  'elector',
  'election_candidate',
  'indicative_elector_participation',
  'indicative_candidate_selection',
  'final_elector_participation',
  'final_candidate_selection',
  'amendment',
  'amendment_process_branch',
  'amendment_process_run',
  'amendment_process_step_run',
  'process_task',
  'agenda_item',
  'agenda_item_change_request',
  'accreditation',
  'accreditation_audit',
  'vote_offline_tally',
  'election_offline_tally',
];
export async function governanceManifest(tx: SqlTransaction) {
  const manifest: Record<string, { count: number; checksum: string }> = {};
  for (const table of protectedTables) {
    const [exists] = await rows<{ name: string | null }>(
      tx,
      'select to_regclass($1)::text as name',
      [`public.${table}`]
    );
    if (!exists.name) continue;
    const data = await rows(
      tx,
      `select ${['amendment', 'amendment_process_branch'].includes(table) ? "to_jsonb(t)-'discussions'" : 'to_jsonb(t)'} as value from public.${table} t order by id`
    );
    manifest[table] = { count: data.length, checksum: checksum(data) };
  }
  return manifest;
}
export async function checkWindow(tx: SqlTransaction, reserveMs: number) {
  if (!Number.isFinite(reserveMs) || reserveMs < 60_000)
    throw new CollaborationError('maintenance_reserve_required');
  const [row] = await rows<{ deadline: string | null }>(
    tx,
    `select (extract(epoch from min(deadline))*1000)::bigint::text as deadline from (
    select voting_deadline as deadline from change_request where voting_deadline is not null and voting_status not in ('completed','closed')
    union all select closing_end_time from vote where closing_end_time is not null and closed_at is null
    union all select closing_end_time from election where closing_end_time is not null and coalesce(status,'') not in ('closed','completed','finished')
    ) deadlines`
  );
  if (row?.deadline && Number(row.deadline) <= Date.now() + reserveMs)
    throw new CollaborationError('insufficient_maintenance_window');
  return row?.deadline ? Number(row.deadline) : null;
}
export async function migrateDocuments(tx: SqlTransaction, migrationId: string) {
  await tx.query("select set_config('polity.collaboration_migration','on',true)", []);
  const before = await governanceManifest(tx);
  const [attempt] = await rows<{ status: string }>(
    tx,
    'select status from collaboration_migration_attempt where id=$1',
    [migrationId]
  );
  if (!attempt) {
    const [control] = await rows<{ activated_at: number | null }>(
      tx,
      'select activated_at from collaboration_control where singleton'
    );
    if (control.activated_at) throw new CollaborationError('migration_already_activated');
    await tx.query("select set_config('polity.collaboration_clear_staging','on',true)", []);
    for (const table of [
      'collaboration_ballot_context',
      'collaboration_ballot',
      'collaboration_proposal',
      'collaboration_comment_history',
      'collaboration_comment',
      'collaboration_command',
      'collaboration_outbox',
      'collaboration_revision',
    ])
      await tx.query(`delete from ${table}`, []);
    await tx.query("delete from collaboration_document where workspace_type<>'canonical'", []);
    await tx.query('delete from collaboration_document', []);
    await tx.query("select set_config('polity.collaboration_clear_staging','',true)", []);
    await tx.query(
      "insert into collaboration_migration_attempt(id,status,source_manifest,created_at,updated_at) values($1,'prepared',$2::jsonb,$3,$3)",
      [migrationId, before, Date.now()]
    );
  } else if (attempt.status !== 'prepared')
    throw new CollaborationError('migration_attempt_closed');
  const sources: { reference: CollaborationReference; value: unknown; original: unknown }[] = [];
  const cityOwners = new Map<string, string>();
  for (const row of await rows<{
    id: string;
    content: unknown;
    branch_id: string | null;
    original: unknown;
  }>(
    tx,
    'select d.id,d.content,b.id as branch_id,to_jsonb(d) as original from document d left join amendment_process_branch b on b.document_id=d.id order by d.id,b.id'
  ))
    sources.push({
      reference: { kind: 'document', entityId: row.id, branchId: row.branch_id, workspaceId: null },
      value: textValue(row.content),
      original: row.original,
    });
  for (const row of await rows<{ id: string; content: unknown; original: unknown }>(
    tx,
    'select id,content,to_jsonb(b) as original from blog b order by id'
  ))
    sources.push({
      reference: { kind: 'blog', entityId: row.id, branchId: null, workspaceId: null },
      value: textValue(row.content),
      original: row.original,
    });
  for (const row of await rows<{
    id: string;
    amendment_id: string;
    design_state: unknown;
    original: unknown;
  }>(
    tx,
    'select id,amendment_id,design_state,to_jsonb(c) as original from amendment_city_design c order by id'
  )) {
    cityOwners.set(row.id, row.amendment_id);
    const value = resolveCityDesignBaseState(row.design_state);
    sources.push({
      reference: { kind: 'city', entityId: row.id, branchId: null, workspaceId: null },
      value,
      original: row.original,
    });
    const branches = await rows<{ id: string }>(
      tx,
      'select b.id from amendment_process_branch b join amendment_process_run r on r.id=b.process_run_id where r.amendment_id=$1',
      [row.amendment_id]
    );
    for (const branch of branches) {
      const [archive] = await rows<{ projection: unknown; checksum: string }>(
        tx,
        "select projection,checksum from collaboration_legacy_snapshot where vote_id is null and kind='city' and entity_id=$1 and branch_id=$2",
        [row.id, branch.id]
      );
      if (!archive || checksum(archive.projection) !== archive.checksum)
        throw new CollaborationError(`ambiguous_city_branch:${branch.id}`);
      sources.push({
        reference: { kind: 'city', entityId: row.id, branchId: branch.id, workspaceId: null },
        value: archive.projection,
        original: archive.projection,
      });
    }
  }
  for (const row of await rows<{ id: string; document: unknown; original: unknown }>(
    tx,
    "select p.id,s.document,to_jsonb(s)-'state' as original from studio_project p join studio_state s on s.project_id=p.id order by p.id"
  ))
    sources.push({
      reference: { kind: 'studio', entityId: row.id, branchId: null, workspaceId: null },
      value: row.document,
      original: row.original,
    });
  const imported: StoredDocument[] = [];
  const textIds = new Set<string>();
  for (const source of sources.filter(s => s.reference.kind === 'document')) {
    if (textIds.has(source.reference.entityId))
      throw new CollaborationError(`ambiguous_document_branches:${source.reference.entityId}`);
    textIds.add(source.reference.entityId);
  }
  for (const source of sources) {
    let value = source.value;
    if (source.reference.kind === 'document' || source.reference.kind === 'blog') {
      for (const id of suggestionIds(value))
        value = applySuggestionToContent(value as Value, id, 'reject');
      value = normalized(value);
    }
    const created = await createStored(tx, source.reference, value, null);
    const doc = await loadStored(tx, created.id);
    const verification = seedDocument(source.reference.kind, value);
    try {
      if (checksum(projectDocument(source.reference.kind, verification)) !== doc.checksum)
        throw new CollaborationError('migration_content_mismatch');
    } finally {
      verification.destroy();
    }
    await tx.query(
      `insert into collaboration_checkpoint(migration_id,kind,entity_id,original,checksum,branch_id) values($1,$2,$3,$4::jsonb,$5,$6)
      on conflict(migration_id,kind,entity_id,branch_id) do nothing`,
      [
        migrationId,
        source.reference.kind,
        source.reference.entityId,
        source.original,
        checksum(source.value),
        source.reference.branchId,
      ]
    );
    imported.push(doc);
  }
  // Freeze the actual submitted content of every unresolved text proposal. An
  // ambiguous/missing suggestion blocks cutover instead of inventing a ballot.
  const proposals = await rows<{
    id: string;
    amendment_id: string;
    user_id: string;
    process_branch_id: string | null;
    suggestion_id: string | null;
    source_type: string | null;
    source_id: string | null;
    original_properties: unknown;
    new_properties: unknown;
    status: string | null;
  }>(
    tx,
    "select * from change_request where coalesce(status,'open') not in ('accepted','rejected','obsolete','withdrawn')"
  );
  for (const proposal of proposals) {
    let doc: StoredDocument | undefined, submitted: unknown, fullSubmission: unknown;
    if (proposal.source_type?.startsWith('city_design_')) {
      const details = proposal.new_properties ?? proposal.original_properties;
      const cityId =
        details && typeof details === 'object'
          ? (details as { cityDesignId?: string }).cityDesignId
          : null;
      doc = imported.find(
        d =>
          d.kind === 'city' &&
          d.entity_id === cityId &&
          cityOwners.get(d.entity_id) === proposal.amendment_id &&
          d.branch_id === proposal.process_branch_id
      );
      fullSubmission = doc?.projection;
      submitted = {
        source_type: proposal.source_type,
        source_id: proposal.source_id,
        original_properties: proposal.original_properties,
        new_properties: proposal.new_properties,
      };
    } else {
      const [target] = await rows<{ document_id: string | null }>(
        tx,
        'select coalesce(b.document_id,a.document_id) as document_id from amendment a left join amendment_process_branch b on b.id=$2 left join amendment_process_run r on r.id=b.process_run_id where a.id=$1 and ($2::uuid is null or r.amendment_id=a.id)',
        [proposal.amendment_id, proposal.process_branch_id]
      );
      doc = imported.find(
        d =>
          d.kind === 'document' &&
          d.entity_id === target?.document_id &&
          (!proposal.process_branch_id || d.branch_id === proposal.process_branch_id)
      );
      fullSubmission = sources.find(
        s =>
          s.reference.kind === 'document' &&
          s.reference.entityId === doc?.entity_id &&
          s.reference.branchId === doc?.branch_id
      )?.value;
      if (doc && proposal.suggestion_id && fullSubmission)
        submitted = createChangeRequestDiffSnapshot(
          proposal.suggestion_id,
          fullSubmission as Value
        );
      if (!submitted || !(submitted as { change_type?: string }).change_type)
        throw new CollaborationError(`ambiguous_proposal:${proposal.id}`);
    }
    if (!doc) throw new CollaborationError(`missing_proposal_document:${proposal.id}`);
    const [revision] = await rows<{ id: string }>(
      tx,
      'select id from collaboration_revision where document_id=$1 and revision=$2',
      [doc.id, doc.revision]
    );
    const isolated =
      doc.kind === 'document' && proposal.suggestion_id
        ? isolateProposal(fullSubmission as Value, proposal.suggestion_id)
        : fullSubmission;
    const workspace = await createStored(
      tx,
      {
        kind: doc.kind,
        entityId: doc.entity_id,
        branchId: doc.branch_id,
        workspaceId: proposal.id,
      },
      isolated,
      proposal.user_id,
      { type: 'proposal', base: doc }
    );
    const [submittedRevision] = await rows<{ id: string }>(
      tx,
      'select id from collaboration_revision where document_id=$1 and revision=$2',
      [workspace.id, workspace.revision]
    );
    await tx.query('update collaboration_document set frozen=true where id=$1', [workspace.id]);
    await tx.query(
      `insert into collaboration_proposal(change_request_id,document_id,base_revision_id,submitted_revision_id,submitted_content,checksum,created_at)
      values($1,$2,$3,$4,$5::jsonb,$6,$7) on conflict(change_request_id) do nothing`,
      [
        proposal.id,
        doc.id,
        revision.id,
        submittedRevision.id,
        submitted,
        checksum(submitted),
        Date.now(),
      ]
    );
  }
  await migrateBallots(tx, imported);
  if (stableJson(before) !== stableJson(await governanceManifest(tx)))
    throw new CollaborationError('governance_manifest_changed');
  return {
    migrationId,
    documents: imported.length,
    proposals: proposals.length,
    governance: before,
    contentChecksum: createHash('sha256')
      .update(
        imported
          .map(d => `${d.id}:${d.checksum}`)
          .sort()
          .join('\n')
      )
      .digest('hex'),
    verified: true,
  };
}
export async function activateMigration(
  tx: SqlTransaction,
  migrationId: string,
  reserveMs: number
) {
  await checkWindow(tx, reserveMs);
  const [control] = await rows<{
    phase: string;
    manifest: {
      migrationId: string;
      verified: boolean;
      governance: unknown;
      contentChecksum: string;
    } | null;
  }>(tx, 'select phase,manifest from collaboration_control where singleton for update');
  if (
    control.phase !== 'maintenance' ||
    !control.manifest?.verified ||
    control.manifest.migrationId !== migrationId
  )
    throw new CollaborationError('unverified_migration');
  if (stableJson(control.manifest.governance) !== stableJson(await governanceManifest(tx)))
    throw new CollaborationError('governance_manifest_changed');
  await tx.query("select set_config('polity.collaboration_migration','on',true)", []);
  const documents = await rows<StoredDocument>(
    tx,
    "select * from collaboration_document where workspace_type='canonical' and not deleted"
  );
  if (
    createHash('sha256')
      .update(
        documents
          .map(doc => `${doc.id}:${doc.checksum}`)
          .sort()
          .join('\n')
      )
      .digest('hex') !== control.manifest.contentChecksum
  )
    throw new CollaborationError('content_manifest_changed');
  for (const doc of documents) {
    assertStoredIntegrity(doc);
    await persistProjection(tx, doc);
  }
  // Remove legacy inline annotations from public projections. Originals remain
  // private checkpoints, while each proposal keeps its immutable submission.
  for (const table of ['amendment', 'amendment_process_branch', 'blog']) {
    const annotated = await rows<{ id: string; discussions: unknown }>(
      tx,
      `select id,discussions from ${table} where discussions is not null`
    );
    for (const row of annotated) {
      const doc =
        table === 'blog'
          ? documents.find(d => d.kind === 'blog' && d.entity_id === row.id)
          : table === 'amendment_process_branch'
            ? documents.find(d => d.kind === 'document' && d.branch_id === row.id)
            : await (async () => {
                const [amendment] = await rows<{ document_id: string }>(
                  tx,
                  'select document_id from amendment where id=$1',
                  [row.id]
                );
                return documents.find(
                  d => d.kind === 'document' && d.entity_id === amendment?.document_id
                );
              })();
      if (!doc && Array.isArray(row.discussions) && row.discussions.length)
        throw new CollaborationError(`missing_discussion_document:${row.id}`);
      if (doc) await migrateComments(tx, doc, row.discussions);
      await tx.query(
        'insert into collaboration_checkpoint(migration_id,kind,entity_id,original,checksum) values($1,$2,$3,$4::jsonb,$5) on conflict do nothing',
        [migrationId, `${table}_discussions`, row.id, row.discussions, checksum(row.discussions)]
      );
      await tx.query(`update ${table} set discussions=null where id=$1`, [row.id]);
    }
  }
  for (const version of await rows<{ id: string; content: Value }>(
    tx,
    'select id,content from document_version where content is not null'
  )) {
    if (!suggestionIds(version.content).size) continue;
    await tx.query(
      "insert into collaboration_checkpoint(migration_id,kind,entity_id,original,checksum) values($1,'version',$2,$3::jsonb,$4) on conflict do nothing",
      [migrationId, version.id, version.content, checksum(version.content)]
    );
    let content = version.content;
    for (const id of suggestionIds(content))
      content = applySuggestionToContent(content, id, 'reject');
    await tx.query('update document_version set content=$1::jsonb where id=$2', [
      normalized(content),
      version.id,
    ]);
  }
  await tx.query(
    "update collaboration_control set phase='active',activated_at=$1,updated_at=$1 where singleton",
    [Date.now()]
  );
  await tx.query(
    "update collaboration_migration_attempt set status='active',updated_at=$2 where id=$1",
    [migrationId, Date.now()]
  );
}
