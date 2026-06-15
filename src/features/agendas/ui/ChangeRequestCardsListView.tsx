'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { FormControlInput } from '@/features/shared/ui/form';
import type { Value } from 'platejs';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Progress } from '@/features/shared/ui/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { Vote, FileEdit, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { ChangeRequestTimelineCard } from './ChangeRequestTimelineCard';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import { CREditorPreview } from '@/features/change-requests/ui/CREditorPreview';
import { SuggestionViewToggle } from '@/features/editor/ui/SuggestionViewToggle';
import { EditingModeSelector } from '@/features/editor/ui/EditingModeSelector';

type TabValue = 'all' | 'open' | 'accepted' | 'rejected';
function getEditingModeLabel(mode: string | null | undefined): string {
  switch (mode) {
    case 'edit':
      return 'Edit Mode';
    case 'view':
      return 'View Mode';
    case 'suggest_internal':
      return 'Internal Suggestions';
    case 'suggest_event':
      return 'Event Suggestions';
    case 'vote_internal':
      return 'Internal Voting';
    case 'vote_event':
      return 'Event Voting';
    case 'passed':
      return 'Passed';
    case 'rejected':
      return 'Rejected';
    default:
      return mode || 'Unknown';
  }
}
export interface ChangeRequestCardsListViewProps {
  items: any[];
  editingMode: any;
  isVotingActive: any;
  userId: any;
  canManage: any;
  canVote: any;
  currentItemId: any;
  diffMap: any;
  progress: any;
  completedCount: any;
  allCRsProcessed: any;
  isTimelineComplete: any;
  documentContent: any;
  discussions: any;
  amendmentId: any;
  agendaItemId: any;
  hasUserVoted: any;
  getUserSelectedChoiceIds: any;
  onCastVote: any;
  onStartIndicative: any;
  onStartFinal: any;
  onCloseVoting: any;
  t: any;
  activeTab: any;
  setActiveTab: any;
  searchQuery: any;
  setSearchQuery: any;
  crIdToDiscussionId: any;
  finalVoteItem: any;
  crItems: any[];
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
}

export function ChangeRequestCardsListView({
  editingMode,
  isVotingActive,
  userId,
  canManage,
  canVote,
  currentItemId,
  diffMap,
  completedCount,
  allCRsProcessed,
  isTimelineComplete,
  documentContent,
  discussions,
  amendmentId,
  agendaItemId,
  hasUserVoted,
  getUserSelectedChoiceIds,
  onCastVote,
  onStartIndicative,
  onStartFinal,
  onCloseVoting,
  t,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  crIdToDiscussionId,
  finalVoteItem,
  crItems,
  sharedPreviewEnabled,
  setSelectedPreviewCrIds,
  searchedItems,
  categorized,
  filteredItems,
  progressPercent,
  effectivePreviewCrIds,
  selectedPreviewSuggestionIds,
}: ChangeRequestCardsListViewProps) {
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
            <span className="font-medium">{t('features.agendas.crTimeline.votingActive')}</span>
            <BadgeControl variant="outline" size="xs" className="ml-auto">
              vote_event
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
              {t('features.agendas.crTimeline.modeInfo')}:{' '}
              <strong>{getEditingModeLabel(editingMode)}</strong>.{' '}
              {t('features.agendas.crTimeline.setToVoteEvent')}
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
              {crItems.length}
            </BadgeControl>
            {isTimelineComplete && (
              <BadgeControl variant="default" tone="successStrong">
                {t('features.agendas.crTimeline.allCompleted')}
              </BadgeControl>
            )}
          </div>
        </div>
        {isVotingActive && <Progress value={progressPercent} className="mt-1" />}

        {sharedPreviewEnabled && (
          <div className="bg-muted/20 space-y-2 rounded-lg border p-3">
            <CREditorPreview
              documentContent={documentContent ?? ([] as Value)}
              suggestionIds={selectedPreviewSuggestionIds}
              editingMode={editingMode}
              amendmentId={amendmentId}
              userId={userId}
              agendaItemId={agendaItemId}
              toolbarEnd={
                <>
                  {amendmentId && (
                    <EditingModeSelector amendmentId={amendmentId} currentMode={editingMode} />
                  )}
                  {editingMode !== 'suggest_event' &&
                    editingMode !== 'vote_event' &&
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as TabValue)}>
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              {t('features.agendas.crTimeline.tabAll')}
              <BadgeControl variant="secondary" size="xs" className="ml-0.5">
                {searchedItems.length}
              </BadgeControl>
            </TabsTrigger>
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
                className={featureThemeClassName('agendaChangeRequestCardsListSuccessBadgeAlpha')}
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
          </TabsList>
        </Tabs>

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
          {filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <FileEdit className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
              <p className="text-muted-foreground text-sm">
                {activeTab === 'all'
                  ? t('features.agendas.crTimeline.noCRs')
                  : t('features.agendas.crTimeline.noItemsInTab')}
              </p>
            </div>
          ) : (
            filteredItems.map((item: any, index: number) => {
              const crId = item.change_request_id ?? item.id;
              const diff = diffMap?.[crId] ?? diffMap?.[item.id];
              const crTitle = item.change_request?.title;
              const suggestionId = crTitle ? crIdToDiscussionId.get(crTitle) : undefined;

              return (
                <ChangeRequestTimelineCard
                  key={item.id}
                  item={item as ChangeRequestTimelineRow}
                  index={index}
                  isCurrent={isVotingActive && currentItemId === item.id}
                  hasUserVoted={
                    hasUserVoted ? hasUserVoted(item as ChangeRequestTimelineRow) : false
                  }
                  userSelectedChoiceIds={
                    getUserSelectedChoiceIds
                      ? getUserSelectedChoiceIds(item as ChangeRequestTimelineRow)
                      : []
                  }
                  canManage={isVotingActive ? canManage : false}
                  canVote={isVotingActive ? canVote : false}
                  isFinalVoteLocked={false}
                  diff={diff}
                  documentContent={documentContent}
                  suggestionId={suggestionId}
                  crId={crTitle || undefined}
                  discussions={discussions}
                  editingMode={editingMode}
                  amendmentId={amendmentId}
                  userId={userId}
                  agendaItemId={agendaItemId}
                  showEditorPreview
                  onCastVote={isVotingActive ? onCastVote : undefined}
                  onStartIndicative={isVotingActive ? onStartIndicative : undefined}
                  onStartFinal={isVotingActive ? onStartFinal : undefined}
                  onCloseVoting={isVotingActive ? onCloseVoting : undefined}
                />
              );
            })
          )}

          {/* Final Vote item — always shown in "All" tab */}
          {finalVoteItem && activeTab === 'all' && (
            <ChangeRequestTimelineCard
              key={finalVoteItem.id}
              item={finalVoteItem as ChangeRequestTimelineRow}
              index={crItems.length}
              isCurrent={isVotingActive && currentItemId === finalVoteItem.id}
              hasUserVoted={
                hasUserVoted ? hasUserVoted(finalVoteItem as ChangeRequestTimelineRow) : false
              }
              userSelectedChoiceIds={
                getUserSelectedChoiceIds
                  ? getUserSelectedChoiceIds(finalVoteItem as ChangeRequestTimelineRow)
                  : []
              }
              canManage={isVotingActive ? canManage : false}
              canVote={isVotingActive ? canVote : false}
              isFinalVoteLocked={!allCRsProcessed}
              showEditorPreview
              onCastVote={isVotingActive ? onCastVote : undefined}
              onStartIndicative={isVotingActive ? onStartIndicative : undefined}
              onStartFinal={isVotingActive ? onStartFinal : undefined}
              onCloseVoting={isVotingActive ? onCloseVoting : undefined}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
