/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AmendmentBranchSelectorSection } from '../AmendmentBranchSelectorSection';
import { AmendmentSubscribeButtonView } from '../AmendmentSubscribeButtonView';
import { ConfirmationRequestNoticeView } from '../ConfirmationRequestNoticeView';
import { SupportConfirmationPanelView } from '../SupportConfirmationPanelView';
import { SupporterDirectorySectionView } from '../SupporterDirectorySectionView';
import { TargetSelectionDialogView } from '../TargetSelectionDialogView';
import { VersionComparisonView } from '../VersionComparisonView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/amendments/ui/SupporterDirectoryDetails', () => ({
  SupporterDirectoryDetails: ({ item }: { item: { groupName: string } }) => (
    <span>{item.groupName}</span>
  ),
}));

vi.mock('@/features/amendments/ui/SupporterLocalityMap', () => ({
  SupporterLocalityMap: () => <div data-testid="supporter-map" />,
}));

vi.mock('@/features/amendments/ui/TargetGroupEventSelector', () => ({
  TargetGroupEventSelector: () => <div data-testid="target-selector" />,
}));

vi.mock('@/features/agendas/ui/MergeVariantComparisonPanel', () => ({
  VariantDiffPanel: () => <div data-testid="variant-diff" />,
}));

vi.mock('../logic/amendmentBranchDisplay', () => ({
  countOpenChangeRequests: () => 0,
  getBranchEditingMode: () => 'view',
  getBranchDisplayEvent: () => null,
  getBranchPathLabel: (branch: { title: string }) => branch.title,
}));

afterEach(cleanup);

describe('supporting amendment actions', () => {
  it('dispatches subscription and confirmation request actions through stable intents', () => {
    const handleClick = vi.fn();
    const { container, rerender } = render(
      <AmendmentSubscribeButtonView
        amendmentId="amendment-1"
        onSubscribeChange={vi.fn()}
        isSubscribed={false}
        toggleSubscribe={vi.fn()}
        isLoading={false}
        handleClick={handleClick}
      />
    );
    fireEvent.click(
      container.querySelector('[data-action-id="amendments.subscription.toggle.current"]')!
    );
    expect(handleClick).toHaveBeenCalledOnce();

    const onViewChanges = vi.fn();
    const onConfirmClick = vi.fn();
    const onDeclineClick = vi.fn();
    rerender(
      <ConfirmationRequestNoticeView
        labels={{
          title: 'Confirmations',
          description: 'Review changes',
          untitled: 'Untitled',
          changeRequest: 'Change request',
          viewChanges: 'View changes',
          confirm: 'Confirm',
          decline: 'Decline',
        }}
        pendingConfirmations={[{ id: 'confirmation-1', amendment: { id: 'a-1', title: 'A1' } }]}
        processingId={null}
        onConfirmClick={onConfirmClick}
        onDeclineClick={onDeclineClick}
        onViewChanges={onViewChanges}
      />
    );
    for (const actionId of [
      'amendments.confirmation.navigate.changes',
      'amendments.confirmation.accept.request',
      'amendments.confirmation.decline.request',
    ]) {
      fireEvent.click(container.querySelector(`[data-action-id="${actionId}"]`)!);
    }
    expect(onViewChanges).toHaveBeenCalledWith('confirmation-1', 'a-1');
    expect(onConfirmClick).toHaveBeenCalledWith('confirmation-1');
    expect(onDeclineClick).toHaveBeenCalledWith('confirmation-1');
  });

  it('dispatches support comparison and decision actions through stable intents', () => {
    const setSelectedConfirmation = vi.fn();
    const handleConfirm = vi.fn();
    const handleDecline = vi.fn();
    const { container, rerender } = render(
      <SupportConfirmationPanelView
        groupId="group-1"
        t={(key: string) => key}
        i18n={{}}
        pendingConfirmations={[
          { id: 'confirmation-1', created_at: Date.now(), amendment: { title: 'A1' } },
        ]}
        isLoading={false}
        confirmSupport={vi.fn()}
        declineSupport={vi.fn()}
        selectedConfirmation={null}
        setSelectedConfirmation={setSelectedConfirmation}
        processingId={null}
        setProcessingId={vi.fn()}
        dateLocale={undefined}
        status="ready"
        handleConfirm={handleConfirm}
        handleDecline={handleDecline}
      />
    );
    for (const actionId of [
      'amendments.support-confirmation.toggle.comparison',
      'amendments.support-confirmation.accept.request',
      'amendments.support-confirmation.decline.request',
    ]) {
      fireEvent.click(container.querySelector(`[data-action-id="${actionId}"]`)!);
    }
    expect(setSelectedConfirmation).toHaveBeenCalledWith('confirmation-1');
    expect(handleConfirm).toHaveBeenCalledWith('confirmation-1');
    expect(handleDecline).toHaveBeenCalledWith('confirmation-1');

    rerender(
      <SupportConfirmationPanelView
        groupId="group-1"
        t={(key: string) => key}
        i18n={{}}
        pendingConfirmations={[]}
        isLoading={false}
        confirmSupport={vi.fn()}
        declineSupport={vi.fn()}
        selectedConfirmation={null}
        setSelectedConfirmation={setSelectedConfirmation}
        processingId={null}
        setProcessingId={vi.fn()}
        dateLocale={undefined}
        status="empty"
        handleConfirm={handleConfirm}
        handleDecline={handleDecline}
      />
    );
    expect(screen.getByText('features.amendments.supportConfirmation.noPending')).toBeTruthy();
  });

  it('navigates supporters and confirms target selection through stable intents', () => {
    const onSelect = vi.fn();
    const { container, rerender } = render(
      <SupporterDirectorySectionView
        items={[]}
        mapItems={[]}
        activeGroupId={null}
        onActiveGroupChange={vi.fn()}
        onClearActiveGroup={vi.fn()}
        onSelect={onSelect}
        sortedItems={[{ groupId: 'group-1', groupName: 'Group One' }]}
        sortedMapItems={[]}
      />
    );
    fireEvent.click(
      container.querySelector('[data-action-id="amendments.supporters.navigate.group"]')!
    );
    expect(onSelect).toHaveBeenCalledWith('group-1');

    const onCancel = vi.fn();
    const onConfirmClick = vi.fn();
    rerender(
      <TargetSelectionDialogView
        open
        onOpenChange={vi.fn()}
        currentUserId="user-1"
        collaborators={[]}
        showCollaboratorSelection={false}
        isSaving={false}
        dialogTitle="Select target"
        dialogDescription="Choose a target"
        confirmText="Confirm target"
        cancelText="Cancel"
        onCancel={onCancel}
        onConfirmClick={onConfirmClick}
        onTargetSelect={vi.fn()}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.target-selection.cancel.dialog"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.target-selection.confirm.target"]')!
    );
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirmClick).toHaveBeenCalledOnce();
  });

  it('selects branches and toggles their comparison through stable actions', async () => {
    const onBranchChange = vi.fn();
    const { container } = render(
      <AmendmentBranchSelectorSection
        branches={
          [
            { id: 'branch-1', title: 'Branch One', status: 'active' },
            { id: 'branch-2', title: 'Branch Two', status: 'scheduled' },
          ] as never
        }
        selectedBranchId="branch-1"
        includeAllBranchesOption
        branchDiffCandidates={[{ id: 'left' }, { id: 'right' }] as never}
        onBranchChange={onBranchChange}
      />
    );

    const selector = container.querySelector(
      '[data-action-id="amendments.branches.select.current"]'
    ) as HTMLElement;
    expect(selector).toBeTruthy();
    fireEvent.click(container.querySelector('[data-action-id="amendments.branches.toggle.diff"]')!);
    expect(screen.getByTestId('variant-diff')).toBeTruthy();
  });

  it('omits the aggregate branch option when it is explicitly disabled', async () => {
    const { container } = render(
      <AmendmentBranchSelectorSection
        branches={[{ id: 'branch-1', title: 'Branch One', status: 'active' }] as never}
        selectedBranchId="branch-1"
        includeAllBranchesOption={false}
        onBranchChange={vi.fn()}
      />
    );

    const trigger = container.querySelector<HTMLElement>(
      '[data-action-id="amendments.branches.select.current"]'
    )!;
    trigger.hasPointerCapture = () => false;
    trigger.setPointerCapture = () => undefined;
    trigger.releasePointerCapture = () => undefined;
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerId: 1 });
    expect((await screen.findAllByText('Branch One')).length).toBeGreaterThan(1);
    expect(document.querySelector('[data-action-id="amendments.branches.select.all"]')).toBeNull();
  });

  it('switches version comparison tabs through stable selectable actions', () => {
    const { container } = render(
      <VersionComparisonView originalVersion="Before" currentVersion="After" />
    );

    for (const value of ['side-by-side', 'original', 'current']) {
      const tab = container.querySelector(
        `[data-action-id="amendments.version-comparison.select.${value}"]`
      );
      fireEvent.mouseDown(tab!, { button: 0, ctrlKey: false });
      expect(tab?.getAttribute('data-state')).toBe('active');
    }
  });
});
