/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RadioGroupField } from '../RadioGroupField';

vi.mock('@/features/shared/ui/form/FormFieldShell', () => ({
  FormFieldShell: ({ children, invalid, ...props }: any) => (
    <section data-testid="shell" data-label={String(props.label)}>
      {children({ describedBy: 'field-description', invalid: Boolean(invalid) })}
    </section>
  ),
}));

vi.mock('@/features/shared/ui/ui/radio-group', () => ({
  RadioGroup: ({ children, onValueChange: _onValueChange, ...props }: any) => (
    <div role="radiogroup" {...props}>
      {children}
    </div>
  ),
  RadioGroupItem: (props: any) => <input type="radio" {...props} />,
}));

afterEach(() => cleanup());

describe('RadioGroupField', () => {
  it('renders selected, described, and disabled options with explicit ids', () => {
    render(
      <RadioGroupField
        id="scope"
        label="Scope"
        invalid
        required
        value="public"
        onValueChange={vi.fn()}
        options={[
          { value: 'public', label: 'Public', description: 'Everyone can see this' },
          { value: 'private', label: 'Private', disabled: true },
        ]}
        className="group-class"
        optionClassName="option-class"
      />
    );

    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-describedby')).toBe('field-description');
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(group.getAttribute('aria-required')).toBe('true');
    expect(group.className).toContain('group-class');
    expect(screen.getByText('Everyone can see this')).toBeTruthy();
    expect(screen.getByLabelText(/Public/).id).toBe('scope-public');
    expect(screen.getByLabelText('Private')).toHaveProperty('disabled', true);
    expect(screen.getByText('Public').closest('label')!.className).toContain('border-primary');
    expect(screen.getByText('Private').closest('label')!.className).toContain('cursor-not-allowed');
  });

  it('uses fallback ids and omits false accessibility states', () => {
    render(
      <RadioGroupField
        label="Choice"
        invalid={false}
        required={false}
        value=""
        onValueChange={vi.fn()}
        options={[{ value: 'one', label: 'One' }]}
      />
    );

    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-invalid')).toBeNull();
    expect(group.getAttribute('aria-required')).toBeNull();
    expect(screen.getByLabelText('One').id).toBe('radio-one');
    expect(screen.getByText('One').closest('label')!.className).toContain('hover:bg-muted/50');
  });
});
