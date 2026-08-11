/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: ({ onValueChange, ...props }: any) => (
    <input {...props} onChange={event => onValueChange(event.target.value)} />
  ),
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <button type="button" {...props} onClick={onSelect}>
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, options?: { name?: string }) => `${key}:${options?.name ?? ''}`,
}));

import { PqlComboboxView } from '../PqlComboboxView';

afterEach(cleanup);

describe('PqlComboboxView actions', () => {
  it('opens, clears, searches, and selects through stable actions without nested controls', () => {
    const onClearSelection = vi.fn();
    const onOpenChange = vi.fn();
    const onQueryChange = vi.fn();
    const onSelectOption = vi.fn();
    const { container, rerender } = render(
      <PqlComboboxView
        value="open"
        options={[]}
        placeholder="Choose status"
        searchPlaceholder="Search status"
        emptyText="No status"
        disabled={false}
        allowClear
        open
        query=""
        selectedOption={{ value: 'open', label: 'Open' }}
        filteredOptions={[
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
        ]}
        onClearSelection={onClearSelection}
        onOpenChange={onOpenChange}
        onQueryChange={onQueryChange}
        onSelectOption={onSelectOption}
      />
    );

    const open = container.querySelector<HTMLElement>('[data-action-id="pql.combobox.open"]')!;
    const clear = container.querySelector<HTMLElement>(
      '[data-action-id="pql.combobox.selection.clear"]'
    )!;
    expect(open.querySelector('[role="button"]')).toBeNull();
    open.focus();
    expect(document.activeElement).toBe(open);
    fireEvent.click(open);
    fireEvent.click(clear);
    fireEvent.change(screen.getByPlaceholderText('Search status'), {
      target: { value: 'closed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Closed' }));

    expect(onClearSelection).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith('closed');
    expect(onSelectOption).toHaveBeenCalledWith('closed');

    rerender(
      <PqlComboboxView
        value={undefined}
        options={[]}
        placeholder="Choose status"
        searchPlaceholder="Search status"
        emptyText="No status"
        disabled={false}
        allowClear={false}
        open={false}
        query=""
        selectedOption={undefined}
        filteredOptions={[]}
        onClearSelection={onClearSelection}
        onOpenChange={onOpenChange}
        onQueryChange={onQueryChange}
        onSelectOption={onSelectOption}
      />
    );
    expect(screen.getByRole('combobox').textContent).toContain('Choose status');
    expect(container.querySelector('[data-action-id="pql.combobox.selection.clear"]')).toBeNull();
  });
});
