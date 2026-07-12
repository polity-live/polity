import type { Value } from 'platejs';
import { PageWrapper } from '@/layout/page-wrapper';
import { FileEdit } from 'lucide-react';
import { ChangeRequestCardsList } from '@/features/agendas/ui/ChangeRequestCardsList';
import type { VariantDiffCandidate } from '@/features/agendas/ui/MergeVariantComparisonPanel';
import type { ChangeRequestDiffData } from '@/features/agendas/ui/ChangeRequestTimelineCard';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { TDiscussion } from '@/features/editor/types';
import { AmendmentBranchSelectorSection } from '@/features/amendments/ui/AmendmentBranchSelectorSection';
import type { AmendmentProcessBranchSource } from '@/features/amendments/logic/amendmentBranchDisplay';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import type { ChangeRequestBranchSection } from '../logic/changeRequestsViewModel';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';
import type { StreetDesignPreviewSource } from '@/features/amendments/streetscape/logic/streetDesignChangeRequests';

interface ChangeRequestsViewProps {
  agendaItemId?: string;
  allChangeRequestsCount: number;
  amendmentId: string;
  approvedCount: number;
  declinedCount: number;
  diffMap: Record<string, ChangeRequestDiffData>;
  discussions: TDiscussion[];
  documentContent?: Value;
  streetDesigns?: readonly StreetDesignPreviewSource[];
  editingMode?: EditingMode | null;
  hasAmendment: boolean;
  isInVotingStage: boolean;
  isLoading: boolean;
  openCount: number;
  timelineItems: ChangeRequestTimelineRow[];
  branchSections?: ChangeRequestBranchSection[];
  branchSelectorBranches?: readonly AmendmentProcessBranchSource[];
  selectedBranchId?: string | null;
  branchDiffCandidates?: VariantDiffCandidate[];
  defaultBranchDiffRightCandidateId?: string | null;
  onBranchChange?: (branchId: string | null) => void;
  userId?: string;
  canManageInternalVotes?: boolean;
  canVoteInternal?: boolean;
  canVoteEvent?: boolean;
  hasUserVotedOnEventCR?: (item: ChangeRequestTimelineRow) => boolean;
  getEventCRSelectedChoiceIds?: (item: ChangeRequestTimelineRow) => string[];
  onCastEventCRVote?: (item: ChangeRequestTimelineRow, choiceId: string) => Promise<void>;
  onOpenEventCRVoteDialog?: (itemId: string) => void;
  onCastInternalVote?: (item: ChangeRequestTimelineRow, choiceId: string) => Promise<void>;
  onFinalizeInternalVote?: (changeRequestId: string) => Promise<void>;
}

export function ChangeRequestsView({
  agendaItemId,
  amendmentId,
  diffMap,
  discussions,
  documentContent,
  streetDesigns = [],
  editingMode,
  hasAmendment,
  isLoading,
  timelineItems,
  branchSections = [],
  branchSelectorBranches = [],
  selectedBranchId,
  branchDiffCandidates = [],
  defaultBranchDiffRightCandidateId,
  onBranchChange,
  userId,
  canManageInternalVotes,
  canVoteInternal,
  canVoteEvent,
  hasUserVotedOnEventCR,
  getEventCRSelectedChoiceIds,
  onCastEventCRVote,
  onOpenEventCRVoteDialog,
  onCastInternalVote,
  onFinalizeInternalVote,
}: ChangeRequestsViewProps) {
  const hasUserVoted = (item: ChangeRequestTimelineRow) =>
    Boolean(
      item.change_request && 'user_vote' in item.change_request && item.change_request.user_vote
    );
  const getUserSelectedChoiceIds = (item: ChangeRequestTimelineRow) => {
    const userVote =
      item.change_request && 'user_vote' in item.change_request
        ? item.change_request.user_vote
        : null;
    if (!userVote || !item.change_request_id) return [];
    const choiceKey = userVote === 'accept' ? 'yes' : userVote === 'reject' ? 'no' : 'abstain';
    return [`mock-choice-${choiceKey}-${item.change_request_id}`];
  };
  const renderChangeRequestList = ({
    items,
    sectionDiffMap,
    sectionDocumentContent,
    sectionDiscussions,
    sectionEditingMode,
  }: {
    items: ChangeRequestTimelineRow[];
    sectionDiffMap: Record<string, ChangeRequestDiffData>;
    sectionDocumentContent?: Value;
    sectionDiscussions: TDiscussion[];
    sectionEditingMode?: EditingMode | null;
  }) => {
    const resolvedEditingMode = sectionEditingMode ?? editingMode ?? 'edit';
    const isSectionInternalVotingStage = resolvedEditingMode === 'vote_internal';
    const isSectionEventVotingStage =
      resolvedEditingMode === 'suggest_event' || resolvedEditingMode === 'event_final_closing_vote';

    return (
      <ChangeRequestCardsList
        items={items}
        editingMode={resolvedEditingMode}
        isVotingActive={isSectionInternalVotingStage || isSectionEventVotingStage}
        userId={userId}
        diffMap={sectionDiffMap}
        documentContent={sectionDocumentContent}
        streetDesigns={streetDesigns}
        discussions={sectionDiscussions}
        amendmentId={amendmentId}
        agendaItemId={agendaItemId}
        canManage={isSectionInternalVotingStage && Boolean(canManageInternalVotes)}
        canVote={
          isSectionInternalVotingStage
            ? Boolean(canVoteInternal)
            : isSectionEventVotingStage && Boolean(canVoteEvent)
        }
        hideInlineVotingControls={isSectionEventVotingStage}
        showAgendaDetailsVoteActions={isSectionEventVotingStage}
        hasUserVoted={
          isSectionInternalVotingStage
            ? hasUserVoted
            : isSectionEventVotingStage
              ? hasUserVotedOnEventCR
              : undefined
        }
        getUserSelectedChoiceIds={
          isSectionInternalVotingStage
            ? getUserSelectedChoiceIds
            : isSectionEventVotingStage
              ? getEventCRSelectedChoiceIds
              : undefined
        }
        onCastVote={
          isSectionInternalVotingStage
            ? onCastInternalVote
            : isSectionEventVotingStage
              ? onCastEventCRVote
              : undefined
        }
        onOpenVoteDialog={isSectionEventVotingStage ? onOpenEventCRVoteDialog : undefined}
        onFinalizeInternalVote={isSectionInternalVotingStage ? onFinalizeInternalVote : undefined}
      />
    );
  };
  const hasBranchSections = branchSections.length > 0;
  const selectedBranchSection =
    hasBranchSections && selectedBranchId
      ? (branchSections.find(section => section.branchId === selectedBranchId) ?? null)
      : null;
  const displayedBranchSections = hasBranchSections
    ? selectedBranchSection
      ? [selectedBranchSection]
      : branchSections
    : [];

  if (isLoading) {
    return (
      <PageWrapper>
        <PageSkeleton label={translateText('common.loading.pageSkeleton.entity')} />
      </PageWrapper>
    );
  }

  if (!hasAmendment) {
    return (
      <PageWrapper>
        <div className="py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold">
            {translateText('generated.inline.0066_amendment_not_found_3cea3d4d')}
          </h1>
          <p className="text-muted-foreground">
            {translateText(
              'generated.inline.0067_the_amendment_you_re_looking_for_doesn_t_exis_f871134d'
            )}
          </p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="space-y-6 pt-5">
        <h1 className="sr-only">
          {translateText('generated.inline.0285_change_requests_af9a9fa4')}
        </h1>

        {branchSelectorBranches.length > 0 && onBranchChange ? (
          <AmendmentBranchSelectorSection
            branches={branchSelectorBranches}
            selectedBranchId={selectedBranchId}
            includeAllBranchesOption
            branchDiffCandidates={branchDiffCandidates}
            defaultDiffRightCandidateId={defaultBranchDiffRightCandidateId ?? null}
            onBranchChange={onBranchChange}
          />
        ) : null}

        <div className="container mx-auto px-8">
          {hasBranchSections ? (
            <div className="space-y-8" data-testid="change-request-branch-sections">
              {displayedBranchSections.map(section => (
                <section
                  key={section.id}
                  className="space-y-3"
                  data-testid="change-request-branch-section"
                  data-branch-id={section.branchId ?? 'main'}
                >
                  {section.timelineItems.length > 0 ? (
                    renderChangeRequestList({
                      items: section.timelineItems,
                      sectionDiffMap: section.diffMap,
                      sectionDocumentContent: section.documentContent ?? documentContent,
                      sectionDiscussions:
                        section.discussions.length > 0 ? section.discussions : discussions,
                      sectionEditingMode: section.editingMode,
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <FileEdit className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
                      <p className="text-muted-foreground text-sm">
                        {translateText(
                          'generated.inline.0290_no_change_requests_for_this_branch_4fd98d30',
                          'No change requests for this branch.'
                        )}
                      </p>
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : timelineItems.length > 0 ? (
            renderChangeRequestList({
              items: timelineItems,
              sectionDiffMap: diffMap,
              sectionDocumentContent: documentContent,
              sectionDiscussions: discussions,
              sectionEditingMode: editingMode,
            })
          ) : null}
        </div>
      </div>
    </PageWrapper>
  );
}
