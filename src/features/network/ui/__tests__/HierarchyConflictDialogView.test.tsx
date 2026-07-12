/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HierarchyConflictDialogView } from '../HierarchyConflictDialogView';

afterEach(cleanup);

describe('HierarchyConflictDialogView', () => {
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
});
