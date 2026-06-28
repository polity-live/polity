/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinkGroupDialogView } from '../LinkGroupDialogView';

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => (
    <div data-slot="dialog-content">{children}</div>
  ),
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: () => null,
}));

vi.mock('../GroupConnectionComposer', () => ({
  GroupConnectionComposer: () => <div data-testid="group-connection-composer" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog({
  roleId = '',
  pairConnectionsLoading = false,
  pairConnectionRequestsLoading = false,
  preflight = { blocking: false, isLoading: false, response: { blocking: false } },
}: {
  roleId?: string;
  pairConnectionsLoading?: boolean;
  pairConnectionRequestsLoading?: boolean;
  preflight?: { blocking: boolean; isLoading: boolean; response: { blocking: boolean } };
} = {}) {
  const value = {
    selectedGroupId: 'partner',
    relationshipType: 'sibling',
    membershipDirection: 'partner_members_to_current',
    membershipRule: {
      membershipMode: 'role_members',
      roleId,
      sourceGroupIds: [],
    },
    rightDirections: {
      informationRight: 'current_grants_right_to_partner',
      amendmentRight: 'none',
      rightToSpeak: 'none',
      activeVotingRight: 'none',
      passiveVotingRight: 'none',
    },
    preset: 'elected',
  };

  render(
    <LinkGroupDialogView
      {...({
        currentGroupId: 'current',
        currentGroupName: 'Current group',
        trigger: null,
        t: (key: string, paramsOrFallback?: string) =>
          ({
            'common.actions.cancel': 'Cancel',
            'common.actions.create': 'Create',
            'common.network.linkGroupDescription': 'Link group description',
            'common.network.linkGroupTitle': 'Link group',
            'common.network.linkGroupCheckingConnection': 'Checking connection...',
            'common.network.linkGroupCheckingConflicts': 'Possible conflicts are being checked.',
            'common.network.linkGroupCheckingExistingLinks':
              'Existing links and open requests are being checked.',
            'common.network.linkGroupConflictBlocked':
              'Resolve the conflict before creating this link.',
            'common.network.linkGroupLoadingGroups': 'Groups are still loading.',
            'common.network.linkGroupSavingStatus': 'Saving the link request.',
            'common.network.linkGroupSelectRightsOrMembership':
              'Select at least one right or configure membership.',
            'common.network.linkGroupSelectRole': 'Select a role to continue.',
            'common.network.linkGroupSelectTarget': 'Select a group to continue.',
            'common.network.selectGroup': 'Select group',
            'components.actionBar.linkGroup': 'Link group',
          })[key] ?? (typeof paramsOrFallback === 'string' ? paramsOrFallback : key),
        open: true,
        setOpen: vi.fn(),
        actionSubmission: {
          isActive: false,
          status: 'idle',
          progressSteps: [],
          error: null,
          reset: vi.fn(),
          retry: vi.fn(),
        },
        isEditMode: false,
        groupStateLoading: false,
        availableGroups: [{ id: 'partner', name: 'Partner group' }],
        value,
        setValue: vi.fn(),
        activeTab: 'preset',
        setActiveTab: vi.fn(),
        isSubmitting: false,
        pairConnectionsLoading,
        pairConnectionRequestsLoading,
        existingRightStatuses: new Map(),
        selectableRolesByDirection: {},
        preflight,
        handleSubmit: vi.fn(),
      } as any)}
    />
  );
}

describe('LinkGroupDialogView', () => {
  it('disables submit for role-members links without a selected role', () => {
    renderDialog();

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create' }).disabled).toBe(true);
    expect(screen.getByText('Select a role to continue.')).not.toBeNull();
  });

  it('enables submit for role-members links with a selected role', () => {
    renderDialog({ roleId: 'role-1' });

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create' }).disabled).toBe(false);
  });

  it('explains pair loading after a group is selected', () => {
    renderDialog({ roleId: 'role-1', pairConnectionsLoading: true });

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /Checking connection/ }).disabled
    ).toBe(true);
    expect(screen.getByText('Existing links and open requests are being checked.')).not.toBeNull();
  });

  it('explains preflight conflict checks', () => {
    renderDialog({
      roleId: 'role-1',
      preflight: { blocking: false, isLoading: true, response: { blocking: false } },
    });

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /Checking connection/ }).disabled
    ).toBe(true);
    expect(screen.getByText('Possible conflicts are being checked.')).not.toBeNull();
  });
});
