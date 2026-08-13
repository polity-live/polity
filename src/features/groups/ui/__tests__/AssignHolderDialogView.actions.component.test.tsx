/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AssignHolderDialogView,
  type AssignHolderDialogViewProps,
} from '../AssignHolderDialogView';

HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
HTMLElement.prototype.setPointerCapture = vi.fn();
HTMLElement.prototype.releasePointerCapture = vi.fn();
HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

afterEach(cleanup);

function createProps(
  overrides: Partial<AssignHolderDialogViewProps> = {}
): AssignHolderDialogViewProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    role: { id: 'role-1', title: 'Chair' },
    groupId: 'group-1',
    onAssign: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    popoverOpen: true,
    setPopoverOpen: vi.fn(),
    selectedUserId: null,
    setSelectedUserId: vi.fn(),
    reason: 'appointed',
    setReason: vi.fn(),
    members: [],
    currentHolder: null,
    isElectedRole: false,
    filteredMembers: [{ user: { id: 'user-1', first_name: 'Ada', handle: 'ada', avatar: null } }],
    selectedMember: null,
    handleSubmit: vi.fn(event => event.preventDefault()),
    ...overrides,
  };
}

describe('AssignHolderDialogView actions', () => {
  it('selects a member and reason and dispatches holder management', () => {
    const onOpenChange = vi.fn();
    const setSelectedUserId = vi.fn();
    const setPopoverOpen = vi.fn();
    const setReason = vi.fn();
    const handleSubmit = vi.fn(event => event.preventDefault());
    render(
      <AssignHolderDialogView
        {...createProps({
          onOpenChange,
          setSelectedUserId,
          setPopoverOpen,
          setReason,
          handleSubmit,
        })}
      />
    );

    const memberTrigger = document.querySelector<HTMLElement>(
      '[data-action-id="groups.roles.holder.open-member-picker"]'
    )!;
    memberTrigger.focus();
    expect(document.activeElement).toBe(memberTrigger);
    fireEvent.click(
      document.querySelector('[data-action-id="groups.roles.holder.choose-member"]')!
    );
    fireEvent.click(document.querySelector('[data-action-id="groups.roles.holder.cancel"]')!);
    const submit = document.querySelector<HTMLElement>(
      '[data-action-id="groups.roles.holder.submit"]'
    )!;
    fireEvent.submit(submit.closest('form')!);

    const reasonTrigger = document.querySelector<HTMLElement>(
      '[data-action-id="groups.roles.holder.open-reason"]'
    )!;
    fireEvent.pointerDown(reasonTrigger, {
      button: 0,
      buttons: 1,
      ctrlKey: false,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.click(
      document.querySelector('[data-action-id="groups.roles.holder.choose-elected"]')!
    );

    expect(setSelectedUserId).toHaveBeenCalledWith('user-1');
    expect(setPopoverOpen).toHaveBeenCalledWith(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(setReason).toHaveBeenCalledWith('elected');
  });

  it('disables direct assignment for elected roles', () => {
    render(<AssignHolderDialogView {...createProps({ isElectedRole: true })} />);

    expect(
      document
        .querySelector('[data-action-id="groups.roles.holder.open-member-picker"]')
        ?.hasAttribute('disabled')
    ).toBe(true);
    expect(document.querySelector('[data-action-id="groups.roles.holder.submit"]')).toBeNull();
  });
});
