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

function renderDialog(roleId = '') {
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
        pairConnectionsLoading: false,
        pairConnectionRequestsLoading: false,
        existingRightStatuses: new Map(),
        selectableRolesByDirection: {},
        preflight: { blocking: false, isLoading: false, response: { blocking: false } },
        handleSubmit: vi.fn(),
      } as any)}
    />
  );
}

describe('LinkGroupDialogView', () => {
  it('disables submit for role-members links without a selected role', () => {
    renderDialog('');

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create' }).disabled).toBe(true);
  });

  it('enables submit for role-members links with a selected role', () => {
    renderDialog('role-1');

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create' }).disabled).toBe(false);
  });
});
