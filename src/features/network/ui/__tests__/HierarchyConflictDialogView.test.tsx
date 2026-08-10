/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HierarchyConflictDialogView } from '../HierarchyConflictDialogView';

vi.mock('@/features/search/ui/UserSearchCard', () => ({
  UserSearchCard: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

vi.mock('@/features/groups/ui/GroupConflictPanel', () => ({
  GroupConflictPanel: () => <div data-testid="group-conflict-panel" />,
}));

afterEach(cleanup);

describe('HierarchyConflictDialogView', () => {
  it('dispatches member remediation and request decisions through stable actions', () => {
    const onOpenChange = vi.fn();
    const handleMessage = vi.fn();
    const handleRemoveFromGroup = vi.fn().mockResolvedValue(undefined);
    const handleAccept = vi.fn();
    const handleReject = vi.fn();
    const affectedUser = { userId: 'user-1', displayName: 'Ada' };
    const partnerUser = { userId: 'user-2', displayName: 'Grace' };
    render(
      <HierarchyConflictDialogView
        {...({
          open: true,
          onOpenChange,
          groupName: 'Current Group',
          otherGroupName: 'Partner Group',
          affectedUsers: [affectedUser],
          partnerUsers: [partnerUser],
          canAccept: true,
          t: (key: string) => key,
          isSubmitting: false,
          removingUserId: null,
          relationshipPreflight: {
            isLoading: false,
            blocking: false,
            response: { blocking: false, conflicts: [], summary: 'Review conflicts' },
          },
          rightsLabel: 'Information right',
          hasStructuredConflicts: false,
          hasFallbackConflictUsers: true,
          handleMessage,
          handleRemoveFromGroup,
          handleAccept,
          handleReject,
          affectedMembersDescription: 'Affected members',
          futurePartnersDescription: 'Future partners',
        } as any)}
      />
    );

    fireEvent.click(
      document.querySelector('[data-action-id="network.hierarchy-conflict.group.message"]')!
    );
    fireEvent.click(
      document.querySelector(
        '[data-action-id="network.hierarchy-conflict.relationship.deactivate"]'
      )!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="network.hierarchy-conflict.user.message"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="network.hierarchy-conflict.cancel"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="network.hierarchy-conflict.reject"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="network.hierarchy-conflict.accept"]')!
    );

    expect(handleMessage.mock.calls).toEqual([[affectedUser], [partnerUser]]);
    expect(handleRemoveFromGroup).toHaveBeenCalledWith(affectedUser);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(handleReject).toHaveBeenCalledOnce();
    expect(handleAccept).toHaveBeenCalledOnce();
  });

  it('keeps conflict management in a structured, scrollable management dialog', () => {
    render(
      <HierarchyConflictDialogView
        {...({
          open: true,
          onOpenChange: vi.fn(),
          groupName: 'Current Group',
          otherGroupName: 'Partner Group',
          affectedUsers: [],
          partnerUsers: [],
          canAccept: true,
          t: (key: string) =>
            ({
              'common.network.manageLinkRequest': 'Manage link request',
              'common.network.manageLinkRequestDescription': 'Review this connection.',
              'common.network.linkPossibleDescription': 'This link can be accepted.',
              'common.actions.cancel': 'Cancel',
              'common.network.reject': 'Reject',
              'common.network.accept': 'Accept',
            })[key] ?? key,
          isSubmitting: false,
          removingUserId: null,
          relationshipPreflight: {
            isLoading: false,
            blocking: false,
            response: { blocking: false, conflicts: [] },
          },
          rightsLabel: 'Information right',
          hasStructuredConflicts: false,
          hasFallbackConflictUsers: false,
          handleMessage: vi.fn(),
          handleRemoveFromGroup: vi.fn(),
          handleAccept: vi.fn(),
          handleReject: vi.fn(),
          affectedMembersDescription: 'Affected members',
          futurePartnersDescription: 'Future partners',
        } as any)}
      />
    );

    expect(screen.getByRole('heading', { name: 'Manage link request' })).toBeTruthy();
    expect(document.querySelector('[data-slot="management-dialog-header"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="management-dialog-body"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="management-dialog-footer"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy();
  });

  it('renders loading and structured conflicts and evaluates every submission guard', () => {
    const affectedUser = { userId: 'user-1', displayName: 'Ada' };
    const base = {
      open: true,
      onOpenChange: vi.fn(),
      groupName: 'Current Group',
      otherGroupName: 'Partner Group',
      affectedUsers: [affectedUser],
      partnerUsers: [],
      canAccept: true,
      t: (key: string) => key,
      isSubmitting: false,
      removingUserId: null,
      relationshipPreflight: {
        isLoading: true,
        blocking: false,
        response: { blocking: false, conflicts: [], summary: null },
      },
      rightsLabel: 'Information right',
      hasStructuredConflicts: false,
      hasFallbackConflictUsers: false,
      handleMessage: vi.fn(),
      handleRemoveFromGroup: vi.fn(),
      handleAccept: vi.fn(),
      handleReject: vi.fn(),
      affectedMembersDescription: 'Affected members',
      futurePartnersDescription: 'Future partners',
    } as any;
    const { rerender } = render(<HierarchyConflictDialogView {...base} />);
    expect(
      document.querySelector('[data-action-id="network.hierarchy-conflict.accept"]')
    )?.toHaveProperty('disabled', true);

    rerender(
      <HierarchyConflictDialogView
        {...base}
        relationshipPreflight={{
          isLoading: false,
          blocking: false,
          response: { blocking: false, conflicts: [{}], summary: null },
        }}
        hasStructuredConflicts
        removingUserId="user-1"
      />
    );
    expect(screen.getByText('common.network.linkConflictDescription')).toBeTruthy();

    rerender(
      <HierarchyConflictDialogView
        {...base}
        relationshipPreflight={{
          isLoading: false,
          blocking: false,
          response: { blocking: false, conflicts: [{}], summary: null },
        }}
        hasStructuredConflicts
        removingUserId="other-user"
        isSubmitting
      />
    );

    rerender(
      <HierarchyConflictDialogView
        {...base}
        canAccept={false}
        relationshipPreflight={{
          isLoading: false,
          blocking: false,
          response: { blocking: false, conflicts: [] },
        }}
      />
    );
    rerender(
      <HierarchyConflictDialogView
        {...base}
        relationshipPreflight={{
          isLoading: false,
          blocking: true,
          response: { blocking: true, conflicts: [] },
        }}
      />
    );
    rerender(
      <HierarchyConflictDialogView
        {...base}
        affectedUsers={[]}
        relationshipPreflight={{
          isLoading: false,
          blocking: false,
          response: { blocking: false, conflicts: [{}], summary: null },
        }}
        hasStructuredConflicts
      />
    );
  });
});
