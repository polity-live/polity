import type { ComponentProps, RefObject } from 'react';
import {
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { PageWrapper } from '@/layout/page-wrapper';
import { MessageSquare, Plus, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import type { Thread } from '../hooks/useDiscussions';
import { ThreadCard } from './ThreadCard';
import { CreateThreadDialog } from './CreateThreadDialog';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { PageSkeleton } from '@/features/shared/ui/feedback';

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
  hasMore: boolean;
  isCreateDialogOpen: boolean;
  isLoading: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
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
  threads: Thread[];
  userId?: string;
}

export function DiscussionsView({
  amendmentId,
  amendmentTitle,
  authUserEmail,
  hasMore,
  hasAmendment,
  isCreateDialogOpen,
  isLoading,
  loadMoreRef,
  onCreateComment,
  onCreateDialogOpenChange,
  onCreateThread,
  onSortByChange,
  onVoteComment,
  onVoteThread,
  sortBy,
  threads,
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <MessageSquare className="h-8 w-8" />
            <h1 className="text-4xl font-bold">
              {translateText('generated.inline.0387_discussions_0474a6c6')}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {threads.length}
            {translateText('generated.inline.0388_discussion_thread_28eed8a6')}
            {threads.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {translateText('generated.inline.0389_sort_by_9bb640e5')}
            </span>
            <FormControlSelect
              value={sortBy}
              onValueChange={value => onSortByChange(value as DiscussionSortMode)}
            >
              <FormControlSelectTrigger className="w-[180px]">
                <FormControlSelectValue />
              </FormControlSelectTrigger>
              <FormControlSelectContent>
                <FormControlSelectItem value="votes">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>{translateText('generated.inline.0390_top_voted_3ecc2d00')}</span>
                  </div>
                </FormControlSelectItem>
                <FormControlSelectItem value="time">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{translateText('generated.inline.0391_newest_first_a40bb555')}</span>
                  </div>
                </FormControlSelectItem>
              </FormControlSelectContent>
            </FormControlSelect>
          </div>
          <Button onClick={() => onCreateDialogOpenChange(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0392_new_thread_66826f91')}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {threads.length === 0 ? (
          <Card>
            <CardContent align="center" className="py-12">
              <MessageSquare className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground mb-4">
                {translateText(
                  'generated.inline.0393_no_discussion_threads_yet_start_a_conversatio_e634e88d'
                )}
              </p>
              <Button onClick={() => onCreateDialogOpenChange(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {translateText('generated.inline.0394_create_first_thread_e26d65a7')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {threads.map((thread: any) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                userId={userId}
                amendmentId={amendmentId}
                amendmentTitle={amendmentTitle}
                senderName={authUserEmail}
                onCreateComment={onCreateComment}
                onVoteThread={onVoteThread}
                onVoteComment={onVoteComment}
              />
            ))}
            {hasMore && <div ref={loadMoreRef} className="h-px" />}
          </>
        )}
      </div>

      <CreateThreadDialog
        amendmentId={amendmentId}
        userId={userId}
        amendmentTitle={amendmentTitle}
        senderName={authUserEmail}
        open={isCreateDialogOpen}
        onOpenChange={onCreateDialogOpenChange}
        onCreateThread={onCreateThread}
      />
    </PageWrapper>
  );
}
