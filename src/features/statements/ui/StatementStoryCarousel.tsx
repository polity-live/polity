'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import {
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  MessageSquare,
  Quote,
  Video,
  X,
} from 'lucide-react';

import { queries } from '@/zero/queries';
import {
  getStatementHeadline,
  isStatementExpired,
  type StatementMediaType,
} from '@/zero/statements/content';
import { useStatementDetail } from '@/features/statements/hooks/useStatementDetail';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { BadgeControl } from '@/features/shared/ui/status';
import { UserIdentityLink } from '@/features/shared/ui/UserIdentityLink';
import { Button } from '@/features/shared/ui/ui/button';
import { CommentThread } from '@/features/shared/ui/comments';
import { Dialog, DialogContent, DialogTitle } from '@/features/shared/ui/ui/dialog';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { VoteButtons } from '@/features/shared/ui/voting/VoteButtons';
import { cn } from '@/features/shared/utils/utils';
import { StatementMediaDisplay } from './StatementMediaDisplay';
import { StatementTextRenderer } from './StatementTextRenderer';

interface StatementCarouselRow {
  id: string;
  title?: string | null;
  text?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  media_type?: StatementMediaType | string | null;
  is_story?: boolean | null;
  expires_at?: number | null;
  created_at?: number | null;
  comment_count?: number | null;
  user?: {
    avatar?: string | null;
    first_name?: string | null;
    handle?: string | null;
    id?: string | null;
    last_name?: string | null;
  } | null;
  group?: {
    name?: string | null;
  } | null;
}

interface StatementStoryCarouselProps {
  className?: string;
  limit?: number;
  title?: string;
  userId?: string;
}

function getAuthorName(statement: StatementCarouselRow) {
  const user = statement.user;
  return user
    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.handle || 'Unknown'
    : 'Unknown';
}

function getMediaType(statement: StatementCarouselRow): StatementMediaType {
  if (statement.video_url) return 'video';
  if (statement.image_url) return 'image';
  return 'text';
}

function StatementStoryThumbnail({
  statement,
  active,
  onClick,
}: {
  statement: StatementCarouselRow;
  active: boolean;
  onClick: () => void;
}) {
  const headline = getStatementHeadline(statement);
  const mediaType = getMediaType(statement);
  const authorName = getAuthorName(statement);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group bg-card flex w-[8.5rem] shrink-0 flex-col gap-2 rounded-lg border p-2 text-left shadow-sm transition',
        'hover:border-primary/60 focus-visible:ring-ring/45 hover:shadow-md focus-visible:ring-3 focus-visible:outline-none',
        active && 'border-primary'
      )}
    >
      <div className="bg-muted relative aspect-[9/12] overflow-hidden rounded-md">
        {statement.image_url ? (
          <img src={statement.image_url} alt="" className="h-full w-full object-cover" />
        ) : statement.video_url ? (
          <div className="flex h-full w-full items-center justify-center bg-black text-white">
            <Video className="h-8 w-8" />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(160deg,var(--card),var(--muted))] p-3">
            <Quote className="text-primary h-6 w-6" />
            <p className="line-clamp-5 text-sm leading-tight font-semibold">{headline}</p>
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          {statement.is_story ? (
            <BadgeControl variant="secondary" className="bg-background/90 px-1.5 py-0 text-[10px]">
              24h
            </BadgeControl>
          ) : null}
          {mediaType === 'image' ? (
            <BadgeControl variant="secondary" className="bg-background/90 px-1.5 py-0">
              <ImageIcon className="h-3 w-3" />
            </BadgeControl>
          ) : mediaType === 'video' ? (
            <BadgeControl variant="secondary" className="bg-background/90 px-1.5 py-0">
              <Video className="h-3 w-3" />
            </BadgeControl>
          ) : null}
        </div>
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm leading-tight font-medium">{headline}</p>
        <p className="text-muted-foreground mt-1 truncate text-xs">
          {statement.group?.name ?? authorName}
        </p>
      </div>
    </button>
  );
}

function StatementStoryViewerContent({
  activeIndex,
  onActiveIndexChange,
  onClose,
  statements,
}: {
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
  statements: StatementCarouselRow[];
}) {
  const activeStatement = statements[activeIndex];
  const detail = useStatementDetail({ id: activeStatement.id });
  const { t } = useTranslation();
  const headline = getStatementHeadline(detail.statement ?? activeStatement);
  const authorName = getAuthorName(
    (detail.statement as StatementCarouselRow | null) ?? activeStatement
  );
  const authorId = detail.statement?.user?.id ?? activeStatement.user?.id;
  const authorAvatar = detail.statement?.user?.avatar ?? activeStatement.user?.avatar;
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < statements.length - 1;

  const goPrev = () => {
    if (canGoPrev) onActiveIndexChange(activeIndex - 1);
  };
  const goNext = () => {
    if (canGoNext) onActiveIndexChange(activeIndex + 1);
  };

  const { handlers } = useSwipeNavigation({
    canSwipePrev: canGoPrev,
    canSwipeNext: canGoNext,
    onSwipePrev: goPrev,
    onSwipeNext: goNext,
    keyboardMode: 'scoped',
  });

  return (
    <div
      className="bg-background text-foreground grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]"
      style={{ touchAction: 'pan-y' }}
      tabIndex={-1}
      {...handlers}
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserIdentityLink
            userId={authorId}
            avatarUrl={authorAvatar}
            name={authorName}
            fallbackLabel={authorName}
            avatarClassName="h-9 w-9"
            nameClassName="block truncate text-sm font-semibold"
            textContainerClassName="min-w-0"
            className="min-w-0 gap-3"
            secondary={
              <span className="text-muted-foreground block truncate text-xs">
                {detail.statement?.group?.name ?? activeStatement.group?.name ?? headline}
              </span>
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={goPrev}
            disabled={!canGoPrev}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={goNext}
            disabled={!canGoNext}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-h-0 items-center justify-center overflow-y-auto p-4 lg:p-8">
          {detail.isLoading ? (
            <StatementStoryDetailSkeleton label={t('features.statements.detail.loading')} />
          ) : !detail.statement || !detail.canAccess ? (
            <p className="text-muted-foreground text-sm">
              {t('features.statements.detail.notFound')}
            </p>
          ) : (
            <div className="w-full max-w-3xl space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl leading-tight font-semibold sm:text-3xl">{headline}</h2>
                {detail.statement.is_story ? (
                  <BadgeControl variant="secondary" className="text-xs">
                    24h
                  </BadgeControl>
                ) : null}
              </div>
              <StatementMediaDisplay
                imageUrl={detail.statement.image_url}
                videoUrl={detail.statement.video_url}
                className="mx-auto max-h-[62vh] [&_img]:max-h-[62vh] [&_img]:object-contain [&_video]:max-h-[62vh]"
              />
              {detail.statement.text ? (
                <div className="text-lg leading-relaxed">
                  <StatementTextRenderer text={detail.statement.text} />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <aside
          className="bg-card/60 min-h-0 overflow-y-auto border-t p-4 lg:border-t-0 lg:border-l"
          data-swipe-lock
        >
          {detail.statement ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <VoteButtons
                  upvotes={detail.computedUpvotes}
                  downvotes={detail.computedDownvotes}
                  userVote={detail.currentVoteValue}
                  onVote={detail.handleVote}
                />
                <div className="text-muted-foreground flex items-center gap-1 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  <span>{detail.computedCommentCount}</span>
                </div>
              </div>
              <CommentThread
                comments={detail.comments}
                currentUserId={detail.userId}
                onAddComment={detail.handleAddComment}
                onVote={detail.handleCommentVote}
                linkAuthors
                hideHeader={false}
              />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function StatementStoryDetailSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="w-full max-w-3xl space-y-5"
      data-slot="statement-story-detail-skeleton"
    >
      <span className="sr-only">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <Skeleton className="mx-auto aspect-[4/3] max-h-[62vh] w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function StatementStoryCarousel({
  className,
  limit = 24,
  title,
  userId,
}: StatementStoryCarouselProps) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const queryArgs = useMemo(() => ({ user_id: userId ?? null, now, limit }), [limit, now, userId]);
  const [rows] = useQuery(queries.statements.carousel(queryArgs));
  useEffect(() => {
    const nextExpiry = ((rows ?? []) as unknown as StatementCarouselRow[])
      .map(statement => statement.expires_at)
      .filter((expiry): expiry is number => typeof expiry === 'number' && expiry > now)
      .sort((left, right) => left - right)[0];

    if (nextExpiry == null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - now + 1));
    return () => window.clearTimeout(timer);
  }, [now, rows]);
  const statements = useMemo(
    () =>
      ((rows ?? []) as unknown as StatementCarouselRow[]).filter(
        statement => !isStatementExpired(statement)
      ),
    [rows]
  );

  if (statements.length === 0) {
    return null;
  }

  const activeStatement = activeIndex == null ? null : statements[activeIndex];

  return (
    <section className={cn('space-y-3', className)} data-testid="statement-story-carousel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {title ?? t('features.statements.carousel.title', 'Statements')}
        </h2>
        <BadgeControl variant="outline" shape="rounded" className="text-xs">
          {statements.length}
        </BadgeControl>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {statements.map((statement, index) => (
          <StatementStoryThumbnail
            key={statement.id}
            statement={statement}
            active={activeIndex === index}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>

      <Dialog open={activeStatement != null} onOpenChange={open => !open && setActiveIndex(null)}>
        <DialogContent
          className="bg-background !fixed !inset-0 !top-0 !left-0 !h-dvh !max-h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-hidden !rounded-none !border-0 !p-0"
          showCloseButton={false}
          style={{
            inset: 0,
            width: '100vw',
            maxWidth: 'none',
            height: '100dvh',
            maxHeight: '100dvh',
            transform: 'none',
          }}
        >
          <DialogTitle className="sr-only">
            {t('features.statements.carousel.viewerTitle', 'Statement')}
          </DialogTitle>
          {activeStatement ? (
            <StatementStoryViewerContent
              activeIndex={activeIndex ?? 0}
              onActiveIndexChange={setActiveIndex}
              onClose={() => setActiveIndex(null)}
              statements={statements}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
