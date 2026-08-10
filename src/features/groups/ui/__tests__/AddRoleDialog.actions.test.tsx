/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddRoleDialog } from '../AddRoleDialog';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/create/ui/inputs/RecurringPatternInput', () => ({
  RecurringPatternInput: () => null,
}));

afterEach(cleanup);

describe('AddRoleDialog actions', () => {
  it('opens, cancels, and submits role editing through stable actions', () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    const { container } = render(
      <AddRoleDialog
        data-action-id="groups.roles.create.submit"
        isOpen
        onOpenChange={onOpenChange}
        form={{
          name: 'Chair',
          description: '',
          assignee_kind: 'member',
          assignment_mode: 'assigned',
          visibility: 'public',
          term_pattern: 'none',
          term_interval: 1,
          term_start_date: '',
          scheduled_revote_date: '',
          default_request_role: false,
          default_invite_role: false,
        }}
        onFormChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(
      container.querySelector('[data-action-id="groups.roles.open.create-dialog"]')
    ).toBeTruthy();
    const cancel = document.querySelector<HTMLElement>(
      '[data-action-id="groups.roles.dialog.cancel"]'
    )!;
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(cancel);
    fireEvent.click(document.querySelector('[data-action-id="groups.roles.create.submit"]')!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('supports custom and intentionally absent dialog triggers', () => {
    const common = {
      isOpen: true,
      onOpenChange: vi.fn(),
      form: {
        name: 'Chair',
        description: '',
        assignee_kind: 'member' as const,
        assignment_mode: 'assigned' as const,
        visibility: 'public' as const,
        term_pattern: 'none' as const,
        term_interval: 1,
        term_start_date: '',
        scheduled_revote_date: '',
        default_request_role: false,
        default_invite_role: false,
      },
      onFormChange: vi.fn(),
      onSubmit: vi.fn(),
    };
    const view = render(
      <AddRoleDialog {...common} trigger={<button type="button">Custom trigger</button>} />
    );
    expect(document.querySelector('[data-action-scope="presentation"]')).toBeTruthy();
    expect(document.querySelector('[data-action-id="groups.roles.open.create-dialog"]')).toBeNull();

    view.rerender(<AddRoleDialog {...common} trigger={null} />);
    expect(document.querySelector('[data-action-scope="presentation"]')).toBeNull();
    expect(document.querySelector('[data-action-id="groups.roles.open.create-dialog"]')).toBeNull();
  });
});
