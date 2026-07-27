import type { ComponentProps, CSSProperties } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { CountBadge } from '@/features/shared/ui/status';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { AmendmentTimelineCard } from '@/features/timeline/ui/cards/AmendmentTimelineCard';
import { PolityLocalGridView, PolityZeroGridView } from '@/features/shared/virtualization';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { queries } from '@/zero/queries';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { mapAmendmentBranchStatusChips } from '@/features/amendments/logic/amendmentBranchDisplay';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

import type { GroupAmendmentDisplayStatus } from '../logic/groupAmendmentStatus';

interface AmendmentGroupsViewProps {
  openSections: Record<GroupAmendmentDisplayStatus, boolean>;
  sectionOrder: {
    key: GroupAmendmentDisplayStatus;
    label: string;
    count: number;
    items: {
      id: string;
      cardAmendment: ComponentProps<typeof AmendmentTimelineCard>['amendment'];
    }[];
  }[];
  onToggleSection: (section: GroupAmendmentDisplayStatus) => void;
  groupId?: string;
  groupName?: string;
  queryFilters: { searchQuery: string; statusFilter: string; hashtagFilter: string };
}

export function AmendmentGroupsView({
  openSections,
  sectionOrder,
  onToggleSection,
  groupId,
  groupName,
  queryFilters,
}: AmendmentGroupsViewProps) {
  let nextMotionIndex = 0;

  return (
    <div className="space-y-6">
      {sectionOrder.map((section: AmendmentGroupsViewProps['sectionOrder'][number]) => {
        if (section.count === 0) {
          return null;
        }

        const isSectionOpen = openSections[section.key];
        const sectionMotionStartIndex = nextMotionIndex;
        if (isSectionOpen) {
          nextMotionIndex += section.count;
        }

        return (
          <Collapsible
            key={section.key}
            open={isSectionOpen}
            onOpenChange={() => onToggleSection(section.key)}
          >
            <div className="bg-card rounded-lg border">
              <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  {isSectionOpen ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <h2 className="text-xl font-semibold">{section.label}</h2>
                  <CountBadge count={section.count} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4">
                  {groupId ? (
                    <PolityZeroGridView<any, { created_at: number; id: string }, any>
                      context={{
                        groupId,
                        displayStatus: section.key,
                        query: queryFilters.searchQuery,
                        hashtag: queryFilters.hashtagFilter,
                      }}
                      historyKey={`group-${groupId}-amendments-${section.key}`}
                      getPageQuery={({ limit, start, dir, settled }) => ({
                        query: queries.amendments.groupAmendmentPage({
                          groupId,
                          displayStatus: section.key,
                          query: queryFilters.searchQuery,
                          hashtag: queryFilters.hashtagFilter || undefined,
                          limit,
                          start,
                          dir,
                        }) as never,
                        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
                      })}
                      getSingleQuery={({ id, settled }) => ({
                        query: queries.amendments.groupAmendmentById({ id }) as never,
                        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
                      })}
                      getRowKey={amendment => amendment.id}
                      toStartRow={amendment => ({
                        created_at: amendment.created_at,
                        id: amendment.id,
                      })}
                      getLanes={width => (width >= 768 ? 2 : 1)}
                      estimateSize={360}
                      viewportClassName="max-h-[42rem] min-h-80 overflow-auto"
                      renderRow={(amendment, index) => (
                        <div
                          className="civic-load-card-reveal"
                          style={
                            {
                              '--civic-load-index': Math.min(sectionMotionStartIndex + index, 11),
                            } as CSSProperties
                          }
                        >
                          <AmendmentTimelineCard
                            amendment={{
                              id: amendment.id,
                              title: amendment.title ?? '',
                              subtitle: groupName,
                              description: amendment.reason ?? undefined,
                              status: amendment.group_decisions?.[0]?.status ?? section.key,
                              groupName,
                              groupId,
                              hashtags: extractHashtags(amendment.amendment_hashtags),
                              branchStatuses: mapAmendmentBranchStatusChips(
                                amendment.current_process_run?.branches ?? []
                              ),
                            }}
                          />
                        </div>
                      )}
                      renderSkeleton={() => <Skeleton className="h-80 w-full rounded-xl" />}
                      renderEmpty={() => (
                        <p className="text-muted-foreground py-8 text-center">
                          {translateText('features.groups.amendments.noAmendments')}
                        </p>
                      )}
                    />
                  ) : (
                    <PolityLocalGridView
                      items={section.items}
                      getItemKey={amendment => amendment.id}
                      getLanes={width => (width >= 768 ? 2 : 1)}
                      estimateRowSize={360}
                      className="max-h-[42rem] min-h-80 overflow-auto"
                      renderItem={(amendment, index) => (
                        <div
                          className={isSectionOpen ? 'civic-load-card-reveal' : undefined}
                          style={
                            isSectionOpen
                              ? ({
                                  '--civic-load-index': Math.min(
                                    sectionMotionStartIndex + index,
                                    11
                                  ),
                                } as CSSProperties)
                              : undefined
                          }
                        >
                          <AmendmentTimelineCard amendment={amendment.cardAmendment} />
                        </div>
                      )}
                    />
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
