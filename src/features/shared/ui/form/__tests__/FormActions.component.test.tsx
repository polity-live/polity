/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FormActions } from '../FormActions';

vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({
    children,
    variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
  }) => (
    <button data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

afterEach(cleanup);

describe('FormActions', () => {
  it('renders children without optional actions', () => {
    const { container } = render(<FormActions className="custom">Extra</FormActions>);

    expect(container.firstElementChild?.className).toContain('custom');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders an enabled cancel action and invokes it', () => {
    const onCancel = vi.fn();
    render(<FormActions cancelLabel="Cancel" onCancel={onCancel} isSubmitting={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('renders disabled cancel and submit actions while submitting', () => {
    render(
      <FormActions
        cancelLabel="Cancel"
        submitLabel="Save"
        isSubmitting
        submitDisabled={false}
        submitVariant="destructive"
      />
    );

    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('data-variant')).toBe(
      'destructive'
    );
  });

  it('supports an independently disabled submit action and the default variant', () => {
    render(<FormActions submitLabel="Save" submitDisabled />);

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('data-variant')).toBe(
      'default'
    );
  });
});
