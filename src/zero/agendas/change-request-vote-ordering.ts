import {
  buildSuggestionDocumentOrder,
  type ChangeRequestVoteOrder,
  sortChangeRequestsByVoteOrder,
} from '@/features/change-requests/logic/changeRequestVoteOrder';
import { zql } from '../schema';
import { VOTE_PHASE, normalizeVotePhase } from '../votes/vote-workflow';
import { AGENDA_VOTE_STEP_KIND } from './vote-step-kind';

interface VoteOrderingTx {
  run: (query: any) => Promise<any>;
  mutate?: any;
}

type AnyRecord = Record<string, any>;

const NULL_BRANCH_KEY = '__amendment__';

function asArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? (value as AnyRecord[]) : [];
}

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function addLookupAlias(map: Map<string, string>, alias: unknown, suggestionId: string | null) {
  const key = getStringValue(alias);
  if (key && suggestionId && !map.has(key)) {
    map.set(key, suggestionId);
  }
}

function buildSuggestionLookup(discussions: unknown) {
  const lookup = new Map<string, string>();

  for (const discussion of asArray(discussions)) {
    const suggestionId = getStringValue(discussion.id);
    if (!suggestionId) continue;

    addLookupAlias(lookup, discussion.changeRequestEntityId, suggestionId);
    addLookupAlias(lookup, discussion.change_request_id, suggestionId);
    addLookupAlias(lookup, discussion.changeRequestId, suggestionId);
    addLookupAlias(lookup, discussion.crId, suggestionId);
    addLookupAlias(lookup, discussion.cr_id, suggestionId);
    addLookupAlias(lookup, discussion.displayCrId, suggestionId);
    addLookupAlias(lookup, discussion.display_cr_id, suggestionId);
  }

  return lookup;
}

function getChangeRequestAliases(changeRequest: AnyRecord) {
  const aliases = [
    changeRequest.id,
    changeRequest.title,
    changeRequest.cr_id,
    changeRequest.crId,
    changeRequest.display_cr_id,
    changeRequest.displayCrId,
  ];

  if (typeof changeRequest.branch_sequence_number === 'number') {
    aliases.push(`CR-${changeRequest.branch_sequence_number}`);
  }

  return aliases;
}

function findSuggestionIdForChangeRequest(
  changeRequest: AnyRecord,
  suggestionLookup: ReadonlyMap<string, string>
) {
  for (const alias of getChangeRequestAliases(changeRequest)) {
    const aliasText = getStringValue(alias);
    if (!aliasText) continue;

    const suggestionId = suggestionLookup.get(aliasText);
    if (suggestionId) {
      return suggestionId;
    }
  }

  return null;
}

export async function createChangeRequestVoteOrderContext(
  tx: VoteOrderingTx,
  amendmentId: string,
  changeRequests: readonly AnyRecord[]
) {
  const amendment = (await tx.run(zql.amendment.where('id', amendmentId).one())) as
    AnyRecord | null | undefined;
  const branchIds = [
    ...new Set(
      changeRequests
        .map(changeRequest => changeRequest.process_branch_id)
        .filter(
          (branchId): branchId is string => typeof branchId === 'string' && branchId.length > 0
        )
    ),
  ];
  const branchesResult =
    branchIds.length > 0
      ? await tx.run(zql.amendment_process_branch.where('id', 'IN', branchIds))
      : [];
  const branches = asArray(branchesResult);

  const documentIds = [
    amendment?.document_id,
    ...branches.map(branch => branch.document_id),
  ].filter(
    (documentId): documentId is string => typeof documentId === 'string' && documentId.length > 0
  );
  const documentVersionIds = branches
    .map(branch => branch.document_version_id)
    .filter(
      (versionId): versionId is string => typeof versionId === 'string' && versionId.length > 0
    );
  const documentsResult =
    documentIds.length > 0
      ? await tx.run(zql.document.where('id', 'IN', [...new Set(documentIds)]))
      : [];
  const documentVersionsResult =
    documentVersionIds.length > 0
      ? await tx.run(zql.document_version.where('id', 'IN', [...new Set(documentVersionIds)]))
      : [];
  const documentsById = new Map(asArray(documentsResult).map(document => [document.id, document]));
  const documentVersionsById = new Map(
    asArray(documentVersionsResult).map(documentVersion => [documentVersion.id, documentVersion])
  );

  const contextByBranchId = new Map<
    string,
    {
      suggestionLookup: ReadonlyMap<string, string>;
      suggestionDocumentOrder: ReadonlyMap<string, number>;
    }
  >();

  const buildContext = (source: AnyRecord | null | undefined) => {
    const document =
      (source?.document_id ? documentsById.get(source.document_id) : null) ??
      (source?.document_version_id ? documentVersionsById.get(source.document_version_id) : null);

    return {
      suggestionLookup: buildSuggestionLookup(source?.discussions),
      suggestionDocumentOrder: buildSuggestionDocumentOrder(document?.content),
    };
  };

  contextByBranchId.set(NULL_BRANCH_KEY, buildContext(amendment));
  for (const branch of branches) {
    if (branch.id) {
      contextByBranchId.set(branch.id, buildContext(branch));
    }
  }

  return {
    getTextPosition(changeRequest: AnyRecord) {
      const branchKey = getStringValue(changeRequest.process_branch_id) ?? NULL_BRANCH_KEY;
      const context = contextByBranchId.get(branchKey) ?? contextByBranchId.get(NULL_BRANCH_KEY);
      if (!context) return null;

      const suggestionId = findSuggestionIdForChangeRequest(
        changeRequest,
        context.suggestionLookup
      );
      if (!suggestionId) return null;

      return context.suggestionDocumentOrder.get(suggestionId) ?? null;
    },
  };
}

export async function orderChangeRequestsForVoting<T extends AnyRecord>(
  tx: VoteOrderingTx,
  amendmentId: string,
  changeRequests: readonly T[],
  voteOrder: ChangeRequestVoteOrder
) {
  if (changeRequests.length < 2) {
    return [...changeRequests];
  }

  const orderContext = await createChangeRequestVoteOrderContext(tx, amendmentId, changeRequests);
  return sortChangeRequestsByVoteOrder(changeRequests, voteOrder, {
    getTextPosition: (_item, changeRequest) =>
      isRecord(changeRequest) ? orderContext.getTextPosition(changeRequest) : null,
  });
}

function isSortableChangeRequestVoteStep(link: AnyRecord) {
  if (!link.change_request_id || !link.change_request) return false;
  if (link.is_closing_vote) return false;
  if (link.step_kind && link.step_kind !== AGENDA_VOTE_STEP_KIND.changeRequest) return false;
  if (link.status === 'completed') return false;

  const votePhase = normalizeVotePhase(link.vote?.status);
  if (votePhase === VOTE_PHASE.final || votePhase === VOTE_PHASE.closed) return false;

  return true;
}

export async function reorderOpenChangeRequestVoteStepsForEvent(
  tx: VoteOrderingTx,
  eventId: string,
  voteOrder: ChangeRequestVoteOrder
) {
  const agendaItems = asArray(await tx.run(zql.agenda_item.where('event_id', eventId)));

  for (const agendaItem of agendaItems) {
    if (!agendaItem.id || !agendaItem.amendment_id) continue;

    await reorderOpenChangeRequestVoteStepsForAgendaItem(tx, agendaItem, voteOrder);
  }
}

export async function reorderOpenChangeRequestVoteStepsForAgendaItem(
  tx: VoteOrderingTx,
  agendaItem: { id?: string | null; amendment_id?: string | null },
  voteOrder: ChangeRequestVoteOrder
) {
  if (!agendaItem.id || !agendaItem.amendment_id) return;

  const links = asArray(
    await tx.run(
      zql.agenda_item_change_request
        .where('agenda_item_id', agendaItem.id)
        .orderBy('order_index', 'asc')
        .related('change_request')
        .related('vote')
    )
  );
  const sortableLinks = links.filter(isSortableChangeRequestVoteStep);
  if (sortableLinks.length < 2) return;

  const orderedChangeRequests = await orderChangeRequestsForVoting(
    tx,
    agendaItem.amendment_id,
    sortableLinks.map(link => link.change_request).filter(Boolean),
    voteOrder
  );
  const linksByChangeRequestId = new Map(sortableLinks.map(link => [link.change_request_id, link]));
  const sortedLinks = orderedChangeRequests
    .map(changeRequest => linksByChangeRequestId.get(changeRequest.id))
    .filter((link): link is AnyRecord => Boolean(link));
  const targetOrderIndices = sortableLinks
    .map(link => link.order_index)
    .filter((orderIndex): orderIndex is number => typeof orderIndex === 'number')
    .sort((left, right) => left - right);
  const now = Date.now();

  for (let index = 0; index < sortedLinks.length; index++) {
    const link = sortedLinks[index];
    const nextOrderIndex = targetOrderIndices[index];
    if (typeof nextOrderIndex !== 'number' || link.order_index === nextOrderIndex) continue;

    await tx.mutate?.agenda_item_change_request?.update({
      id: link.id,
      order_index: nextOrderIndex,
      updated_at: now,
    });
  }
}
