/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MembershipStatusTable } from '../MembershipStatusTable';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
}));

afterEach(() => {
  cleanup();
});

function renderMembershipTable(
  entityKey: 'group' | 'event' | 'amendment' | 'blog',
  items: unknown[]
) {
  render(
    <MembershipStatusTable
      title="Active"
      description="Active rows"
      icon={Users}
      items={items as never}
      statusType="active"
      entityKey={entityKey}
      fallbackIcon={Users}
    />
  );
}

describe('MembershipStatusTable', () => {
  it('shows amendment role names instead of membership status fallbacks', () => {
    renderMembershipTable('amendment', [
      {
        id: 'collaboration-1',
        status: 'member',
        role: { id: 'role-collaborator', name: 'Collaborator' },
        amendment: { id: 'amendment-1', title: 'A1' },
        created_at: Date.now(),
      },
    ]);

    expect(screen.getByText('Collaborator')).toBeTruthy();
    expect(screen.queryByText('Member')).toBeNull();
  });

  it('shows group and event roles from role link relations', () => {
    render(
      <>
        <MembershipStatusTable
          title="Groups"
          description="Group rows"
          icon={Users}
          items={
            [
              {
                id: 'membership-1',
                status: 'member',
                membership_roles: [{ role: { id: 'role-treasurer', name: 'Treasurer' } }],
                group: { id: 'group-1', name: 'Finance Group' },
                created_at: Date.now(),
              },
            ] as never
          }
          statusType="active"
          entityKey="group"
          fallbackIcon={Users}
        />
        <MembershipStatusTable
          title="Events"
          description="Event rows"
          icon={Users}
          items={
            [
              {
                id: 'participant-1',
                status: 'member',
                participant_roles: [{ role: { id: 'role-organizer', name: 'Organizer' } }],
                event: { id: 'event-1', title: 'Assembly' },
                created_at: Date.now(),
              },
            ] as never
          }
          statusType="active"
          entityKey="event"
          fallbackIcon={Users}
        />
      </>
    );

    expect(screen.getByText('Treasurer')).toBeTruthy();
    expect(screen.getByText('Organizer')).toBeTruthy();
  });

  it('uses entity-specific fallback labels only when no role is assigned', () => {
    renderMembershipTable('event', [
      {
        id: 'participant-1',
        status: 'member',
        event: { id: 'event-1', title: 'Assembly' },
        created_at: Date.now(),
      },
    ]);

    expect(screen.getByText('Participant')).toBeTruthy();
  });

  it('requires confirmation before leaving an active membership', () => {
    const onLeave = vi.fn();
    render(
      <MembershipStatusTable
        title="Groups"
        description="Group rows"
        icon={Users}
        items={
          [
            {
              id: 'membership-1',
              status: 'member',
              group: { id: 'group-1', name: 'Finance Group' },
              created_at: Date.now(),
            },
          ] as never
        }
        statusType="active"
        entityKey="group"
        fallbackIcon={Users}
        onLeave={onLeave}
      />
    );

    fireEvent.click(screen.getByText('generated.inline.1197_leave_7e3520a9'));
    expect(onLeave).not.toHaveBeenCalled();
    expect(screen.getByText('pages.user.memberships.confirmations.leaveTitle')).toBeTruthy();

    fireEvent.click(screen.getByText('pages.user.memberships.confirmations.leaveConfirm'));
    expect(onLeave).toHaveBeenCalledWith('membership-1');
  });

  it('requires confirmation before withdrawing a request', () => {
    const onWithdraw = vi.fn();
    render(
      <MembershipStatusTable
        title="Requested"
        description="Requested rows"
        icon={Users}
        items={
          [
            {
              id: 'request-1',
              status: 'requested',
              event: { id: 'event-1', title: 'Assembly' },
              created_at: Date.now(),
            },
          ] as never
        }
        statusType="requested"
        entityKey="event"
        fallbackIcon={Users}
        onWithdraw={onWithdraw}
      />
    );

    fireEvent.click(screen.getByText('generated.inline.1198_withdraw_request_898cc3e4'));
    expect(onWithdraw).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('pages.user.memberships.confirmations.withdrawConfirm'));
    expect(onWithdraw).toHaveBeenCalledWith('request-1');
  });
});
