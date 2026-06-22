import type {
  SuggestionPreviewResolution,
  SuggestionPreviewResolutionMap,
} from '@/features/change-requests/logic/filterDocumentToSingleSuggestion';
import type { TDiscussion } from '@/features/editor/types';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';

import { getCRFilterStatus } from './createMockCRTimelineItems';

export interface VoteDialogDocumentPreviewModel {
  suggestionIds: Set<string>;
  suggestionResolutions: SuggestionPreviewResolutionMap;
}

type VoteResultResolver = (item: ChangeRequestTimelineRow) => string;

export function getPreviewVoteStepKind(item: ChangeRequestTimelineRow): string | null {
  return (item as { _voteStepKind?: string })._voteStepKind ?? null;
}

function isPlaceholderVoteStep(item: ChangeRequestTimelineRow): boolean {
  const stepKind = getPreviewVoteStepKind(item);
  return (
    Boolean((item as { _votePlaceholder?: boolean })._votePlaceholder) ||
    stepKind === 'change_request_votes_placeholder' ||
    stepKind === 'closing_placeholder'
  );
}

function isVariantVoteStep(item: ChangeRequestTimelineRow): boolean {
  const stepKind = getPreviewVoteStepKind(item);
  return stepKind === 'merge_variant';
}

export function isChangeRequestPreviewItem(item: ChangeRequestTimelineRow): boolean {
  return !item.is_closing_vote && !getPreviewVoteStepKind(item);
}

export function isVoteDialogDocumentPreviewEligible(item: ChangeRequestTimelineRow): boolean {
  if (isPlaceholderVoteStep(item) || isVariantVoteStep(item)) return false;
  return Boolean(item.is_closing_vote || isChangeRequestPreviewItem(item));
}

function addPreviewCandidate(candidates: string[], value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return;
  const normalized = String(value).trim();
  if (normalized.length > 0 && !candidates.includes(normalized)) {
    candidates.push(normalized);
  }
}

function getPreviewIdCandidates(item: ChangeRequestTimelineRow): string[] {
  const changeRequest = item.change_request as
    | (NonNullable<ChangeRequestTimelineRow['change_request']> & {
        changeRequestEntityId?: string | null;
        crId?: string | null;
        cr_id?: string | null;
        discussionId?: string | null;
        discussion_id?: string | null;
        displayCrId?: string | null;
        display_cr_id?: string | null;
        suggestionId?: string | null;
        suggestion_id?: string | null;
      })
    | null
    | undefined;
  const row = item as ChangeRequestTimelineRow & {
    changeRequestEntityId?: string | null;
    discussionId?: string | null;
    discussion_id?: string | null;
    suggestionId?: string | null;
    suggestion_id?: string | null;
  };
  const candidates: string[] = [];

  addPreviewCandidate(candidates, changeRequest?.suggestion_id);
  addPreviewCandidate(candidates, changeRequest?.suggestionId);
  addPreviewCandidate(candidates, changeRequest?.discussion_id);
  addPreviewCandidate(candidates, changeRequest?.discussionId);
  addPreviewCandidate(candidates, row.suggestion_id);
  addPreviewCandidate(candidates, row.suggestionId);
  addPreviewCandidate(candidates, row.discussion_id);
  addPreviewCandidate(candidates, row.discussionId);
  addPreviewCandidate(candidates, item.change_request_id);
  addPreviewCandidate(candidates, changeRequest?.id);
  addPreviewCandidate(candidates, row.changeRequestEntityId);
  addPreviewCandidate(candidates, changeRequest?.changeRequestEntityId);
  addPreviewCandidate(candidates, changeRequest?.cr_id);
  addPreviewCandidate(candidates, changeRequest?.crId);
  addPreviewCandidate(candidates, changeRequest?.display_cr_id);
  addPreviewCandidate(candidates, changeRequest?.displayCrId);
  addPreviewCandidate(candidates, changeRequest?.title);

  return candidates;
}

export function buildCrIdToDiscussionId(
  discussions?: readonly TDiscussion[] | null
): Map<string, string> {
  const map = new Map<string, string>();

  for (const d of discussions ?? []) {
    if (d.id) map.set(d.id, d.id);
    if (d.crId) map.set(d.crId, d.id);
    if (d.displayCrId) map.set(d.displayCrId, d.id);
    if (d.title) map.set(d.title, d.id);
    if (d.changeRequestEntityId) map.set(d.changeRequestEntityId, d.id);
  }

  return map;
}

export function resolvePreviewCrIdForTimelineItem(
  item: ChangeRequestTimelineRow,
  crIdToDiscussionId: ReadonlyMap<string, string>
): string | null {
  const candidates = getPreviewIdCandidates(item);
  return candidates.find(candidate => crIdToDiscussionId.has(candidate)) ?? candidates[0] ?? null;
}

export function resolvePreviewSuggestionIdForTimelineItem(
  item: ChangeRequestTimelineRow,
  crIdToDiscussionId: ReadonlyMap<string, string>
): string | null {
  const previewCrId = resolvePreviewCrIdForTimelineItem(item, crIdToDiscussionId);
  return previewCrId ? (crIdToDiscussionId.get(previewCrId) ?? null) : null;
}

export function buildSuggestionPreviewResolutions({
  items,
  crIdToDiscussionId,
  isVotingActive,
  getVoteResult,
}: {
  items: readonly ChangeRequestTimelineRow[];
  crIdToDiscussionId: ReadonlyMap<string, string>;
  isVotingActive: boolean;
  getVoteResult?: VoteResultResolver;
}): SuggestionPreviewResolutionMap {
  const resolutions = new Map<string, SuggestionPreviewResolution>();

  for (const item of items) {
    if (!isChangeRequestPreviewItem(item)) continue;

    const suggestionId = resolvePreviewSuggestionIdForTimelineItem(item, crIdToDiscussionId);
    if (!suggestionId) continue;

    const filterStatus = getCRFilterStatus(
      item,
      isVotingActive && getVoteResult ? (getVoteResult as (item: never) => string) : undefined
    );
    if (filterStatus === 'accepted') {
      resolutions.set(suggestionId, 'accept');
    } else if (filterStatus === 'rejected') {
      resolutions.set(suggestionId, 'reject');
    }
  }

  return resolutions;
}

export function buildVoteDialogDocumentPreviewModel({
  activeItem,
  items,
  discussions,
  isVotingActive,
  getVoteResult,
}: {
  activeItem: ChangeRequestTimelineRow | null | undefined;
  items: readonly ChangeRequestTimelineRow[];
  discussions?: readonly TDiscussion[] | null;
  isVotingActive: boolean;
  getVoteResult?: VoteResultResolver;
}): VoteDialogDocumentPreviewModel | null {
  if (!activeItem || !isVoteDialogDocumentPreviewEligible(activeItem)) return null;

  const crIdToDiscussionId = buildCrIdToDiscussionId(discussions);
  const suggestionResolutions = buildSuggestionPreviewResolutions({
    items,
    crIdToDiscussionId,
    isVotingActive,
    getVoteResult,
  });

  if (activeItem.is_closing_vote) {
    return {
      suggestionIds: new Set<string>(),
      suggestionResolutions,
    };
  }

  const targetSuggestionId = resolvePreviewSuggestionIdForTimelineItem(
    activeItem,
    crIdToDiscussionId
  );
  if (!targetSuggestionId) return null;

  return {
    suggestionIds: new Set([targetSuggestionId]),
    suggestionResolutions,
  };
}
