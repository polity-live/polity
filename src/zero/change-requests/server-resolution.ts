import { toMutableJSONValue } from '../shared/helpers';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { applySuggestionToContent } from '@/features/change-requests/logic/applySuggestionToContent';
import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';
import {
  applyStreetDesignChangeRequestToDesign,
  createStreetDesignPersistenceSnapshot,
  getStreetDesignDesignContext,
  resolveStreetDesignBaseState,
} from '@/features/amendments/streetscape/logic/streetDesignChangeRequestDiff';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { ChangeRequestVisibilityScope } from './visibility';

export type ChangeRequestResolutionTx = Parameters<
  typeof mutators.amendments.updateChangeRequest.fn
>[0]['tx'];
export type VoteResult = 'passed' | 'rejected' | 'tie';
export type ChangeRequestResolutionMethod = 'direct_internal' | 'internal_vote';

interface ChangeRequestResolutionCtx {
  readonly userID: string;
}

interface ChangeRequestResolutionRow {
  id: string;
  amendment_id: string;
  process_branch_id?: string | null;
  suggestion_id?: string | null;
  title?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  source_title?: string | null;
  change_type?: string | null;
  original_properties?: unknown;
  new_properties?: unknown;
}

export interface DiscussionEntry {
  id: string;
  changeRequestEntityId?: string;
  crId?: string;
  title?: string;
  status?: string;
  [key: string]: unknown;
}

export function getChangeRequestResolutionStatus(voteResult: VoteResult) {
  return voteResult === 'passed' ? 'accepted' : 'rejected';
}

export function findChangeRequestDiscussion(
  discussions: readonly DiscussionEntry[],
  changeRequest: { id: string; suggestion_id?: string | null; title?: string | null }
) {
  return (
    discussions.find(
      discussion =>
        discussion.id === changeRequest.suggestion_id ||
        discussion.changeRequestEntityId === changeRequest.id ||
        (changeRequest.title &&
          (discussion.crId === changeRequest.title || discussion.title === changeRequest.title))
    ) ?? (changeRequest.suggestion_id ? { id: changeRequest.suggestion_id } : undefined)
  );
}

function linkResolvedDiscussion(
  discussion: DiscussionEntry,
  changeRequestId: string,
  status: string
): DiscussionEntry {
  return {
    ...discussion,
    changeRequestEntityId: discussion.changeRequestEntityId ?? changeRequestId,
    status,
  };
}

export function applyChangeRequestVoteResultToContent(
  content: Parameters<typeof applySuggestionToContent>[0],
  suggestionId: string,
  voteResult: VoteResult
) {
  const action = voteResult === 'passed' ? 'accept' : 'reject';
  return applySuggestionToContent(content, suggestionId, action);
}

export function isStreetDesignSourceType(sourceType: string | null | undefined) {
  const normalized = sourceType?.trim().toLowerCase();
  return (
    normalized === 'street_design' ||
    normalized === 'street_design_object' ||
    normalized === 'street_design_scene' ||
    normalized === 'street_design_area' ||
    normalized === 'street_design_layer' ||
    normalized === 'streetscape' ||
    normalized === 'streetscape_object' ||
    normalized === 'streetscape_area' ||
    normalized === 'streetscape_layer' ||
    Boolean(normalized?.startsWith('street_design_'))
  );
}

function getStreetDesignIdFromSnapshot(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const streetDesignId = (value as { streetDesignId?: unknown }).streetDesignId;
  return typeof streetDesignId === 'string' && streetDesignId.length > 0 ? streetDesignId : null;
}

async function loadStreetDesignResolutionTarget(
  tx: ChangeRequestResolutionTx,
  changeRequest: {
    amendment_id: string;
    source_id?: string | null;
    original_properties?: unknown;
    new_properties?: unknown;
  }
) {
  const snapshotStreetDesignId =
    getStreetDesignIdFromSnapshot(changeRequest.new_properties) ??
    getStreetDesignIdFromSnapshot(changeRequest.original_properties);

  if (snapshotStreetDesignId) {
    const bySnapshotId = await tx.run(
      zql.amendment_street_design.where('id', snapshotStreetDesignId).one()
    );
    if (bySnapshotId) return bySnapshotId;
  }

  return tx.run(
    zql.amendment_street_design.where('amendment_id', changeRequest.amendment_id).one()
  );
}

async function resolveStreetDesignChangeRequestByVoteResult({
  tx,
  ctx,
  cr,
  voteResult,
  now,
  resolutionMethod,
  resolvedInMode,
  visibilityScope,
}: {
  tx: ChangeRequestResolutionTx;
  ctx: ChangeRequestResolutionCtx;
  cr: ChangeRequestResolutionRow;
  voteResult: VoteResult;
  now: number;
  resolutionMethod: ChangeRequestResolutionMethod | null;
  resolvedInMode: string | null;
  visibilityScope: ChangeRequestVisibilityScope;
}) {
  const crStatus = getChangeRequestResolutionStatus(voteResult);
  const streetDesign = await loadStreetDesignResolutionTarget(tx, cr);

  if (voteResult === 'passed') {
    const context =
      getStreetDesignDesignContext(cr.new_properties) ??
      getStreetDesignDesignContext(cr.original_properties) ??
      undefined;
    const baseDesign = resolveStreetDesignBaseState(
      streetDesign?.design_state,
      context
        ? {
            schemaVersion: 1,
            ...context,
            objects: [],
          }
        : undefined
    );
    const nextDesign = applyStreetDesignChangeRequestToDesign(baseDesign, cr);
    const persistence = createStreetDesignPersistenceSnapshot(nextDesign);

    if (streetDesign?.id) {
      await tx.mutate.amendment_street_design.update({
        id: streetDesign.id,
        bbox: persistence.bbox,
        center_lat: persistence.center_lat,
        center_lon: persistence.center_lon,
        osm_snapshot: persistence.osm_snapshot,
        design_state: persistence.design_state,
        currency: persistence.currency,
        estimated_total_cost_minor: persistence.estimated_total_cost_minor,
        cost_catalog_version: persistence.cost_catalog_version,
        cost_summary: persistence.cost_summary,
        updated_at: now,
      });
    } else {
      await tx.mutate.amendment_street_design.insert({
        id: crypto.randomUUID(),
        amendment_id: cr.amendment_id,
        created_by_id: ctx.userID,
        title: cr.source_title ?? cr.title ?? 'Streetscape design',
        bbox: persistence.bbox,
        center_lat: persistence.center_lat,
        center_lon: persistence.center_lon,
        osm_snapshot: persistence.osm_snapshot,
        design_state: persistence.design_state,
        currency: persistence.currency,
        estimated_total_cost_minor: persistence.estimated_total_cost_minor,
        cost_catalog_version: persistence.cost_catalog_version,
        cost_summary: persistence.cost_summary,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await tx.mutate.change_request.update({
    id: cr.id,
    status: crStatus,
    voting_status: 'completed',
    resolved_in_mode: resolvedInMode,
    resolution_method: resolutionMethod,
    visibility_scope: visibilityScope,
    updated_at: now,
  });

  return { changeRequest: cr, status: crStatus };
}

async function loadResolutionTarget(
  tx: ChangeRequestResolutionTx,
  cr: {
    amendment_id: string;
    process_branch_id?: string | null;
  }
) {
  const amendmentRow = cr.amendment_id
    ? await tx.run(zql.amendment.where('id', cr.amendment_id).one())
    : null;

  if (!cr.process_branch_id) {
    return {
      amendmentRow,
      branch: null,
      documentId: amendmentRow?.document_id ?? null,
      discussions: Array.isArray(amendmentRow?.discussions)
        ? (amendmentRow.discussions as DiscussionEntry[])
        : [],
    };
  }

  const branch = await tx.run(zql.amendment_process_branch.where('id', cr.process_branch_id).one());
  if (!branch) {
    throw new Error('Process branch not found');
  }

  const processRun = await tx.run(
    zql.amendment_process_run.where('id', branch.process_run_id).one()
  );
  const amendmentOriginId =
    amendmentRow?.origin_amendment_id ?? amendmentRow?.clone_source_id ?? amendmentRow?.id;
  if (!processRun || processRun.amendment_id !== amendmentOriginId) {
    throw new Error('Process branch does not belong to this amendment.');
  }

  return {
    amendmentRow,
    branch,
    documentId: branch.document_id ?? null,
    discussions: Array.isArray(branch.discussions) ? (branch.discussions as DiscussionEntry[]) : [],
  };
}

export async function resolveChangeRequestByVoteResult({
  tx,
  ctx,
  changeRequestId,
  voteResult,
  now = Date.now(),
  resolutionMethod = null,
  resolvedInMode = resolutionMethod === 'internal_vote'
    ? 'vote_internal'
    : 'event_final_closing_vote',
  visibilityScope = 'public',
}: {
  tx: ChangeRequestResolutionTx;
  ctx: ChangeRequestResolutionCtx;
  changeRequestId: string;
  voteResult: VoteResult;
  now?: number;
  resolutionMethod?: ChangeRequestResolutionMethod | null;
  resolvedInMode?: string | null;
  visibilityScope?: ChangeRequestVisibilityScope;
}) {
  const cr = (await tx.run(
    zql.change_request.where('id', changeRequestId).one()
  )) as ChangeRequestResolutionRow | null;
  if (!cr) {
    return null;
  }

  if (isStreetDesignSourceType(cr.source_type)) {
    return resolveStreetDesignChangeRequestByVoteResult({
      tx,
      ctx,
      cr,
      voteResult,
      now,
      resolutionMethod,
      resolvedInMode,
      visibilityScope,
    });
  }

  const crStatus = getChangeRequestResolutionStatus(voteResult);
  const target = await loadResolutionTarget(tx, cr);
  const discussions = target.discussions;
  const matchingDiscussion = findChangeRequestDiscussion(discussions, cr);
  const suggestionId = matchingDiscussion?.id;

  const crLabel =
    matchingDiscussion?.crId ??
    cr.title ??
    translateText('generated.inline.0190_change_request_9c839351');

  if (!target.documentId) {
    throw new Error(`Cannot resolve ${crLabel}: document not found.`);
  }
  if (!suggestionId) {
    throw new Error(`Cannot resolve ${crLabel}: linked document suggestion not found.`);
  }

  const doc = await tx.run(zql.document.where('id', target.documentId).one());
  if (!doc?.content) {
    throw new Error(`Cannot resolve ${crLabel}: document content not found.`);
  }

  const snapshot = createChangeRequestDiffSnapshot(
    suggestionId,
    doc.content as Parameters<typeof applySuggestionToContent>[0]
  );
  if (!snapshot.change_type) {
    throw new Error(`Cannot resolve ${crLabel}: linked suggestion is not present in the document.`);
  }
  const resolutionSnapshot = snapshot;

  const versionSummary =
    voteResult === 'passed' ? `${crLabel} accepted by vote` : `${crLabel} rejected by vote`;

  const latestVersion = await tx.run(
    zql.document_version
      .where('document_id', doc.id)
      .orderBy('version_number', 'desc')
      .limit(1)
      .one()
  );
  const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

  await tx.mutate.document_version.insert({
    id: crypto.randomUUID(),
    document_id: doc.id,
    amendment_id: cr.amendment_id,
    blog_id: null,
    content: toMutableJSONValue(doc.content),
    version_number: nextVersionNumber,
    change_summary: versionSummary,
    author_id: ctx.userID,
    created_at: now,
  });

  const updatedContent = applyChangeRequestVoteResultToContent(
    doc.content as Parameters<typeof applySuggestionToContent>[0],
    suggestionId,
    voteResult
  );

  await tx.mutate.document.update({
    id: doc.id,
    content: toMutableJSONValue(updatedContent),
    updated_at: now,
  });

  if (matchingDiscussion && discussions.length > 0) {
    const updatedDiscussions = discussions.map(discussion =>
      discussion.id === matchingDiscussion.id
        ? linkResolvedDiscussion(discussion, cr.id, crStatus)
        : discussion
    );
    if (target.branch) {
      await tx.mutate.amendment_process_branch.update({
        id: target.branch.id,
        discussions: toMutableJSONValue(updatedDiscussions),
        updated_at: now,
      });
    } else {
      await tx.mutate.amendment.update({
        id: cr.amendment_id,
        discussions: toMutableJSONValue(updatedDiscussions),
        updated_at: now,
      });
    }
  }

  await tx.mutate.change_request.update({
    id: cr.id,
    status: crStatus,
    voting_status: 'completed',
    resolved_in_mode: resolvedInMode,
    resolution_method: resolutionMethod,
    visibility_scope: visibilityScope,
    ...resolutionSnapshot,
    updated_at: now,
  });

  return { changeRequest: cr, status: crStatus };
}
