import { useCallback, useMemo, useRef, type ComponentProps } from 'react';
import {
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { PageWrapper } from '@/layout/page-wrapper';
import { MessageSquare, Plus, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { normalizeDiscussionThread } from '../hooks/useDiscussions';
import { ThreadCard } from './ThreadCard';
import { CreateThreadDialog } from './CreateThreadDialog';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import {
  rowAttributes,
  usePolityZeroWindowList,
  ZeroVirtualSpacer,
} from '@/features/shared/virtualization';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { queries } from '@/zero/queries';
import type { AmendmentThreadRow } from '@/zero/amendments/queries';

export type DiscussionSortMode = 'votes' | 'time';
type ThreadCardCallbacks = Pick<
  ComponentProps<typeof ThreadCard>,
  'onCreateComment' | 'onVoteComment' | 'onVoteThread'
>;

interface DiscussionsViewProps {
  amendmentId: string;
  amendmentTitle?: string;
  hasAmendment: boolean;
  authUserEmail?: string;
  isCreateDialogOpen: boolean;
  isLoading: boolean;
  onCreateComment: ThreadCardCallbacks['onCreateComment'];
  onCreateDialogOpenChange: (open: boolean) => void;
  onCreateThread: (
    amendmentId: string,
    title: string,
    description: string,
    userId: string,
    fileId?: string
  ) => Promise<string>;
  onSortByChange: (sortBy: DiscussionSortMode) => void;
  onVoteComment: ThreadCardCallbacks['onVoteComment'];
  onVoteThread: ThreadCardCallbacks['onVoteThread'];
  sortBy: DiscussionSortMode;
  userId?: string;
  /** Legacy controller data retained for isolated loading-state callers. */
  threads?: readonly unknown[];
  /** Kept optional for callers that still expose the former sentinel state. */
  hasMore?: boolean;
  loadMoreRef?: unknown;
}

function VirtualDiscussionThreadList({
  amendmentId,
  amendmentTitle,
  authUserEmail,
  sortBy,
  userId,
  onCreateComment,
  onVoteThread,
  onVoteComment,
  onCreateDialogOpenChange,
}: Pick<
  DiscussionsViewProps,
  | 'amendmentId'
  | 'amendmentTitle'
  | 'authUserEmail'
  | 'sortBy'
  | 'userId'
  | 'onCreateComment'
  | 'onVoteThread'
  | 'onVoteComment'
  | 'onCreateDialogOpenChange'
>) {
  const contentRef = useRef<HTMLDivElement>(null);
  const listContextParams = useMemo(() => ({ amendmentId, sort: sortBy }), [amendmentId, sortBy]);
  const virtualList = usePolityZeroWindowList<
    typeof listContextParams,
    AmendmentThreadRow,
    { id: string; created_at?: number; upvotes?: number; downvotes?: number }
  >({
    scrollStateKey: `amendment-${amendmentId}-discussions-${sortBy}`,
    listContextParams,
    getScrollElement: useCallback(() => contentRef.current, []),
    estimateSize: useCallback(() => 240, []),
    overscan: 4,
    getRowKey: thread => thread.id,
    toStartRow: thread =>
      sortBy === 'votes'
        ? { id: thread.id, upvotes: thread.upvotes, downvotes: thread.downvotes }
        : { id: thread.id, created_at: thread.created_at },
    getPageQuery: useCallback(
      ({ limit, start, dir, settled }) => ({
        query: queries.amendments.discussionThreadPage({
          amendmentId,
          sort: sortBy,
          limit,
          start,
          dir,
        }) as any,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      [amendmentId, sortBy]
    ),
    getSingleQuery: useCallback(
      ({ id, settled }) => ({
        query: queries.amendments.discussionThreadById({ id }) as any,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      []
    ),
  });

  if (virtualList.rowsEmpty) {
    return (
      <div className="py-10 text-center">
        <MessageSquare className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <p className="text-muted-foreground mb-4">
          {translateText(
            'generated.inline.0393_no_discussion_threads_yet_start_a_conversatio_e634e88d'
          )}
        </p>
        {userId ? (
          <Button
            data-action-id="discussions.list.thread.create"
            onClick={() => onCreateDialogOpenChange(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0394_create_first_thread_e26d65a7')}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={contentRef} className="space-y-3">
      <ZeroVirtualSpacer position="before" size={virtualList.spaceBefore} />
      {virtualList.items.map((item, itemPosition) => (
        <div
          key={item.key}
          {...rowAttributes(item.index, item.key)}
          style={itemPosition === 0 ? { marginTop: 0 } : undefined}
        >
          {item.row ? (
            <ThreadCard
              thread={normalizeDiscussionThread(item.row, sortBy)}
              userId={userId}
              amendmentId={amendmentId}
              amendmentTitle={amendmentTitle}
              senderName={authUserEmail}
              onCreateComment={onCreateComment}
              onVoteThread={onVoteThread}
              onVoteComment={onVoteComment}
            />
          ) : (
            <SectionSkeleton rows={1} />
          )}
        </div>
      ))}
      <ZeroVirtualSpacer position="after" size={virtualList.spaceAfter} />
    </div>
  );
}

export function DiscussionsView({
  amendmentId,
  amendmentTitle,
  authUserEmail,
  hasAmendment,
  isCreateDialogOpen,
  isLoading,
  onCreateComment,
  onCreateDialogOpenChange,
  onCreateThread,
  onSortByChange,
  onVoteComment,
  onVoteThread,
  sortBy,
  userId,
}: DiscussionsViewProps) {
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
      <div data-slot="discussions-page-content" className="w-full">
        <div className="w-full">
          <h1 className="sr-only">{translateText('generated.inline.0387_discussions_0474a6c6')}</h1>
          <div className="mb-4 flex justify-end">
            <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 sm:w-auto sm:gap-3">
              {userId ? (
                <Button
                  data-action-id="discussions.list.thread.create"
                  onClick={() => onCreateDialogOpenChange(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {translateText('generated.inline.0392_new_thread_66826f91')}
                </Button>
              ) : null}
              <FormControlSelect
                data-action-id="discussions.list.sort.change"
                value={sortBy}
                onValueChange={value => onSortByChange(value as DiscussionSortMode)}
              >
                <FormControlSelectTrigger
                  data-action-id="discussions.list.sort.open"
                  className="ml-auto max-w-[180px] min-w-0 flex-1 sm:w-[180px] sm:flex-none"
                >
                  <FormControlSelectValue />
                </FormControlSelectTrigger>
                <FormControlSelectContent>
                  <FormControlSelectItem value="votes" data-action-id="discussions.list.sort.votes">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      <span>{translateText('generated.inline.0390_top_voted_3ecc2d00')}</span>
                    </div>
                  </FormControlSelectItem>
                  <FormControlSelectItem value="time" data-action-id="discussions.list.sort.time">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>{translateText('generated.inline.0391_newest_first_a40bb555')}</span>
                    </div>
                  </FormControlSelectItem>
                </FormControlSelectContent>
              </FormControlSelect>
            </div>
          </div>

          <div className="space-y-3">
            <VirtualDiscussionThreadList
              amendmentId={amendmentId}
              amendmentTitle={amendmentTitle}
              authUserEmail={authUserEmail}
              sortBy={sortBy}
              userId={userId}
              onCreateComment={onCreateComment}
              onVoteThread={onVoteThread}
              onVoteComment={onVoteComment}
              onCreateDialogOpenChange={onCreateDialogOpenChange}
            />
          </div>
        </div>
      </div>

      {userId ? (
        <CreateThreadDialog
          amendmentId={amendmentId}
          userId={userId}
          amendmentTitle={amendmentTitle}
          senderName={authUserEmail}
          open={isCreateDialogOpen}
          onOpenChange={onCreateDialogOpenChange}
          onCreateThread={onCreateThread}
        />
      ) : null}
    </PageWrapper>
  );
}
