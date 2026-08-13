/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChoiceField } from '../ChoiceField';
import { SwitchField } from '../SwitchField';

vi.mock('../FormFieldShell', () => ({
  FormFieldShell: ({ children }: { children: (state: object) => React.ReactNode }) =>
    children({ id: 'field', describedBy: 'description' }),
}));
vi.mock('@/features/shared/ui/ui/checkbox', () => ({
  Checkbox: ({
    onCheckedChange,
    ...props
  }: {
    onCheckedChange: (value: boolean | string) => void;
  }) => (
    <button
      {...props}
      onClick={() => onCheckedChange(true)}
      onContextMenu={() => onCheckedChange('indeterminate')}
    >
      check
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/switch', () => ({
  Switch: ({ onCheckedChange, ...props }: { onCheckedChange: (value: boolean) => void }) => (
    <button {...props} onClick={() => onCheckedChange(true)}>
      switch
    </button>
  ),
}));

afterEach(cleanup);

describe('ChoiceField and SwitchField', () => {
  it('renders and changes a selected required choice', () => {
    const onCheckedChange = vi.fn();
    render(
      <ChoiceField
        checked
        required
        label="Choice"
        description="Description"
        onCheckedChange={onCheckedChange}
      />
    );
    const control = screen.getByText('check');
    expect(control.closest('label')?.className).toContain('border-primary');
    fireEvent.click(control);
    fireEvent.contextMenu(control);
    expect(onCheckedChange.mock.calls.map(call => call[0])).toEqual([true, false]);
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('renders an unchecked optional choice without a description', () => {
    render(<ChoiceField checked={false} label="Choice" disabled onCheckedChange={vi.fn()} />);
    expect(screen.getByText('check').closest('label')?.className).toContain('hover:bg-muted');
  });

  it('renders and changes selected and unselected switches', () => {
    const onCheckedChange = vi.fn();
    const first = render(
      <SwitchField
        checked
        required
        label="Switch"
        description="Description"
        onCheckedChange={onCheckedChange}
      />
    );
    fireEvent.click(screen.getByText('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('switch').closest('label')?.className).toContain('border-primary');
    first.unmount();
    render(<SwitchField checked={false} label="Switch" disabled onCheckedChange={vi.fn()} />);
    expect(screen.getByText('switch').closest('label')?.className).toContain('hover:bg-muted');
  });
});
