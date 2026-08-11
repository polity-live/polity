/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (key: string) => key }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock('@/features/shared/ui/form', () => ({
  ChoiceCardField: ({ id, onValueChange, options }: any) => (
    <div>
      {options.map((option: any) => (
        <button
          key={option.value}
          data-testid={`${id}-${option.value}`}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
  FormControlLabel: ({ children }: any) => <label>{children}</label>,
  FormControlTextarea: ({ onChange, ...props }: any) => <textarea {...props} onChange={onChange} />,
  SwitchField: ({ label, onCheckedChange }: any) => (
    <div>
      <button data-testid={`${label}-true`} onClick={() => onCheckedChange(true)}>
        on
      </button>
      <button data-testid={`${label}-false`} onClick={() => onCheckedChange(false)}>
        off
      </button>
    </div>
  ),
  VisibilitySelector: ({ onChange }: any) => (
    <button data-testid="visibility" onClick={() => onChange('authenticated')}>
      visibility
    </button>
  ),
}));
vi.mock('@/features/shared/ui/form/ValidatedInputField', () => ({
  ValidatedInputField: ({ id, onChange, validator }: any) => {
    const invalid = validator?.('x');
    const valid = validator?.('valid');
    return (
      <button
        data-testid={id}
        data-invalid={String(invalid)}
        data-valid={String(valid)}
        onClick={() => onChange('changed')}
      >
        {id}
      </button>
    );
  },
}));
vi.mock('@/features/create/ui/inputs/RecurringPatternInput', () => ({
  RecurringPatternInput: ({ onChange, onIntervalChange }: any) => (
    <div>
      <button data-testid="pattern-none" onClick={() => onChange('none')}>
        none
      </button>
      <button data-testid="pattern-yearly" onClick={() => onChange('yearly')}>
        yearly
      </button>
      <button data-testid="pattern-interval" onClick={() => onIntervalChange(2)}>
        interval
      </button>
    </div>
  ),
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <footer>{children}</footer>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

import { AddRoleDialog } from '../AddRoleDialog';

afterEach(cleanup);

const baseForm = {
  name: 'Chair',
  description: '',
  assignee_kind: 'member' as const,
  assignment_mode: 'assigned' as const,
  visibility: 'public' as const,
  term_pattern: 'none' as const,
  term_interval: 1,
  term_start_date: '',
  scheduled_revote_date: '',
  default_request_role: true,
  default_invite_role: true,
};

function renderDialog(
  overrides: Record<string, unknown> = {},
  formOverrides: Record<string, unknown> = {}
) {
  const onFormChange = vi.fn();
  const view = render(
    <AddRoleDialog
      isOpen
      onOpenChange={vi.fn()}
      onFormChange={onFormChange}
      onSubmit={vi.fn()}
      form={{ ...baseForm, ...formOverrides }}
      {...overrides}
    />
  );
  return { ...view, onFormChange };
}

describe('AddRoleDialog branch interactions', () => {
  it('executes every group form callback and both recurring-pattern paths', () => {
    const { container, onFormChange } = renderDialog();
    container.querySelectorAll('button').forEach(button => fireEvent.click(button));
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'Detailed role' } });
    expect(onFormChange).toHaveBeenCalledWith({ name: 'changed' });
    expect(onFormChange).toHaveBeenCalledWith({ description: 'Detailed role' });
    expect(onFormChange).toHaveBeenCalledWith({ term_pattern: 'none', term_interval: 1 });
    expect(onFormChange).toHaveBeenCalledWith({ term_pattern: 'yearly', term_interval: 1 });
    expect(onFormChange).toHaveBeenCalledWith({ default_request_role: true });
    expect(onFormChange).toHaveBeenCalledWith({ default_request_role: false });
  });

  it.each([
    [
      { guestOnlyMembershipFlow: true },
      {
        assignee_kind: 'guest',
        description: 'Guest',
        term_start_date: '2026-01-01',
        scheduled_revote_date: '2027-01-01',
      },
    ],
    [{ scope: 'event', eventType: 'general_assembly' }, { assignee_kind: 'guest' }],
    [{ scope: 'event', eventType: 'delegate_assembly' }, { assignee_kind: 'member' }],
    [{ scope: 'event', eventType: 'conference' }, { assignee_kind: 'guest' }],
  ])('covers guest defaults and event-type decisions', (props, form) => {
    const { container } = renderDialog(props, form);
    container.querySelectorAll('button').forEach(button => fireEvent.click(button));
    expect(container.textContent).toContain('generated.inline.0626_membership_defaults_e7e5326a');
  });
});
