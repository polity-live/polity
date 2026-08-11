/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinkGroupDialogView } from '../LinkGroupDialogView';

const dialogMocks = vi.hoisted(() => ({
  modal: vi.fn(),
  contentProps: null as Record<string, any> | null,
  dialogProps: null as Record<string, any> | null,
  overlayProps: null as Record<string, any> | null,
  composerProps: null as Record<string, any> | null,
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
  }) => {
    dialogMocks.contentProps = {
      onInteractOutside: _onInteractOutside,
      showCloseButton: _showCloseButton,
    };
    return (
      <div data-slot="management-dialog-content" {...props}>
        {children}
      </div>
    );
  },
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
  Dialog: ({ children, modal, ...props }: { children: ReactNode; modal?: boolean }) => {
    dialogMocks.modal(modal);
    dialogMocks.dialogProps = props;
    return <div>{children}</div>;
  },
  DialogDescription: ({ children, ...props }: ComponentProps<'p'>) => <p {...props}>{children}</p>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: (props: Record<string, unknown>) => {
    dialogMocks.overlayProps = props;
    return <div data-testid="submission-overlay" />;
  },
}));

vi.mock('../GroupConnectionComposer', () => ({
  GroupConnectionComposer: (props: Record<string, unknown>) => {
    dialogMocks.composerProps = props;
    return <div data-testid="group-connection-composer" />;
  },
}));

afterEach(() => {
  cleanup();
  document.body.removeAttribute('data-app-tutorial-active');
  dialogMocks.contentProps = null;
  dialogMocks.dialogProps = null;
  dialogMocks.overlayProps = null;
  dialogMocks.composerProps = null;
  vi.clearAllMocks();
});

function renderDialog({
  open = true,
  roleId = '',
  pairConnectionsLoading = false,
  pairConnectionRequestsLoading = false,
  preflight = { blocking: false, isLoading: false, response: { blocking: false } },
  trigger = null,
  selectedGroupId = 'partner',
  membershipMode = 'role_members',
  membershipDirection = 'partner_members_to_current',
  hasRight = true,
  isEditMode = false,
  isSubmitting = false,
  groupStateLoading = false,
  submissionActive = false,
  currentGroupName = 'Current group',
  availableGroups = [{ id: 'partner', name: 'Partner group' }],
}: {
  open?: boolean;
  roleId?: string;
  pairConnectionsLoading?: boolean;
  pairConnectionRequestsLoading?: boolean;
  preflight?: { blocking: boolean; isLoading: boolean; response: { blocking: boolean } };
  trigger?: ReactNode;
  selectedGroupId?: string;
  membershipMode?: string;
  membershipDirection?: string | null;
  hasRight?: boolean;
  isEditMode?: boolean;
  isSubmitting?: boolean;
  groupStateLoading?: boolean;
  submissionActive?: boolean;
  currentGroupName?: string;
  availableGroups?: { id: string; name: string | null }[];
} = {}) {
  const value = {
    selectedGroupId,
    relationshipType: 'sibling',
    membershipDirection,
    membershipRule: {
      membershipMode,
      roleId,
      sourceGroupIds: [],
    },
    rightDirections: {
      informationRight: hasRight ? 'current_grants_right_to_partner' : 'none',
      amendmentRight: 'none',
      rightToSpeak: 'none',
      activeVotingRight: 'none',
      passiveVotingRight: 'none',
    },
    preset: 'elected',
  };

  const setOpen = vi.fn();
  const handleSubmit = vi.fn();
  const actionSubmission = {
    isActive: submissionActive,
    status: 'idle',
    progressSteps: [],
    error: null,
    reset: vi.fn(),
    retry: vi.fn(),
  };

  const rendered = render(
    <LinkGroupDialogView
      {...({
        currentGroupId: 'current',
        currentGroupName,
        trigger,
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
            'common.network.saving': 'Saving...',
            'common.network.saveChanges': 'Save changes',
            'common.network.editRelationship': 'Edit relationship',
            'common.network.editRelationshipDescription': 'Edit relationship description',
            'common.network.linkGroupSelectRightsOrMembership':
              'Select at least one right or configure membership.',
            'common.network.linkGroupSelectRole': 'Select a role to continue.',
            'common.network.linkGroupSelectTarget': 'Select a group to continue.',
            'common.network.selectGroup': 'Select group',
            'components.actionBar.linkGroup': 'Link group',
          })[key] ?? (typeof paramsOrFallback === 'string' ? paramsOrFallback : key),
        open,
        setOpen,
        actionSubmission,
        isEditMode,
        groupStateLoading,
        availableGroups,
        value,
        setValue: vi.fn(),
        activeTab: 'preset',
        setActiveTab: vi.fn(),
        isSubmitting,
        pairConnectionsLoading,
        pairConnectionRequestsLoading,
        existingRightStatuses: new Map(),
        selectableRolesByDirection: {},
        preflight,
        handleSubmit,
      } as any)}
    />
  );

  return { ...rendered, setOpen, handleSubmit, actionSubmission };
}

describe('LinkGroupDialogView', () => {
  it('opens, cancels, and submits group links through canonical actions', () => {
    const { setOpen, handleSubmit } = renderDialog({ roleId: 'role-1' });

    expect(document.querySelector('[data-action-id="network.link-group.open"]')).toBeTruthy();
    fireEvent.click(document.querySelector('[data-action-id="network.link-group.cancel"]')!);
    fireEvent.click(document.querySelector('[data-action-id="network.link-group.submit"]')!);

    expect(setOpen).toHaveBeenCalledWith(false);
    expect(handleSubmit).toHaveBeenCalledOnce();
  });

  it('renders a caller-provided trigger instead of the default link button', () => {
    renderDialog({ trigger: <button type="button">Custom link trigger</button> });

    expect(screen.getByRole('button', { name: 'Custom link trigger' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Link group' })).toBeNull();
  });

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

  it('reports all remaining submit gates and edit-mode labels', () => {
    renderDialog({ roleId: 'role-1', isSubmitting: true });
    expect(screen.getByText('Saving the link request.')).toBeTruthy();
    cleanup();

    renderDialog({ selectedGroupId: '' });
    expect(screen.getByText('Select a group to continue.')).toBeTruthy();
    cleanup();

    renderDialog({ roleId: 'role-1', groupStateLoading: true });
    expect(screen.getByText('Groups are still loading.')).toBeTruthy();
    cleanup();

    renderDialog({ roleId: 'role-1', pairConnectionRequestsLoading: true });
    expect(screen.getByText('Existing links and open requests are being checked.')).toBeTruthy();
    cleanup();

    renderDialog({
      roleId: 'role-1',
      preflight: { blocking: true, isLoading: false, response: { blocking: true } },
    });
    expect(screen.getByText('Resolve the conflict before creating this link.')).toBeTruthy();
    cleanup();

    renderDialog({
      membershipMode: 'none',
      membershipDirection: null,
      hasRight: false,
    });
    expect(screen.getByText('Select at least one right or configure membership.')).toBeTruthy();
    cleanup();

    renderDialog({
      roleId: 'role-1',
      isEditMode: true,
      currentGroupName: '',
    });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    expect(dialogMocks.composerProps?.disableGroupSelection).toBe(true);
  });

  it('guards tutorial outside interactions and leaves ordinary interactions untouched', () => {
    const regular = renderDialog({ roleId: 'role-1' });
    const regularPrevent = vi.fn();
    dialogMocks.contentProps!.onInteractOutside({
      target: document.createElement('div'),
      preventDefault: regularPrevent,
    });
    expect(regularPrevent).not.toHaveBeenCalled();
    regular.unmount();

    document.body.setAttribute('data-app-tutorial-active', '');
    renderDialog({ roleId: 'role-1' });
    const outsideHandler = dialogMocks.contentProps!.onInteractOutside;
    outsideHandler({ target: {}, preventDefault: vi.fn() });
    outsideHandler({ target: document.createElement('div'), preventDefault: vi.fn() });

    const spotlight = document.createElement('div');
    spotlight.dataset.testid = 'app-tutorial-spotlight';
    const child = document.createElement('span');
    spotlight.append(child);
    const preventDefault = vi.fn();
    outsideHandler({ target: child, preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('locks the dialog during submission and wires overlay completion and retry actions', () => {
    const { setOpen, actionSubmission } = renderDialog({
      submissionActive: true,
      selectedGroupId: '',
      currentGroupName: '',
      availableGroups: [],
    });

    expect(dialogMocks.dialogProps?.onOpenChange).toBeUndefined();
    expect(dialogMocks.contentProps?.showCloseButton).toBe(false);
    expect(screen.queryByTestId('group-connection-composer')).toBeNull();

    dialogMocks.overlayProps!.target.onClick();
    dialogMocks.overlayProps!.onBack();
    dialogMocks.overlayProps!.onRetry();

    expect(actionSubmission.reset).toHaveBeenCalledTimes(2);
    expect(actionSubmission.retry).toHaveBeenCalledOnce();
    expect(setOpen).toHaveBeenCalledWith(false);
  });
});
