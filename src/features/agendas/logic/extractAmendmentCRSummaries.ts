/**
 * Extract CRSummary entries from an amendment's discussions and saved change_requests.
 * Used on the agenda item detail page where we have the amendment relation but
 * not the full document content (no text diff parsing).
 */
import type { CRSummary } from './createMockCRTimelineItems';
import { buildCanonicalChangeRequestRecords } from '@/features/change-requests/logic/canonicalChangeRequests';
import {
  hasRenderableSuggestionContent,
  suggestionContentFromChangeRequestSnapshot,
} from '@/features/change-requests/utils/suggestion-extraction';

interface DiscussionEntry {
  id: string;
  crId?: string;
  changeRequestEntityId?: string;
  title?: string;
  description?: string;
  justification?: string;
  status?: string;
  confirmationStatus?: 'pending' | 'confirmed' | null;
}

interface SavedChangeRequest {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  voting_status?: string | null;
  votes_for?: number | null;
  votes_against?: number | null;
  votes_abstain?: number | null;
  voting_deadline?: number | null;
  resolution_method?: string | null;
  visibility_scope?: string | null;
  resolved_in_mode?: string | null;
  change_type?: string | null;
  original_text?: string | null;
  new_text?: string | null;
  original_properties?: Record<string, string> | null;
  new_properties?: Record<string, string> | null;
}

/**
 * Merge open CRs from discussions JSON with closed CRs from saved change_request entities.
 * Returns a flat array of CRSummary objects suitable for createMockCRTimelineItems().
 */
export function extractAmendmentCRSummaries(
  discussions: readonly unknown[] | null | undefined,
  savedChangeRequests: readonly SavedChangeRequest[] | null | undefined
): CRSummary[] {
  return buildCanonicalChangeRequestRecords({
    discussions: discussions as readonly DiscussionEntry[] | null | undefined,
    changeRequests: savedChangeRequests,
  }).map(record => {
    const discussion = record.discussion;
    const cr = record.changeRequest;
    const snapshotCr = record.snapshotChangeRequest ?? cr;
    const snapshotContent = snapshotCr
      ? suggestionContentFromChangeRequestSnapshot(snapshotCr)
      : null;
    const hasSnapshot = snapshotContent ? hasRenderableSuggestionContent(snapshotContent) : false;

    return {
      id: cr?.id ?? discussion?.id ?? record.logicalKey,
      logicalKey: record.logicalKey,
      crId: record.displayCrId ?? cr?.title ?? undefined,
      title: record.displayTitle,
      description: discussion?.description ?? cr?.description ?? '',
      status: cr?.status ?? discussion?.status ?? 'open',
      type: hasSnapshot ? snapshotContent?.type : undefined,
      text: hasSnapshot ? snapshotContent?.text : undefined,
      newText: hasSnapshot ? snapshotContent?.newText : undefined,
      properties: hasSnapshot ? (snapshotContent?.properties as Record<string, string>) : undefined,
      newProperties: hasSnapshot
        ? (snapshotContent?.newProperties as Record<string, string>)
        : undefined,
      justification: discussion?.justification,
      votesFor: cr?.votes_for ?? 0,
      votesAgainst: cr?.votes_against ?? 0,
      votesAbstain: cr?.votes_abstain ?? 0,
      suggestionId: discussion?.id ?? null,
      discussionId: discussion?.id ?? null,
      changeRequestEntityId: cr?.id ?? discussion?.changeRequestEntityId ?? null,
      votingDeadline: cr?.voting_deadline ?? null,
      resolutionMethod: cr?.resolution_method ?? null,
      visibilityScope: cr?.visibility_scope ?? null,
      resolvedInMode: cr?.resolved_in_mode ?? null,
      votingStatus: cr?.voting_status ?? null,
      confirmationStatus: discussion?.confirmationStatus ?? (cr ? 'confirmed' : null),
    };
  });
}
