/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: () => 'theme',
  getEntityGradientClasses: () => 'gradient',
  getEntityToneClasses: () => ({ text: 'text', gradient: 'gradient', badge: 'badge' }),
  getHashtagToneClasses: () => ({ badge: 'hashtag' }),
  getMotionPreset: () => 'motion',
  getSemanticToneClasses: () => ({ text: 'text' }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
  getEditingModeOption: (mode: string) => ({ label: mode }),
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: (props: any) => <img {...props} />,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, asChild, loading: _loading, loadingLabel: _label, ...props }: any) =>
    asChild ? (
      <>{children}</>
    ) : (
      <button type="button" {...props}>
        {children}
      </button>
    ),
}));
vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  PopoverContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/progress', () => ({ Progress: () => <div>progress</div> }));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <span>{children}</span>,
  TooltipTrigger: ({ children }: any) => <span>{children}</span>,
  TooltipContent: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params: _params, search: _search, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">share</button>,
}));
vi.mock('@/features/shared/ui/hashtags', () => ({ HashtagDisplay: () => <span>hashtags</span> }));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: ({ children }: any) => <article>{children}</article>,
  TimelineCardHeader: ({ children, title, subtitle, badge }: any) => (
    <header>
      {title}
      {subtitle}
      {badge}
      {children}
    </header>
  ),
  TimelineCardContent: ({ children }: any) => <main>{children}</main>,
  TimelineCardActions: ({ children }: any) => <footer>{children}</footer>,
  TimelineCardActionButton: ({ label, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
  TimelineCardBadge: ({ label }: any) => <span>{label}</span>,
}));

import { AmendmentTimelineCardView } from '../AmendmentTimelineCardView';
import { BlogTimelineCardView } from '../BlogTimelineCardView';
import { ElectionTimelineCard } from '../ElectionTimelineCard';
import { EventTimelineCardView } from '../EventTimelineCardView';
import { GroupTimelineCardView } from '../GroupTimelineCardView';
import { TodoTimelineCardView } from '../TodoTimelineCardView';
import { UserTimelineCardView } from '../UserTimelineCardView';
import { VideoTimelineCardView } from '../VideoTimelineCardView';

const fn = vi.fn;
const t = (key: string) => key;
const Icon = () => <span>icon</span>;
const subscription = () => ({ isSubscribed: false, isLoading: false, toggleSubscribe: fn() });

function clickEveryInteractiveWrapper(container: HTMLElement) {
  for (const element of Array.from(container.querySelectorAll('a,button,div'))) {
    fireEvent.click(element);
  }
}

afterEach(cleanup);

describe('timeline card DOM callback contracts', () => {
  it('executes amendment collaboration, navigation, hashtag, and share wrappers', () => {
    const { container } = render(
      <AmendmentTimelineCardView
        {...({
          amendment: { id: 'a', title: 'A', hashtags: [{ tag: 'x' }] },
          t,
          collaborationOpen: true,
          setCollaborationOpen: fn(),
          collaboration: { isLoading: false, leaveCollaboration: fn() },
          subscription: subscription(),
          amendmentDescription: 'description',
          statusConfig: { variant: 'outline' },
          statusLabel: 'Open',
          isVoting: false,
          isCompleted: false,
          isCollaborator: true,
          isInvited: false,
          hasRequested: false,
          getCollaborationLabel: () => 'label',
          getCollaborationVariant: () => 'outline',
          CollaborationIcon: Icon,
          stats: [],
        } as any)}
      />
    );
    clickEveryInteractiveWrapper(container);
    expect(container.textContent).toContain('hashtags');
  });

  it('executes both blog title layouts plus hashtag and share wrappers', () => {
    for (const coverImageUrl of [undefined, '/cover.png']) {
      const { container, unmount } = render(
        <BlogTimelineCardView
          {...({
            blog: { id: 'b', title: 'Blog', coverImageUrl, hashtags: [{ tag: 'x' }] },
            t,
            subscription: subscription(),
            blogUrl: '/blog/b',
            stats: [],
          } as any)}
        />
      );
      clickEveryInteractiveWrapper(container);
      unmount();
    }
  });

  it('executes event participation, hashtag, and share wrappers', () => {
    const { container } = render(
      <EventTimelineCardView
        {...({
          event: { id: 'e', title: 'Event', hashtags: [{ tag: 'x' }] },
          t,
          rsvpOpen: true,
          setRsvpOpen: fn(),
          participation: { isLoading: false, leaveEvent: fn() },
          subscription: subscription(),
          day: '1',
          month: 'JAN',
          time: '10:00',
          eventTimeStatus: 'upcoming',
          eventHref: '/event/e',
          isParticipant: true,
          isInvited: false,
          hasRequested: false,
          hasParticipationRelationship: true,
          getRsvpLabel: () => 'RSVP',
          getRsvpVariant: () => 'outline',
          stats: [],
        } as any)}
      />
    );
    clickEveryInteractiveWrapper(container);
    expect(container.textContent).toContain('hashtags');
  });

  it('executes group membership, hashtag, and share wrappers', () => {
    const { container } = render(
      <GroupTimelineCardView
        {...({
          group: { id: 'g', name: 'Group' },
          t,
          membershipOpen: true,
          setMembershipOpen: fn(),
          membership: { isLoading: false, leaveGroup: fn() },
          subscription: subscription(),
          groupHashtags: [{ tag: 'x' }],
          groupDescription: 'description',
          isMember: true,
          isInvited: false,
          hasRequested: false,
          requestMembershipDisabled: false,
          getMembershipLabel: () => 'member',
          getMembershipVariant: () => 'outline',
          MembershipIcon: Icon,
          stats: [],
        } as any)}
      />
    );
    clickEveryInteractiveWrapper(container);
    expect(container.textContent).toContain('hashtags');
  });

  it('executes todo status and share wrappers', () => {
    const { container } = render(
      <TodoTimelineCardView
        {...({
          todo: { id: 'todo', title: 'Todo', archived: false },
          canManageTodos: true,
          showStatusAction: true,
          urgency: null,
          assignmentsCount: 0,
          isAssignedToMe: false,
          currentStatus: 'pending',
          statusLabels: {
            pending: 'pending',
            in_progress: 'in progress',
            completed: 'completed',
            cancelled: 'cancelled',
          },
          statusOpen: true,
          onStatusOpenChange: fn(),
          onStatusUpdate: fn(async () => undefined),
          isStatusUpdating: false,
          assigning: false,
          onAssignToMe: fn(async () => undefined),
          labels: { progress: 'progress', assignedToMe: 'mine', assignToMe: 'assign' },
        } as any)}
      />
    );
    clickEveryInteractiveWrapper(container);
    expect(container.textContent).toContain('share');
  });

  it('executes user hashtag and video navigation/play/share wrappers', () => {
    const user = render(
      <UserTimelineCardView
        {...({
          user: { id: 'u', name: 'User', hashtags: [{ tag: 'x' }] },
          t,
          subscription: subscription(),
          initials: 'U',
        } as any)}
      />
    );
    clickEveryInteractiveWrapper(user.container);
    user.unmount();

    const video = render(
      <VideoTimelineCardView
        {...({
          video: { id: 'v', title: 'Video' },
          t,
          playerOpen: false,
          setPlayerOpen: fn(),
          targetHref: '/video/v',
          onPlay: fn(),
        } as any)}
      />
    );
    clickEveryInteractiveWrapper(video.container);
    expect(video.container.textContent).toContain('share');
  });

  it('executes the election share wrapper', () => {
    const { container } = render(
      <ElectionTimelineCard
        election={{
          id: 'election',
          title: 'Election',
          roleName: 'Chair',
          status: 'closed',
          candidates: [],
          totalCandidates: 0,
        }}
      />
    );
    clickEveryInteractiveWrapper(container);
    expect(container.textContent).toContain('share');
  });
});
