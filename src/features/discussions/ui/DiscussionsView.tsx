import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import { PageWrapper } from '@/layout/page-wrapper';
import { ArrowLeft, MessageSquare, Plus, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { useDiscussions } from '../hooks/useDiscussions';
import { useDiscussionMutations } from '../hooks/useDiscussionMutations';
import { useVotingMutations } from '@/features/votes/hooks/useVotingMutations';
import { ThreadCard } from './ThreadCard';
import { CreateThreadDialog } from './CreateThreadDialog';
import { useInfiniteScroll } from '@/features/shared/hooks/useInfiniteScroll';
import { useAuth } from '@/providers/auth-provider';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface DiscussionsViewProps {
  amendmentId: string;
  userId?: string;
}

export function DiscussionsView({ amendmentId, userId }: DiscussionsViewProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'votes' | 'time'>('votes');
  const { user: authUser } = useAuth();

  const { amendment, threads, isLoading, hasMore, loadMore } = useDiscussions(amendmentId, sortBy);
  const { createThread, createComment } = useDiscussionMutations();
  const { voteOnThread, voteOnComment } = useVotingMutations();

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMore,
  });

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="py-12 text-center">
          {translateText('generated.inline.0386_loading_discussions_8b32b1c7')}
        </div>
      </PageWrapper>
    );
  }

  if (!amendment) {
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
      {/* Back button */}
      <div className="mb-6">
        <Link to="/amendment/$id" params={{ id: amendmentId }}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0284_back_to_amendment_7273f2de')}
          </Button>
        </Link>
      </div>

      {/* Header */}
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
          {/* Sort selector */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {translateText('generated.inline.0389_sort_by_9bb640e5')}
            </span>
            <Select value={sortBy} onValueChange={(value: 'votes' | 'time') => setSortBy(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="votes">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>{translateText('generated.inline.0390_top_voted_3ecc2d00')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="time">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{translateText('generated.inline.0391_newest_first_a40bb555')}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0392_new_thread_66826f91')}
          </Button>
        </div>
      </div>

      {/* Threads List */}
      <div className="space-y-6">
        {threads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground mb-4">
                {translateText(
                  'generated.inline.0393_no_discussion_threads_yet_start_a_conversatio_e634e88d'
                )}
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {translateText('generated.inline.0394_create_first_thread_e26d65a7')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {threads.map(thread => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                userId={userId}
                amendmentId={amendmentId}
                amendmentTitle={amendment?.title ?? undefined}
                senderName={authUser?.email ?? undefined}
                onCreateComment={createComment}
                onVoteThread={voteOnThread}
                onVoteComment={voteOnComment}
              />
            ))}
            {hasMore && <div ref={loadMoreRef} className="h-px" />}
          </>
        )}
      </div>

      {/* Create Thread Dialog */}
      <CreateThreadDialog
        amendmentId={amendmentId}
        userId={userId}
        amendmentTitle={amendment?.title ?? undefined}
        senderName={authUser?.email ?? undefined}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateThread={createThread}
      />
    </PageWrapper>
  );
}
