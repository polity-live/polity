/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Info } from 'lucide-react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, search: _search, to, ...props }: any) => (
    <a href={typeof to === 'string' ? to : ''} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    language: 'en',
    t: (_key: string, values?: { defaultValue?: string } | string) =>
      typeof values === 'string' ? values : (values?.defaultValue ?? _key),
  }),
}));

vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: ({ 'data-action-id': actionId }: { 'data-action-id'?: string }) => (
    <button data-action-id={actionId} type="button">
      Share
    </button>
  ),
}));

vi.mock('@/features/shared/hooks/useCurrencyConversion', () => ({
  useCurrencyConversion: () => ({
    conversion: {
      convertedAmount: 11,
      rate: 1.1,
      rateDate: '2026-08-01',
      cacheStatus: 'fresh',
    },
    isLoading: false,
    targetCurrency: 'USD',
  }),
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: () => <div data-testid="hashtags" />,
}));

import { FocusRing, SkipToTimeline, TimelineRegion } from '../AccessibilityComponents';
import { MasonryGridView } from '../MasonryGridView';
import { ActionBar } from '../cards/ActionBar';
import { ActionTimelineCard } from '../cards/ActionTimelineCard';
import { ImageTimelineCard } from '../cards/ImageTimelineCard';
import { MeetupTimelineCard } from '../cards/MeetupTimelineCard';
import { PaymentTimelineCard } from '../cards/PaymentTimelineCard';
import { CommentPreview } from '../cards/QuickComment';
import { QuickCommentView } from '../cards/QuickCommentView';
import { ReasonTooltipView } from '../cards/ReasonTooltipView';
import { StatementTimelineCard } from '../cards/StatementTimelineCard';
import { UserTimelineCardView } from '../cards/UserTimelineCardView';
import { VideoTimelineCardView } from '../cards/VideoTimelineCardView';
import { VoteTimelineCard } from '../cards/VoteTimelineCard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const t = (key: string, values?: { defaultValue?: string } | string) =>
  typeof values === 'string' ? values : (values?.defaultValue ?? key);

function action(root: ParentNode, id: string) {
  const element = root.querySelector<HTMLElement>(`[data-action-id="${id}"]`);
  if (!element) throw new Error(`Missing action ${id}`);
  return element;
}

describe('timeline peripheral interaction contracts', () => {
  it('renders keyboard landmarks and every masonry state', () => {
    const labels = { title: 'Nothing here', hint: 'Try again', discoverContent: 'Discover' };
    const ref = { current: null };
    const { rerender } = render(
      <>
        <FocusRing className="custom">focusable</FocusRing>
        <SkipToTimeline />
        <TimelineRegion>content</TimelineRegion>
        <MasonryGridView
          items={[]}
          renderItem={() => null}
          keyExtractor={String}
          isLoading
          hasMore={false}
          gap="sm"
          itemMotion="none"
          loadMoreTriggerRef={ref}
          skeletonIndexes={[0, 1]}
          emptyLabels={labels}
        />
      </>
    );

    expect(action(document, 'timeline.accessibility.skip-content').getAttribute('href')).toBe(
      '#timeline-content'
    );

    rerender(
      <MasonryGridView
        items={['one']}
        renderItem={item => <span>{item}</span>}
        keyExtractor={String}
        isLoading
        hasMore
        onLoadMore={vi.fn()}
        gap="lg"
        itemMotion="reveal"
        loadMoreTriggerRef={ref}
        skeletonIndexes={[7]}
        emptyLabels={labels}
      />
    );
    expect(screen.getByText('one')).toBeTruthy();

    rerender(
      <MasonryGridView
        items={[]}
        renderItem={() => null}
        keyExtractor={String}
        isLoading={false}
        hasMore={false}
        gap="md"
        itemMotion="none"
        loadMoreTriggerRef={ref}
        skeletonIndexes={[]}
        emptyLabels={labels}
      />
    );
    expect(action(document, 'timeline.empty.search.open').getAttribute('href')).toBe('/search');
  });

  it('opens action entities, details, and sharing without triggering the card', () => {
    const onViewDetails = vi.fn();
    const { container } = render(
      <ActionTimelineCard
        action={{
          id: 'action-1',
          type: 'amendment_forwarded',
          actors: [
            { id: '1', name: 'Ada Lovelace' },
            { id: '2', name: 'Grace Hopper' },
            { id: '3', name: 'Katherine Johnson' },
            { id: '4', name: 'Dorothy Vaughan' },
          ],
          sourceEntity: { id: 'group-1', type: 'group', name: 'Source', url: '/group/1' },
          targetEntity: {
            id: 'amendment-1',
            type: 'amendment',
            name: 'Target',
            url: '/amendment/1',
          },
          timestamp: new Date(),
          metadata: { fromGroup: 'Source', toGroup: 'Target' },
        }}
        onViewDetails={onViewDetails}
      />
    );

    fireEvent.click(action(container, 'timeline.action.source.open'));
    fireEvent.click(action(container, 'timeline.action.target.open'));
    fireEvent.click(action(container, 'timeline.action.details.open'));
    fireEvent.click(action(container, 'timeline.action.share'));
    expect(onViewDetails).toHaveBeenCalledOnce();
  });

  it('opens an image preview with pointer, Enter, and Space', () => {
    const onImageClick = vi.fn();
    const { container } = render(
      <ImageTimelineCard
        image={{
          id: 'image-1',
          imageUrl: '/photo.jpg',
          caption: 'Assembly',
          location: 'Berlin',
          likes: 1200,
          comments: 4,
          authorName: 'Ada',
          sourceType: 'group',
          sourceId: 'group-1',
        }}
        onImageClick={onImageClick}
      />
    );
    const preview = action(container, 'timeline.image.preview.open');
    fireEvent.click(preview);
    fireEvent.keyDown(preview, { key: 'Enter' });
    fireEvent.keyDown(preview, { key: ' ' });
    fireEvent.keyDown(preview, { key: 'Escape' });
    fireEvent.click(action(container, 'timeline.image.share'));
    expect(onImageClick).toHaveBeenCalledTimes(3);
  });

  it('executes booking, cancellation, deletion, and online-link meetup actions', () => {
    const now = Date.now();
    const callbacks = { onBook: vi.fn(), onCancel: vi.fn(), onDelete: vi.fn() };
    const baseMeetup = {
      id: 'meetup-1',
      title: 'Working session',
      description: 'Discuss the proposal',
      startDate: now + 86_400_000,
      endDate: now + 90_000_000,
      meetingType: 'public-meeting',
      location: 'Berlin',
      onlineUrl: 'https://example.test/meeting',
      bookingCount: 1,
      maxBookings: 4,
      isBookable: true,
      participants: [{ id: 'user-1', name: 'Ada' }],
    };
    const { container, rerender } = render(
      <MeetupTimelineCard meetup={baseMeetup} onBook={callbacks.onBook} />
    );
    fireEvent.click(action(container, 'timeline.meetup.booking.create'));
    fireEvent.click(action(container, 'timeline.meetup.online.open'));

    rerender(
      <MeetupTimelineCard
        meetup={{ ...baseMeetup, isBookedByMe: true }}
        onCancel={callbacks.onCancel}
      />
    );
    fireEvent.click(action(container, 'timeline.meetup.booking.cancel'));

    rerender(
      <MeetupTimelineCard meetup={{ ...baseMeetup, isOwner: true }} onDelete={callbacks.onDelete} />
    );
    fireEvent.click(action(container, 'timeline.meetup.delete'));
    expect(callbacks.onBook).toHaveBeenCalledOnce();
    expect(callbacks.onCancel).toHaveBeenCalledOnce();
    expect(callbacks.onDelete).toHaveBeenCalledOnce();
  });

  it('toggles indication results and exposes vote navigation and sharing', () => {
    const { container } = render(
      <VoteTimelineCard
        vote={{
          id: 'vote-1',
          amendmentId: 'amendment-1',
          amendmentTitle: 'Budget amendment',
          question: 'Approve?',
          status: 'passed',
          supportPercentage: 75,
          supportCount: 3,
          opposeCount: 1,
          abstainCount: 1,
          totalVoters: 8,
          votedCount: 5,
          trend: 'up',
          trendPercentage: 4,
          hasVoted: true,
          userVote: 'support',
          agendaEventId: 'event-1',
          agendaItemId: 'agenda-1',
          indicationSupportPercentage: 60,
          indicationSupportCount: 3,
          indicationOpposeCount: 2,
          indicationAbstainCount: 1,
        }}
      />
    );
    const toggle = action(container, 'timeline.vote.indication-results.toggle');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    fireEvent.click(action(container, 'timeline.vote.open'));
    fireEvent.click(action(container, 'timeline.vote.share'));
    expect(toggle).toBeTruthy();
  });

  it('dispatches alternative action-bar states and comment-preview effects', () => {
    const onReact = vi.fn();
    const onViewAll = vi.fn();
    const { container } = render(
      <>
        <ActionBar
          entityId="image-1"
          entityType="image"
          isBookmarked
          userReaction="support"
          reactionCounts={{ support: 2, oppose: 0, interested: 0 }}
          commentCount={2}
          showReactions={false}
          onReact={onReact}
        />
        <CommentPreview
          comments={[
            { id: '1', author: 'Ada', content: 'One', createdAt: 1 },
            { id: '2', author: 'Grace', content: 'Two', createdAt: 2 },
          ]}
          maxComments={1}
          onViewAll={onViewAll}
        />
      </>
    );
    fireEvent.click(action(container, 'timeline.action-bar.reaction.like'));
    fireEvent.click(action(container, 'timeline.quick-comment.all.open'));
    expect(onReact).toHaveBeenCalledWith('support');
    expect(onViewAll).toHaveBeenCalledOnce();
  });

  it('renders the unliked action state and submitting quick-comment state', () => {
    const onReact = vi.fn();
    const handleCancel = vi.fn();
    const handleSubmit = vi.fn();
    const { container } = render(
      <>
        <ActionBar
          entityId="image-2"
          entityType="image"
          userReaction={null}
          reactionCounts={{ support: 0, oppose: 0, interested: 0 }}
          commentCount={0}
          showReactions={false}
          onReact={onReact}
        />
        <QuickCommentView
          className=""
          comment="Ready"
          commentCount={0}
          compact={false}
          defaultExpanded
          defaultPlaceholder="Comment"
          handleBlur={vi.fn()}
          handleCancel={handleCancel}
          handleFocus={vi.fn()}
          handleKeyDown={vi.fn()}
          handleSubmit={handleSubmit}
          inputRef={{ current: null }}
          isExpanded
          isSubmitting
          onSubmit={vi.fn()}
          placeholder=""
          setComment={vi.fn()}
          setIsExpanded={vi.fn()}
          setIsSubmitting={vi.fn()}
          t={t}
        />
      </>
    );

    fireEvent.click(action(container, 'timeline.action-bar.reaction.like'));
    expect(onReact).toHaveBeenCalledWith('support');
    const submit = action(container, 'timeline.quick-comment.submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect((action(container, 'timeline.quick-comment.cancel') as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('renders payment, statement, user, video, and reason actions', () => {
    const subscription = {
      isSubscribed: false,
      isLoading: false,
      subscriberCount: 3,
      toggleSubscribe: vi.fn(),
    };
    const onFollow = vi.fn();
    const onMessage = vi.fn();
    const setPlayerOpen = vi.fn();
    const onPlay = vi.fn();
    const onTriggerClick = vi.fn();
    const { container } = render(
      <>
        <PaymentTimelineCard
          payment={{
            id: 'payment-1',
            label: 'Donation',
            amount: 10,
            currency: 'EUR',
            direction: 'income',
            createdAt: '2026-08-01',
          }}
        />
        <StatementTimelineCard
          statement={{ id: 'statement-1', content: 'A statement', authorName: 'Ada' }}
        />
        <UserTimelineCardView
          user={{ id: 'user-1', name: 'Ada', bio: 'Engineer' }}
          onFollow={onFollow}
          onMessage={onMessage}
          actions={undefined}
          href={undefined}
          className=""
          t={t}
          subscription={subscription}
          amendmentStyle={undefined}
          location="Berlin"
          initials="AL"
        />
        <VideoTimelineCardView
          video={{ id: 'video-1', title: 'Hearing', thumbnailUrl: '/video.jpg' }}
          onPlay={onPlay}
          className=""
          t={t}
          playerOpen={false}
          setPlayerOpen={setPlayerOpen}
          sourceHref={undefined}
          amendmentHref={undefined}
          targetHref="/statement/statement-1"
        />
        <ReasonTooltipView
          config={{ Icon: Info, colorClass: 'text-info' } as any}
          open={false}
          reasonText="Nearby"
          whySeeingLabel="Why?"
          onOpenChange={vi.fn()}
          onTriggerClick={onTriggerClick}
        />
      </>
    );

    fireEvent.click(action(container, 'timeline.payment.exchange-source.open'));
    fireEvent.click(action(container, 'timeline.statement.share'));
    fireEvent.click(action(container, 'timeline.user.subscription.toggle'));
    fireEvent.click(action(container, 'timeline.user.message.open'));
    fireEvent.click(action(container, 'timeline.user.share'));
    const video = action(container, 'timeline.video.play');
    fireEvent.keyDown(video, { key: 'Enter' });
    fireEvent.keyDown(video, { key: ' ' });
    fireEvent.keyDown(video, { key: 'Escape' });
    fireEvent.click(action(container, 'timeline.reason.open'));
    expect(subscription.toggleSubscribe).toHaveBeenCalledOnce();
    expect(onFollow).toHaveBeenCalledOnce();
    expect(onMessage).toHaveBeenCalledOnce();
    expect(setPlayerOpen).toHaveBeenCalledTimes(2);
    expect(onPlay).toHaveBeenCalledTimes(2);
    expect(onTriggerClick).toHaveBeenCalledOnce();
  });
});
