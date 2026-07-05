'use client';

import { Fragment, type ReactNode } from 'react';
import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl, getEditingModeOption } from '@/features/shared/ui/status';
import { FormControlInput } from '@/features/shared/ui/form';
import type { Value } from 'platejs';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Progress } from '@/features/shared/ui/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ToggleGroup } from '@/features/shared/ui/ui/toggle-group';
import { FilterToggleGroupItem } from '@/features/shared/ui/filter-controls';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/features/shared/ui/ui/alert-dialog';
import {
  Vote,
  FileEdit,
  AlertTriangle,
  CheckCircle2,
  Search,
  ArrowUp01,
  ArrowUpAZ,
  Hash,
} from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { ChangeRequestTimelineCard } from './ChangeRequestTimelineCard';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import { CREditorPreview } from '@/features/change-requests/ui/CREditorPreview';
import { StreetDesignChangeRequestPreview } from '@/features/amendments/streetscape/ui/StreetDesignChangeRequestPreview';
import {
  isStreetDesignChangeRequest,
  type StreetDesignChangeRequest,
  type StreetDesignPreviewSource,
} from '@/features/amendments/streetscape/logic/streetDesignChangeRequests';
import { SuggestionViewToggle } from '@/features/editor/ui/SuggestionViewToggle';
import {
  isMockCRTimelineItem,
  isPendingSubmissionCRTimelineItem,
} from '../logic/createMockCRTimelineItems';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';
import type { ChangeRequestSortMode } from './useChangeRequestCardsListController';
import { DEFAULT_CHANGE_REQUEST_VOTE_ORDER } from '@/features/change-requests/logic/changeRequestVoteOrder';

type TabValue = 'all' | 'open' | 'accepted' | 'rejected';

function canFinalizeInternalChangeRequest(item: any) {
  const cr = item.change_request;
  if (!cr || item.is_closing_vote) return false;
  if (isPendingSubmissionCRTimelineItem(item)) return false;
  if (cr.voting_status === 'completed') return false;
  return (
    cr.status !== 'accepted' &&
    cr.status !== 'approved' &&
    cr.status !== 'rejected' &&
    cr.status !== 'declined'
  );
}

function isVoteSequencePlaceholder(item: any) {
  return Boolean(item?._votePlaceholder);
}

function isChangeRequestVotesPlaceholder(item: any) {
  return item?._voteStepKind === 'change_request_votes_placeholder';
}

function getStreetDesignChangeRequestFromTimelineItem(
  item: ChangeRequestTimelineRow
): StreetDesignChangeRequest | null {
  const changeRequest = item.change_request as (StreetDesignChangeRequest & { id?: string }) | null;
  if (!changeRequest || !isStreetDesignChangeRequest(changeRequest)) return null;

  return {
    ...changeRequest,
    id: changeRequest.id ?? item.change_request_id ?? item.id,
  };
}

export interface ChangeRequestCardsListViewProps {
  items: any[];
  editingMode: EditingMode;
  isVotingActive: any;
  userId: any;
  canManage: any;
  canVote: any;
  hideInlineVotingControls: any;
  allowInlineFinalVoteStart?: any;
  showAgendaDetailsVoteActions?: any;
  voteDisabledTooltip?: any;
  currentItemId: any;
  diffMap: any;
  progress: any;
  eligibleFinalVoterCount?: number;
  completedCount: any;
  allCRsProcessed: any;
  isTimelineComplete: any;
  documentContent: any;
  streetDesigns?: readonly StreetDesignPreviewSource[];
  agendaTitle?: any;
  discussions: any;
  amendmentId: any;
  agendaItemId: any;
  userRecord?: any;
  hasUserVoted: any;
  getUserSelectedChoiceIds: any;
  onCastVote: any;
  onOpenVoteDialog?: any;
  onStartIndicative: any;
  onStartFinal: any;
  onCloseVoting: any;
  onFinalizeInternalVote: any;
  sequenceInterstitial?: ReactNode;
  t: any;
  activeTab: any;
  setActiveTab: any;
  sortMode?: ChangeRequestSortMode;
  setSortMode?: (sortMode: ChangeRequestSortMode) => void;
  searchQuery: any;
  setSearchQuery: any;
  crIdToDiscussionId: any;
  closingVoteItem: any;
  variantVoteItem?: any;
  crItems: any[];
  sequenceItems?: any[];
  hasCRCategoryItems?: boolean;
  sharedPreviewEnabled: any;
  getPreviewCrId: any;
  selectedPreviewCrIds: any;
  setSelectedPreviewCrIds: any;
  searchedItems: any;
  categorized: any;
  getFilteredItems: any;
  filteredItems: any[];
  progressPercent: any;
  availablePreviewCrIds: any;
  defaultPreviewCrId: any;
  normalizedPreviewCrIds: any;
  effectivePreviewCrIds: any;
  selectedPreviewSuggestionIds: any;
  previewSuggestionResolutions: any;
}

export function ChangeRequestCardsListView({
  editingMode,
  isVotingActive,
  userId,
  canManage,
  canVote,
  hideInlineVotingControls,
  allowInlineFinalVoteStart = false,
  showAgendaDetailsVoteActions = false,
  voteDisabledTooltip,
  currentItemId,
  diffMap,
  completedCount,
  eligibleFinalVoterCount,
  allCRsProcessed,
  isTimelineComplete,
  documentContent,
  streetDesigns = [],
  agendaTitle,
  discussions,
  amendmentId,
  agendaItemId,
  userRecord,
  hasUserVoted,
  getUserSelectedChoiceIds,
  onCastVote,
  onOpenVoteDialog,
  onStartIndicative,
  onStartFinal,
  onCloseVoting,
  onFinalizeInternalVote,
  sequenceInterstitial,
  t,
  activeTab,
  setActiveTab,
  sortMode = DEFAULT_CHANGE_REQUEST_VOTE_ORDER,
  setSortMode = () => undefined,
  searchQuery,
  setSearchQuery,
  crIdToDiscussionId,
  closingVoteItem,
  variantVoteItem,
  crItems,
  sequenceItems = [],
  hasCRCategoryItems,
  sharedPreviewEnabled,
  getPreviewCrId,
  setSelectedPreviewCrIds,
  searchedItems,
  categorized,
  filteredItems,
  progressPercent,
  effectivePreviewCrIds,
  selectedPreviewSuggestionIds,
  previewSuggestionResolutions,
}: ChangeRequestCardsListViewProps) {
  const isInternalVotingMode = editingMode === 'vote_internal';
  const editingModeLabel = getEditingModeOption(editingMode, t).label;
  const activeVotingLabel = isInternalVotingMode
    ? t('features.agendas.crTimeline.activeInternalVoting', 'Internal voting mode active')
    : t('features.agendas.crTimeline.activeEventVoting', 'Event voting mode active');
  const effectiveSequenceItems = sequenceItems.length > 0 ? sequenceItems : crItems;
  const shouldShowCRCategoryTabs = hasCRCategoryItems ?? crItems.length > 0;
  const effectiveActiveTab = shouldShowCRCategoryTabs ? activeTab : 'all';
  const shouldShowSortToggle = shouldShowCRCategoryTabs && crItems.length > 1;
  const displayItems =
    effectiveActiveTab === 'all' && filteredItems.length === 0 && effectiveSequenceItems.length > 0
      ? effectiveSequenceItems
      : filteredItems;
  const nextSequenceItemId =
    currentItemId ??
    effectiveSequenceItems.find((item: any) => item.status !== 'completed')?.id ??
    null;
  const sequenceItemCount = effectiveSequenceItems.length || crItems.length;
  const shouldRenderSequenceInterstitial =
    Boolean(sequenceInterstitial) && effectiveActiveTab === 'all';
  const renderSequenceInterstitial = () =>
    shouldRenderSequenceInterstitial ? (
      <div data-testid="change-request-sequence-interstitial">{sequenceInterstitial}</div>
    ) : null;
  const handleSortModeChange = (value: string) => {
    if (value === 'text_position' || value === 'changed_character_count' || value === 'cr_number') {
      setSortMode(value);
    }
  };
  void closingVoteItem;
  void allCRsProcessed;
  const effectivePreviewCrIdSet =
    effectivePreviewCrIds && typeof effectivePreviewCrIds.has === 'function'
      ? effectivePreviewCrIds
      : new Set(Array.isArray(effectivePreviewCrIds) ? effectivePreviewCrIds : []);
  const selectedSharedPreviewItems = effectivePreviewCrIds
    ? crItems.filter((item: ChangeRequestTimelineRow) => {
        const previewCrId = getPreviewCrId(item);
        return previewCrId ? effectivePreviewCrIdSet.has(previewCrId) : false;
      })
    : crItems;
  const selectedSharedStreetChangeRequests = selectedSharedPreviewItems
    .map((item: ChangeRequestTimelineRow) => getStreetDesignChangeRequestFromTimelineItem(item))
    .filter((changeRequest): changeRequest is StreetDesignChangeRequest => Boolean(changeRequest));
  const sharedPreviewHasStreetDesign = selectedSharedStreetChangeRequests.length > 0;
  const sharedPreviewHasText =
    selectedSharedPreviewItems.length > selectedSharedStreetChangeRequests.length;
  const showSharedTextPreview =
    sharedPreviewEnabled && !sharedPreviewHasStreetDesign && Boolean(documentContent);
  const showSharedStreetPreview =
    sharedPreviewEnabled &&
    sharedPreviewHasStreetDesign &&
    !sharedPreviewHasText &&
    Boolean(selectedSharedStreetChangeRequests[0]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        {/* Mode indicator banner */}
        {isVotingActive ? (
          <div
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
              featureThemeClassName('agendaChangeRequestCardsListSuccessBadge')
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">{activeVotingLabel}</span>
            <BadgeControl variant="outline" size="xs" className="ml-auto">
              {editingModeLabel}
            </BadgeControl>
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
              featureThemeClassName('agendaChangeRequestCardsListWarningBadge')
            )}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>
              {t('features.agendas.crTimeline.modeInfo')}: <strong>{editingModeLabel}</strong>.{' '}
              {editingMode === 'vote_internal'
                ? t(
                    'features.agendas.crTimeline.internalVotingActiveInfo',
                    'Internal change request votes are active.'
                  )
                : t('features.agendas.crTimeline.setToVoteEvent')}
            </span>
          </div>
        )}

        {/* Title and progress */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vote className="h-5 w-5" />
            <CardTitle className="text-base">{t('features.agendas.crTimeline.title')}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <BadgeControl variant="outline">
              {completedCount ?? categorized.accepted.length + categorized.rejected.length}/
              {sequenceItemCount}
            </BadgeControl>
            {isTimelineComplete && (
              <BadgeControl variant="default" tone="successStrong">
                {t('features.agendas.crTimeline.allCompleted')}
              </BadgeControl>
            )}
          </div>
        </div>
        {isVotingActive && <Progress value={progressPercent} className="mt-1" />}

        {showSharedTextPreview && (
          <div className="bg-muted/20 space-y-2 rounded-lg border p-3">
            <CREditorPreview
              documentContent={documentContent ?? ([] as Value)}
              suggestionIds={selectedPreviewSuggestionIds}
              allowInteractiveEditor
              editingMode={editingMode}
              amendmentId={amendmentId}
              userId={userId}
              userRecord={userRecord}
              agendaItemId={agendaItemId}
              toolbarEnd={
                <>
                  {editingMode !== 'suggest_event' &&
                    editingMode !== 'event_final_closing_vote' &&
                    discussions &&
                    discussions.length > 1 && (
                      <SuggestionViewToggle
                        discussions={discussions}
                        selectedCrIds={effectivePreviewCrIds}
                        onSelectedCrIdsChange={setSelectedPreviewCrIds}
                      />
                    )}
                </>
              }
            />
          </div>
        )}
        {showSharedStreetPreview && selectedSharedStreetChangeRequests[0] ? (
          <div className="bg-muted/20 space-y-2 rounded-lg border p-3">
            <StreetDesignChangeRequestPreview
              changeRequest={selectedSharedStreetChangeRequests[0]}
              streetDesigns={streetDesigns}
            />
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={effectiveActiveTab}
            onValueChange={value => setActiveTab(value as TabValue)}
            className="max-w-full overflow-x-auto"
          >
            <TabsList className="w-max">
              <TabsTrigger value="all" className="gap-1.5">
                {t('features.agendas.crTimeline.tabAll')}
                <BadgeControl variant="secondary" size="xs" className="ml-0.5">
                  {sequenceItemCount || searchedItems.length}
                </BadgeControl>
              </TabsTrigger>
              {shouldShowCRCategoryTabs && (
                <>
                  <TabsTrigger value="open" className="gap-1.5">
                    {t('features.agendas.crTimeline.tabOpen')}
                    <BadgeControl variant="secondary" size="xs" className="ml-0.5">
                      {categorized.open.length}
                    </BadgeControl>
                  </TabsTrigger>
                  <TabsTrigger value="accepted" className="gap-1.5">
                    {t('features.agendas.crTimeline.tabAccepted')}
                    <BadgeControl
                      variant="outline"
                      className={featureThemeClassName(
                        'agendaChangeRequestCardsListSuccessBadgeAlpha'
                      )}
                    >
                      {categorized.accepted.length}
                    </BadgeControl>
                  </TabsTrigger>
                  <TabsTrigger value="rejected" className="gap-1.5">
                    {t('features.agendas.crTimeline.tabRejected')}
                    <BadgeControl variant="secondary" size="xs" className="ml-0.5">
                      {categorized.rejected.length}
                    </BadgeControl>
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </Tabs>

          {shouldShowSortToggle ? (
            <ToggleGroup
              type="single"
              value={sortMode}
              onValueChange={handleSortModeChange}
              className="w-fit self-start lg:ml-auto lg:self-auto"
              aria-label={t(
                'features.agendas.crTimeline.sortChangeRequests',
                'Sort change requests'
              )}
            >
              <FilterToggleGroupItem
                value="text_position"
                size="sm"
                className="h-8 px-2"
                aria-label={t(
                  'features.agendas.crTimeline.sortByTextPosition',
                  'Sort by text position'
                )}
                title={t('features.agendas.crTimeline.sortByTextPosition', 'Sort by text position')}
              >
                <ArrowUpAZ className="h-4 w-4" />
                <span className="font-mono text-xs font-semibold">A-Z</span>
              </FilterToggleGroupItem>
              <FilterToggleGroupItem
                value="changed_character_count"
                size="sm"
                className="h-8 px-2"
                aria-label={t(
                  'features.agendas.crTimeline.sortByChangedCharacters',
                  'Sort by changed characters'
                )}
                title={t(
                  'features.agendas.crTimeline.sortByChangedCharacters',
                  'Sort by changed characters'
                )}
              >
                <Hash className="h-4 w-4" />
                <span className="font-mono text-xs font-semibold">
                  {t('features.agendas.crTimeline.sortByChangedCharactersShort')}
                </span>
              </FilterToggleGroupItem>
              <FilterToggleGroupItem
                value="cr_number"
                size="sm"
                className="h-8 px-2"
                aria-label={t('features.agendas.crTimeline.sortByNumber', 'Sort by number')}
                title={t('features.agendas.crTimeline.sortByNumber', 'Sort by number')}
              >
                <ArrowUp01 className="h-4 w-4" />
                <span className="font-mono text-xs font-semibold">1-9</span>
              </FilterToggleGroupItem>
            </ToggleGroup>
          ) : null}
        </div>

        {/* Search */}
        {crItems.length > 1 && (
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <FormControlInput
              placeholder={t('features.agendas.crTimeline.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {/* Filtered CR items */}
          {displayItems.length === 0 ? (
            <>
              {renderSequenceInterstitial()}
              <div className="rounded-lg border border-dashed p-8 text-center">
                <FileEdit className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
                <p className="text-muted-foreground text-sm">
                  {effectiveActiveTab === 'all'
                    ? t('features.agendas.crTimeline.noCRs')
                    : t('features.agendas.crTimeline.noItemsInTab')}
                </p>
              </div>
            </>
          ) : (
            displayItems.map((item: any, index: number) => {
              const crId = item.change_request_id ?? item.id;
              const previewCrId = getPreviewCrId(item as ChangeRequestTimelineRow);
              const diff =
                diffMap?.[crId] ??
                (previewCrId ? diffMap?.[previewCrId] : undefined) ??
                diffMap?.[item.id];
              const crTitle = item.change_request?.title;
              const displayCrId =
                item.change_request?.display_cr_id ??
                item.change_request?.displayCrId ??
                item.change_request?.cr_id ??
                crTitle;
              const suggestionId = previewCrId
                ? crIdToDiscussionId.get(previewCrId)
                : crTitle
                  ? crIdToDiscussionId.get(crTitle)
                  : undefined;
              const showCloseInternalVote =
                editingMode === 'vote_internal' &&
                canManage &&
                Boolean(onFinalizeInternalVote) &&
                canFinalizeInternalChangeRequest(item);
              const canJumpToFinalVote =
                isChangeRequestVotesPlaceholder(item) &&
                crItems.length === 0 &&
                Boolean(closingVoteItem);
              const outcomeLabel =
                (item.change_request?.votes_for ?? 0) > (item.change_request?.votes_against ?? 0)
                  ? t('features.amendments.voteControls.accept')
                  : t('features.amendments.voteControls.reject');
              const votesFor = item.change_request?.votes_for ?? 0;
              const votesAgainst = item.change_request?.votes_against ?? 0;
              const votesAbstain = item.change_request?.votes_abstain ?? 0;
              const closeInternalVoteLabel = t(
                'features.agendas.crTimeline.closeInternalVote',
                'Interne Abstimmung beenden'
              );
              const isCardCurrent = isInternalVotingMode
                ? isVotingActive && item.status !== 'completed'
                : isVotingActive && nextSequenceItemId === item.id;
              const isLocked =
                !isInternalVotingMode &&
                isVotingActive &&
                item.status !== 'completed' &&
                (nextSequenceItemId !== item.id ||
                  (isVoteSequencePlaceholder(item) && !canJumpToFinalVote));
              const renderInterstitialBefore =
                shouldRenderSequenceInterstitial && !variantVoteItem && index === 0;
              const renderInterstitialAfter =
                shouldRenderSequenceInterstitial && item.id === variantVoteItem?.id;
              const isSyntheticEventVoteRow = !isInternalVotingMode && isMockCRTimelineItem(item);
              const itemCanVote = isVotingActive && !isSyntheticEventVoteRow ? canVote : false;
              const itemOpenVoteDialog =
                isVotingActive && !isSyntheticEventVoteRow ? onOpenVoteDialog : undefined;

              return (
                <Fragment key={item.id}>
                  {renderInterstitialBefore ? renderSequenceInterstitial() : null}
                  <div className="space-y-2">
                    <ChangeRequestTimelineCard
                      item={item as ChangeRequestTimelineRow}
                      index={index}
                      isCurrent={isCardCurrent}
                      hasUserVoted={
                        hasUserVoted ? hasUserVoted(item as ChangeRequestTimelineRow) : false
                      }
                      userSelectedChoiceIds={
                        getUserSelectedChoiceIds
                          ? getUserSelectedChoiceIds(item as ChangeRequestTimelineRow)
                          : []
                      }
                      canManage={isVotingActive ? canManage : false}
                      canVote={itemCanVote}
                      eligibleFinalVoterCount={eligibleFinalVoterCount}
                      hideInlineVotingControls={hideInlineVotingControls}
                      allowInlineFinalVoteStart={allowInlineFinalVoteStart}
                      showAgendaDetailsVoteActions={showAgendaDetailsVoteActions}
                      voteDisabledTooltip={voteDisabledTooltip}
                      isVotingActive={isVotingActive}
                      isFinalVoteLocked={isLocked}
                      diff={diff}
                      documentContent={documentContent}
                      streetDesigns={streetDesigns}
                      suggestionId={suggestionId}
                      suggestionResolutions={previewSuggestionResolutions}
                      agendaTitle={agendaTitle}
                      crId={displayCrId || crTitle || previewCrId || undefined}
                      displayCrId={displayCrId || undefined}
                      discussions={discussions}
                      editingMode={editingMode}
                      amendmentId={amendmentId}
                      userId={userId}
                      userRecord={userRecord}
                      agendaItemId={agendaItemId}
                      showEditorPreview
                      onCastVote={isVotingActive ? onCastVote : undefined}
                      onOpenVoteDialog={itemOpenVoteDialog}
                      onStartIndicative={isVotingActive ? onStartIndicative : undefined}
                      onStartFinal={isVotingActive ? onStartFinal : undefined}
                      onCloseVoting={isVotingActive ? onCloseVoting : undefined}
                    />
                    {showCloseInternalVote && (
                      <div className="flex justify-end">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              {closeInternalVoteLabel}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t(
                                  'features.agendas.crTimeline.closeInternalVoteDialogTitle',
                                  'Interne Abstimmung beenden?'
                                )}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('features.agendas.crTimeline.closeInternalVoteDescription', {
                                  outcome: outcomeLabel,
                                  accept: votesFor,
                                  reject: votesAgainst,
                                  abstain: votesAbstain,
                                })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  void onFinalizeInternalVote(item.change_request_id ?? item.id);
                                }}
                              >
                                {closeInternalVoteLabel}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                  {renderInterstitialAfter ? renderSequenceInterstitial() : null}
                </Fragment>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
