/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinkGroupDialogView } from '../LinkGroupDialogView';

const dialogMocks = vi.hoisted(() => ({
  modal: vi.fn(),
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  ManagementDialogContent: ({
    children,
    onInteractOutside: _onInteractOutside,
    showCloseButton: _showCloseButton,
    ...props
  }: {
    children: ReactNode;
    onInteractOutside?: unknown;
    showCloseButton?: boolean;
  }) => (
    <div data-slot="management-dialog-content" {...props}>
      {children}
    </div>
  ),
  ManagementDialogHeader: ({ children, ...props }: ComponentProps<'header'>) => (
    <header data-slot="management-dialog-header" {...props}>
      {children}
    </header>
  ),
  ManagementDialogBody: ({ children, ...props }: ComponentProps<'div'>) => (
    <div data-slot="management-dialog-body" {...props}>
      {children}
    </div>
  ),
  ManagementDialogFooter: ({ children, ...props }: ComponentProps<'footer'>) => (
    <footer data-slot="management-dialog-footer" {...props}>
      {children}
    </footer>
  ),
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children, modal }: { children: ReactNode; modal?: boolean }) => {
    dialogMocks.modal(modal);
    return <div>{children}</div>;
  },
  DialogDescription: ({ children, ...props }: ComponentProps<'p'>) => <p {...props}>{children}</p>,
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
  document.body.removeAttribute('data-app-tutorial-active');
  vi.clearAllMocks();
});

function renderDialog({
  open = true,
  roleId = '',
  pairConnectionsLoading = false,
  pairConnectionRequestsLoading = false,
  preflight = { blocking: false, isLoading: false, response: { blocking: false } },
}: {
  open?: boolean;
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

  return render(
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
        open,
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
  it('keeps the tutorial controls interactive while the link dialog is open', () => {
    document.body.setAttribute('data-app-tutorial-active', '');

    renderDialog({ roleId: 'role-1' });

    expect(dialogMocks.modal).toHaveBeenLastCalledWith(false);
  });

  it('does not embed tutorial UI or tutorial-specific layout in the link dialog', () => {
    document.body.setAttribute('data-app-tutorial-active', '');

    const { container } = renderDialog({ roleId: 'role-1' });

    const content = container.querySelector<HTMLElement>('[data-slot="management-dialog-content"]');
    const header = container.querySelector('[data-slot="management-dialog-header"]');
    const body = container.querySelector('[data-slot="management-dialog-body"]');
    const footer = container.querySelector('[data-slot="management-dialog-footer"]');

    expect(screen.queryByTestId('link-group-tutorial-companion')).toBeNull();
    expect(content?.hasAttribute('data-tutorial-dialog')).toBe(false);
    expect(content?.className).toContain('h-[min(90dvh,46rem)]');
    expect(content?.className).not.toContain('100dvh');
    expect(header?.className).not.toContain('max-md:');
    expect(body?.hasAttribute('data-tutorial-scroll-container')).toBe(false);
    expect(body?.className).toBe('grid content-start gap-4');
    expect(footer?.className).not.toContain('max-md:');
    expect(screen.getByRole('button', { name: 'Cancel' }).className).not.toContain('max-md:');
    expect(screen.getByRole('button', { name: 'Create' }).className).not.toContain('max-md:');
  });

  it('uses the shared management dialog structure', () => {
    const { container } = renderDialog({ roleId: 'role-1' });

    expect(container.querySelector('[data-slot="management-dialog-header"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="management-dialog-body"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="management-dialog-footer"]')).toBeTruthy();
  });

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
