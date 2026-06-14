'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { FormControlInput } from '@/features/shared/ui/form';
import { useState, useMemo } from 'react';
import type { Value } from 'platejs';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Progress } from '@/features/shared/ui/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { Vote, FileEdit, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { TDiscussion } from '@/features/editor/types';
import { ChangeRequestTimelineCard, type ChangeRequestDiffData } from './ChangeRequestTimelineCard';
import { getCRFilterStatus } from '../logic/createMockCRTimelineItems';
import { getVoteResult } from '../hooks/useAgendaItemCRVoting';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import { CREditorPreview } from '@/features/change-requests/ui/CREditorPreview';
import { SuggestionViewToggle } from '@/features/editor/ui/SuggestionViewToggle';
import { EditingModeSelector } from '@/features/editor/ui/EditingModeSelector';

type TabValue = 'all' | 'open' | 'accepted' | 'rejected';

interface ChangeRequestCardsListProps {
  items: ChangeRequestTimelineRow[];
  editingMode?: string | null;
  isVotingActive: boolean;
  userId?: string;
  canManage?: boolean;
  canVote?: boolean;
  currentItemId?: string | null;
  /** Map from CR change_request_id (or mock item id) to diff data */
  diffMap?: Record<string, ChangeRequestDiffData>;
  /** Progress through the voting timeline (0-1) */
  progress?: number;
  completedCount?: number;
  allCRsProcessed?: boolean;
  isTimelineComplete?: boolean;
  /** Document content for editor preview */
  documentContent?: Value;
  /** Discussion entries from amendment for CR ID mapping */
  discussions?: TDiscussion[];
  /** Amendment ID — needed for interactive editor and mode selector */
  amendmentId?: string;
  /** Agenda item ID — passed to interactive editor */
  agendaItemId?: string;
  hasUserVoted?: (item: ChangeRequestTimelineRow) => boolean;
  getUserSelectedChoiceIds?: (item: ChangeRequestTimelineRow) => string[];
  onCastVote?: (item: ChangeRequestTimelineRow, choiceId: string) => Promise<void>;
  onStartIndicative?: (itemId: string) => Promise<void>;
  onStartFinal?: (itemId: string) => Promise<void>;
  onCloseVoting?: (itemId: string) => Promise<void> | Promise<unknown>;
}

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

export function ChangeRequestCardsList({
  items,
  editingMode,
  isVotingActive,
  userId,
  canManage = false,
  canVote = false,
  currentItemId,
  diffMap,
  progress,
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
}: ChangeRequestCardsListProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Build crId → discussion UUID map from discussions
  const crIdToDiscussionId = useMemo(() => {
    const map = new Map<string, string>();
    if (discussions) {
      for (const d of discussions) {
        if (d.crId) {
          map.set(d.crId, d.id);
        }
      }
    }
    return map;
  }, [discussions]);

  // Separate final vote from regular CR items for filtering
  const finalVoteItem = useMemo(() => items.find(i => i.is_final_vote), [items]);
  const crItems = useMemo(() => items.filter(i => !i.is_final_vote), [items]);

  const sharedPreviewEnabled = useMemo(
    () =>
      Boolean(
        ((editingMode === 'suggest_event' || editingMode === 'vote_event') && amendmentId) ||
        (documentContent && discussions && discussions.length > 0)
      ),
    [amendmentId, discussions, documentContent, editingMode]
  );

  const getPreviewCrId = (item: ChangeRequestTimelineRow): string | null => {
    const previewCrId = item.change_request?.title;
    return previewCrId && previewCrId.trim().length > 0 ? previewCrId : null;
  };

  const [selectedPreviewCrIds, setSelectedPreviewCrIds] = useState<Set<string> | null>(() => {
    const defaultItem =
      items.find(item => item.id === currentItemId && !item.is_final_vote) ?? crItems[0];
    const previewCrId = defaultItem ? getPreviewCrId(defaultItem) : null;
    return previewCrId ? new Set([previewCrId]) : null;
  });

  // Text search filter
  const searchedItems = useMemo(() => {
    if (!searchQuery.trim()) return crItems;
    const query = searchQuery.toLowerCase();
    return crItems.filter(item => {
      const cr = item.change_request;
      const title = cr?.title?.toLowerCase() ?? '';
      const description = cr?.description?.toLowerCase() ?? '';
      return title.includes(query) || description.includes(query);
    });
  }, [crItems, searchQuery]);

  // Categorize CR items by status for tabs
  const categorized = useMemo(() => {
    const open: ChangeRequestTimelineRow[] = [];
    const accepted: ChangeRequestTimelineRow[] = [];
    const rejected: ChangeRequestTimelineRow[] = [];

    for (const item of searchedItems) {
      const filterStatus = getCRFilterStatus(
        item,
        isVotingActive ? (getVoteResult as (item: never) => string) : undefined
      );
      if (filterStatus === 'accepted') accepted.push(item);
      else if (filterStatus === 'rejected') rejected.push(item);
      else open.push(item);
    }

    return { open, accepted, rejected };
  }, [searchedItems, isVotingActive]);

  const getFilteredItems = (tab: TabValue): ChangeRequestTimelineRow[] => {
    switch (tab) {
      case 'open':
        return categorized.open;
      case 'accepted':
        return categorized.accepted;
      case 'rejected':
        return categorized.rejected;
      case 'all':
      default:
        return searchedItems;
    }
  };

  const filteredItems = getFilteredItems(activeTab);
  const progressPercent = progress ? Math.round(progress * 100) : 0;

  const availablePreviewCrIds = useMemo(
    () =>
      new Set(
        crItems.map(item => getPreviewCrId(item)).filter((value): value is string => Boolean(value))
      ),
    [crItems]
  );

  const defaultPreviewCrId = useMemo(() => {
    const currentPreviewItem = currentItemId
      ? crItems.find(item => item.id === currentItemId)
      : undefined;
    const currentPreviewCrId = currentPreviewItem ? getPreviewCrId(currentPreviewItem) : null;
    if (currentPreviewCrId) {
      return currentPreviewCrId;
    }

    const firstFilteredPreviewCrId = filteredItems
      .map(item => getPreviewCrId(item))
      .find((value): value is string => Boolean(value));

    if (firstFilteredPreviewCrId) {
      return firstFilteredPreviewCrId;
    }

    return (
      crItems.map(item => getPreviewCrId(item)).find((value): value is string => Boolean(value)) ??
      null
    );
  }, [crItems, currentItemId, filteredItems]);

  const normalizedPreviewCrIds = useMemo(() => {
    if (!selectedPreviewCrIds || selectedPreviewCrIds.size === 0) {
      return null;
    }

    const validCrIds = [...selectedPreviewCrIds].filter(crId => availablePreviewCrIds.has(crId));
    return validCrIds.length > 0 ? new Set(validCrIds) : null;
  }, [availablePreviewCrIds, selectedPreviewCrIds]);

  const effectivePreviewCrIds =
    normalizedPreviewCrIds ?? (defaultPreviewCrId ? new Set([defaultPreviewCrId]) : null);

  const selectedPreviewSuggestionIds = useMemo(() => {
    if (!effectivePreviewCrIds) {
      return new Set(discussions?.map(d => d.id) ?? []);
    }

    const ids = new Set<string>();
    for (const crId of effectivePreviewCrIds) {
      const discussionId = crIdToDiscussionId.get(crId);
      if (discussionId) {
        ids.add(discussionId);
      }
    }

    if (ids.size === 0) {
      return new Set(discussions?.map(d => d.id) ?? []);
    }

    return ids;
  }, [crIdToDiscussionId, discussions, effectivePreviewCrIds]);

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
            <CREditorPreview
              documentContent={documentContent ?? ([] as Value)}
              suggestionIds={selectedPreviewSuggestionIds}
              editingMode={editingMode}
              amendmentId={amendmentId}
              userId={userId}
              agendaItemId={agendaItemId}
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
            filteredItems.map((item, index) => {
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
