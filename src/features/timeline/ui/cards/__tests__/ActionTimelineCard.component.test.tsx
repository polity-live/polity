/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseProps: undefined as Record<string, any> | undefined,
  shareProps: undefined as Record<string, any> | undefined,
  translate: (key: string, params?: Record<string, any>) => {
    if (key === 'features.timeline.cards.action.actorPair') {
      return `${params?.first} and ${params?.second}`;
    }
    if (key === 'features.timeline.cards.action.actorOthers') {
      return `${params?.first} and ${params?.count} others`;
    }
    return params?.defaultValue ?? key;
  },
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme-${key}`,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: mocks.translate,
  }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, onClick, ...props }: any) => (
    <a href={to} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: () => null,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, any>) => {
    mocks.shareProps = props;
    return <button type="button">Share</button>;
  },
}));
vi.mock('../../../constants/content-type-config', () => ({
  getContentTypeGradient: () => 'action-gradient',
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  TimelineCardActionButton: ({ label, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}));

import {
  ActionTimelineCard,
  formatActionActorNames,
  getActionActorInitials,
  type ActionTimelineCardProps,
  type ActionType,
} from '../ActionTimelineCard';

const actor = (id: string, name: string) => ({ id, name });
const baseAction: ActionTimelineCardProps['action'] = {
  id: 'action-1',
  type: 'group_created',
  actors: [],
  timestamp: '2026-08-09T10:00:00Z',
};

afterEach(() => {
  cleanup();
  mocks.baseProps = undefined;
  mocks.shareProps = undefined;
});

describe('action actor formatters', () => {
  it('formats initials and every actor-count phrase', () => {
    expect(getActionActorInitials('Ada')).toBe('A');
    expect(getActionActorInitials('Ada Lovelace Byron')).toBe('AL');
    expect(formatActionActorNames([], mocks.translate)).toBe('');
    expect(formatActionActorNames([actor('1', 'Ada')], mocks.translate)).toBe('Ada');
    expect(formatActionActorNames([actor('1', 'Ada'), actor('2', 'Bo')], mocks.translate)).toBe(
      'Ada and Bo'
    );
    expect(
      formatActionActorNames(
        [actor('1', 'Ada'), actor('2', 'Bo'), actor('3', 'Cy')],
        mocks.translate
      )
    ).toBe('Ada and 2 others');
  });
});

describe('ActionTimelineCard', () => {
  it.each([
    'user_joined_group',
    'vote_started',
    'event_going_live',
    'collaborator_added',
    'amendment_forwarded',
    'group_created',
    'election_started',
    'member_promoted',
    'amendment_passed',
    'amendment_rejected',
  ] as ActionType[])('renders the %s action message', type => {
    render(
      <ActionTimelineCard
        action={{
          ...baseAction,
          type,
          actors: [actor('1', 'Ada')],
          metadata: type === 'member_promoted' ? { roleName: 'moderator' } : undefined,
        }}
      />
    );
    expect(document.body.textContent).not.toBe('');
    expect(screen.getByText('Share')).toBeTruthy();
  });

  it('renders rich actor, entity, forwarding, detail, and target-share state', () => {
    const onViewDetails = vi.fn();
    render(
      <ActionTimelineCard
        className="custom"
        onViewDetails={onViewDetails}
        action={{
          ...baseAction,
          type: 'amendment_forwarded',
          timestamp: new Date('2026-08-09T10:00:00Z'),
          actors: [actor('1', 'Ada'), actor('2', 'Bo'), actor('3', 'Cy'), actor('4', 'Dee')],
          sourceEntity: { id: 'source', type: 'amendment', name: 'Draft', url: '/draft' },
          targetEntity: { id: 'target', type: 'group', name: 'Council', url: '/council' },
          metadata: { fromGroup: 'Alpha', toGroup: 'Beta' },
        }}
      />
    );
    expect(mocks.baseProps).toMatchObject({ className: 'custom', href: '/draft' });
    expect(document.body.textContent).toContain('+1');
    expect(document.body.textContent).toContain('features.timeline.cards.action.from Alpha');
    expect(document.body.textContent).toContain('features.timeline.cards.action.to Beta');
    expect(screen.getAllByRole('link')).toHaveLength(2);
    fireEvent.click(screen.getByText('features.timeline.cards.viewDetails'));
    expect(onViewDetails).toHaveBeenCalledOnce();
    expect(mocks.shareProps).toMatchObject({ url: '/council', title: 'Draft' });
  });

  it('uses source, timeline, and translated title fallbacks for sharing', () => {
    render(
      <ActionTimelineCard
        action={{
          ...baseAction,
          sourceEntity: { id: 'source', type: 'event', name: 'Assembly', url: '/assembly' },
        }}
      />
    );
    expect(mocks.shareProps).toMatchObject({ url: '/assembly', title: 'Assembly' });
    cleanup();

    render(<ActionTimelineCard action={baseAction} />);
    expect(mocks.shareProps).toMatchObject({
      url: '/timeline',
      title: 'features.timeline.contentTypes.action',
    });
  });

  it('uses the admin role fallback and safe configuration for unexpected runtime actions', () => {
    render(
      <ActionTimelineCard
        action={{
          ...baseAction,
          type: 'member_promoted',
          actors: [actor('1', 'Ada')],
          metadata: {},
        }}
      />
    );
    expect(document.body.textContent).toContain('promoted to admin');
    cleanup();

    render(<ActionTimelineCard action={{ ...baseAction, type: 'runtime' as any }} />);
    expect(document.body.textContent).toContain('Share');
  });
});
