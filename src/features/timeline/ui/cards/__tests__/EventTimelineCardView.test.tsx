/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">Share</button>,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: () => <div data-testid="hashtags" />,
}));

import { EventTimelineCardView } from '../EventTimelineCardView';

afterEach(cleanup);

describe('EventTimelineCardView', () => {
  it('uses event entity color tokens on the card header and type badge', () => {
    const { container } = render(
      <EventTimelineCardView
        event={{ id: 'event-1', title: 'Assembly', startDate: new Date() }}
        href={undefined}
        onSelect={undefined}
        onRequestParticipation={undefined}
        onLeave={undefined}
        onAcceptInvitation={undefined}
        onWithdrawRequest={undefined}
        onToggleSubscription={undefined}
        isParticipationLoading={false}
        isSubscriptionLoading={false}
        className=""
        t={(key: string) =>
          key === 'features.timeline.contentTypes.event'
            ? 'Event'
            : key === 'features.timeline.cards.rsvp'
              ? 'RSVP'
              : key
        }
        rsvpOpen={false}
        setRsvpOpen={vi.fn()}
        participation={{
          isLoading: false,
          isParticipant: false,
          isInvited: false,
          hasRequested: false,
          participantCount: 0,
        }}
        subscription={{ isLoading: false, isSubscribed: false }}
        startDate={new Date()}
        day="15"
        month="JUN"
        time="2:00 PM"
        eventTimeStatus="upcoming"
        dateLabel={null}
        locationDisplay={null}
        eventStyle={null}
        eventHref={undefined}
        eventDescription=""
        eventSubtitle={undefined}
        eventSubtitleHref={undefined}
        resolvedParticipationStatus={null}
        isParticipant={false}
        isInvited={false}
        hasRequested={false}
        hasParticipationRelationship={false}
        getRsvpLabel={() => 'RSVP'}
        getRsvpVariant={() => 'default'}
        stats={[]}
      />
    );

    const header = container.querySelector('[data-timeline-card-header]');
    const dateChip = container.querySelector('[data-slot="event-date-chip"]');

    expect(header?.className).toContain('--entity-event-bg');
    expect(header?.className).toContain('--entity-event-border');
    expect(header?.className).not.toContain('bg-gradient');
    expect(dateChip?.className).toContain('--entity-event-bg');
    expect(dateChip?.className).toContain('--entity-event-border');
    expect(container.textContent).toContain('Event');
    expect(container.querySelector('[data-slot="badge-control"]')?.className).toContain(
      '--entity-event-bg'
    );
  });
});
