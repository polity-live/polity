/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: ({ className }: { className?: string }) => (
    <div data-testid="typeahead" className={className} />
  ),
}));
vi.mock('@/features/shared/hooks/useValidatedFieldController', () => ({
  useValidatedFieldController: () => ({ normalizedValue: '', validation: null }),
}));
vi.mock('../ValidatedFieldView', () => ({
  ValidatedFieldView: ({ multiline }: { multiline: boolean }) => (
    <div data-testid="validated">{String(multiline)}</div>
  ),
}));

import { FormCard } from '../FormCard';
import { FormFieldShell } from '../FormFieldShell';
import { PasswordFieldView } from '../PasswordFieldView';
import { SegmentedChoiceField } from '../SegmentedChoiceField';
import { TextField } from '../TextField';
import { TypeaheadField } from '../TypeaheadField';
import { ValidatedField } from '../ValidatedField';

describe('A01 form component branches', () => {
  it('renders a minimal card without optional header content', () => {
    const { container } = render(<FormCard title="Title">Body</FormCard>);
    expect(container.textContent).toContain('Title');
    expect(container.textContent).toContain('Body');
  });

  it('renders an icon choice at default size', () => {
    const Icon = ({ className }: { className?: string }) => (
      <span data-testid="choice-icon" className={className} />
    );
    const onValueChange = vi.fn();
    render(
      <SegmentedChoiceField
        value="a"
        onValueChange={onValueChange}
        options={[{ icon: Icon, label: 'A', value: 'a' }]}
      />
    );
    expect(screen.getByTestId('choice-icon')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(onValueChange).toHaveBeenCalledWith('a');
  });

  it('renders a shell label without a required marker', () => {
    render(<FormFieldShell label="Optional">{({ id }) => <input id={id} />}</FormFieldShell>);
    expect(screen.getByText('Optional')).toBeTruthy();
  });

  it('renders a label action without a label', () => {
    render(
      <FormFieldShell labelAction={<button>Action</button>}>
        {({ id }) => <input id={id} />}
      </FormFieldShell>
    );
    expect(screen.getByRole('button', { name: 'Action' })).toBeTruthy();
  });

  it('normalizes a null text value', () => {
    render(<TextField aria-label="text" value={null} onValueChange={vi.fn()} />);
    expect((screen.getByLabelText('text') as HTMLInputElement).value).toBe('');
  });

  it('adds invalid styling to typeahead fields', () => {
    render(
      <TypeaheadField
        aria-label="search"
        entityTypes={['user']}
        error="Invalid"
        onChange={vi.fn()}
        value={null as unknown as string}
      />
    );
    expect(screen.getByTestId('typeahead').className).toContain(
      '[&_[data-slot=input]]:border-destructive'
    );
  });

  it('renders the multiline validated-field branch', () => {
    render(
      <ValidatedField multiline value="text" onValueChange={vi.fn()} aria-label="validated" />
    );
    expect(screen.getByTestId('validated').textContent).toBe('true');
  });

  it('renders the visible password state and forwards both change callbacks', () => {
    const onChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <PasswordFieldView
        aria-label="password"
        hidePasswordLabel="Hide"
        isVisible
        onChange={onChange}
        onValueChange={onValueChange}
        onVisibilityToggle={vi.fn()}
        showPasswordLabel="Show"
      />
    );
    expect(screen.getByLabelText('password').getAttribute('type')).toBe('text');
    expect(screen.getByText('Hide')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'secret' } });
    expect(onChange).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledWith('secret');
  });
});
