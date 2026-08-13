/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddPaymentDialogView, type AddPaymentDialogViewProps } from '../AddPaymentDialogView';

HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
HTMLElement.prototype.setPointerCapture = vi.fn();
HTMLElement.prototype.releasePointerCapture = vi.fn();
HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/form/CurrencySelect', () => ({
  CurrencySelect: ({
    'data-action-id': actionId,
    onChange,
  }: {
    'data-action-id'?: string;
    onChange: (value: string) => void;
  }) => (
    <button data-action-id={actionId} type="button" onClick={() => onChange('EUR')}>
      USD
    </button>
  ),
}));

afterEach(cleanup);

function createProps(
  overrides: Partial<AddPaymentDialogViewProps> = {}
): AddPaymentDialogViewProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    direction: 'expense',
    groupId: 'group-1',
    label: 'Venue',
    setLabel: vi.fn(),
    type: 'events',
    setType: vi.fn(),
    amount: '10.00',
    setAmount: vi.fn(),
    currency: 'USD',
    setCurrency: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    popoverOpen: true,
    setPopoverOpen: vi.fn(),
    entityType: 'user',
    setEntityType: vi.fn(),
    selectedEntity: null,
    setSelectedEntity: vi.fn(),
    allUsers: [],
    allGroups: [],
    getUserDisplayName: (user: { name: string }) => user.name,
    filteredUsers: [{ id: 'user-1', name: 'Ada', handle: 'ada' }],
    filteredGroups: [{ id: 'group-2', name: 'Assembly', member_count: 4 }],
    handleSubmit: vi.fn(event => event.preventDefault()),
    ...overrides,
  };
}

describe('AddPaymentDialogView actions', () => {
  it('edits and submits payments through stable actions', () => {
    const setLabel = vi.fn();
    const setAmount = vi.fn();
    const setCurrency = vi.fn();
    const setEntityType = vi.fn();
    const setSelectedEntity = vi.fn();
    const setSearchQuery = vi.fn();
    const handleSubmit = vi.fn(event => event.preventDefault());
    const { container } = render(
      <AddPaymentDialogView
        {...createProps({
          setLabel,
          setAmount,
          setCurrency,
          setEntityType,
          setSelectedEntity,
          setSearchQuery,
          handleSubmit,
        })}
      />
    );

    fireEvent.change(screen.getByLabelText('generated.inline.0535_label_74341e3c'), {
      target: { value: 'Catering' },
    });
    fireEvent.change(screen.getByLabelText('generated.inline.0607_amount_0dde6c59'), {
      target: { value: '25.50' },
    });
    fireEvent.click(document.querySelector('[data-action-id="groups.payments.select.currency"]')!);
    fireEvent.click(
      document.querySelector('[data-action-id="groups.payments.entity.select-user"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="groups.payments.entity.select-group"]')!
    );
    const submit = document.querySelector<HTMLElement>(
      '[data-action-id="groups.payments.create.submit"]'
    )!;
    fireEvent.submit(submit.closest('form')!);

    expect(setLabel).toHaveBeenCalledWith('Catering');
    expect(setAmount).toHaveBeenCalledWith('25.50');
    expect(setCurrency).toHaveBeenCalledWith('EUR');
    expect(setEntityType.mock.calls).toEqual([['user'], ['group']]);
    expect(setSelectedEntity).toHaveBeenCalledTimes(2);
    expect(setSearchQuery).toHaveBeenCalledTimes(2);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-action-id="groups.payments.open.create-dialog"]')
    ).toBeTruthy();
  });

  it('selects payment types and target entities through stable options', () => {
    const setType = vi.fn();
    const setSelectedEntity = vi.fn();
    const setPopoverOpen = vi.fn();
    render(
      <AddPaymentDialogView {...createProps({ setType, setSelectedEntity, setPopoverOpen })} />
    );

    const typeTrigger = document.querySelector<HTMLElement>(
      '[data-action-id="groups.payments.type.open"]'
    )!;
    const entityTrigger = document.querySelector<HTMLElement>(
      '[data-action-id="groups.payments.entity.open-picker"]'
    )!;
    typeTrigger.focus();
    expect(document.activeElement).toBe(typeTrigger);
    entityTrigger.focus();
    expect(document.activeElement).toBe(entityTrigger);
    typeTrigger.focus();
    fireEvent.pointerDown(typeTrigger, {
      button: 0,
      buttons: 1,
      ctrlKey: false,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.click(
      document.querySelector('[data-action-id="groups.payments.type.choose-others"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="groups.payments.entity.choose-user"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="groups.payments.entity.choose-group"]')!
    );

    expect(setType).toHaveBeenCalledWith('others');
    expect(setSelectedEntity).toHaveBeenCalledWith({ id: 'user-1', name: 'Ada', type: 'user' });
    expect(setSelectedEntity).toHaveBeenCalledWith({
      id: 'group-2',
      name: 'Assembly',
      type: 'group',
    });
    expect(setPopoverOpen).toHaveBeenCalledWith(false);
  });

  it('covers income, zero-decimal currency, selected users, avatars, and empty user fallbacks', () => {
    const setSelectedEntity = vi.fn();
    const view = render(
      <AddPaymentDialogView
        {...createProps({
          direction: 'income',
          currency: 'JPY',
          selectedEntity: { id: 'user-1', name: 'Ada', type: 'user' },
          filteredUsers: [
            null as any,
            { id: 'user-1', name: 'Ada', avatar: 'avatar', handle: 'ada' },
            { id: 'user-2', name: '', email: 'mail@example.test' },
          ],
          getUserDisplayName: (user: any) => user.name ?? '',
          setSelectedEntity,
        })}
      />
    );
    expect(
      screen.getByLabelText('generated.inline.0607_amount_0dde6c59').getAttribute('placeholder')
    ).toBe('0');
    fireEvent.click(
      document.querySelectorAll('[data-action-id="groups.payments.entity.choose-user"]')[1]!
    );
    expect(document.body.textContent).toContain('mail@example.test');
    view.rerender(
      <AddPaymentDialogView
        {...createProps({
          entityType: 'group',
          selectedEntity: { id: 'group-null', name: 'Unnamed', type: 'group' },
          filteredGroups: [
            { id: 'group-null', name: null, member_count: 0 },
            { id: 'group-2', name: 'Assembly', member_count: 4 },
          ],
          setSelectedEntity,
        })}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="groups.payments.entity.choose-group"]')!
    );
    expect(setSelectedEntity).toHaveBeenCalledWith(expect.objectContaining({ name: 'Unnamed' }));
  });
});
