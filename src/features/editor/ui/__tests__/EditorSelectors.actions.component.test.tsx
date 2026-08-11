/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditingModeSelectorView } from '../EditingModeSelectorView';
import { ModeSelector } from '../ModeSelector';
import { SuggestionViewToggleView } from '../SuggestionViewToggleView';

const toggleState = vi.hoisted(() => ({
  onValueChange: undefined as undefined | ((v: string) => void),
}));

vi.mock('@/features/shared/ui/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/command', () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandInput: (props: any) => <input aria-label={props.placeholder} />,
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  CommandList: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/toggle-group', () => ({
  ToggleGroup: ({ children, onValueChange }: any) => {
    toggleState.onValueChange = onValueChange;
    return <div>{children}</div>;
  },
  ToggleGroupItem: ({ children, value, ...props }: any) => (
    <button type="button" onClick={() => toggleState.onValueChange?.(value)} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/status', async importOriginal => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    EditingModeMenuItems: () => null,
  };
});

afterEach(cleanup);

const option = {
  crId: 'cr-1',
  displayCrId: 'CR-1',
  title: 'Improve text',
  userId: 'user-1',
  aliases: ['cr-1'],
};
const labels = {
  selectMode: 'Select',
  choiceMode: 'Choice',
  searchPlaceholder: 'Search',
  noResults: 'No results',
  allSuggestions: 'All suggestions',
  deselectAll: 'Deselect all',
  selectAll: 'Select all',
};

describe('editor selector action contracts', () => {
  it('dispatches automatic and unified mode selector intents', () => {
    const onModeChange = vi.fn(async () => undefined);
    const view = render(
      <EditingModeSelectorView currentMode="suggest_event" onModeChange={onModeChange} />
    );

    const automaticOpen = document.querySelector(
      '[data-action-id="editor.automatic-mode.open"]'
    ) as HTMLElement;
    const automaticChoices = document.querySelectorAll(
      '[data-action-id="editor.automatic-mode.select"]'
    );
    expect(automaticOpen).toBeTruthy();
    fireEvent.click(automaticChoices[1]);
    expect(onModeChange).toHaveBeenCalledWith('event_final_closing_vote');

    view.rerender(
      <ModeSelector
        entityType="document"
        entityId="document-1"
        currentMode="edit"
        isOwnerOrCollaborator
      />
    );
    const modeOpen = document.querySelector('[data-action-id="editor.mode.open"]') as HTMLElement;
    modeOpen.focus();
    expect(document.activeElement).toBe(modeOpen);
  });

  it('dispatches suggestion selection and choice intents', () => {
    const handlers = {
      onModeChange: vi.fn(),
      onSelectCr: vi.fn(),
      onToggleCr: vi.fn(),
      onSelectAll: vi.fn(),
      onDeselectAll: vi.fn(),
    };
    const baseProps = {
      selectedCrIds: null,
      open: true,
      onOpenChange: vi.fn(),
      crOptions: [option],
      isFiltered: false,
      buttonLabel: 'Suggestions',
      allSelected: false,
      labels,
      ...handlers,
    };
    const view = render(<SuggestionViewToggleView {...baseProps} filterMode="select" />);

    expect(document.querySelector('[data-action-id="editor.suggestion-filter.open"]')).toBeTruthy();
    fireEvent.click(
      document.querySelector('[data-action-id="editor.suggestion-filter.mode.choice"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="editor.suggestion-filter.selection.clear"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="editor.suggestion-filter.selection.select"]')!
    );
    expect(handlers.onModeChange).toHaveBeenCalledWith('choice');
    expect(handlers.onSelectCr).toHaveBeenNthCalledWith(1, null);
    expect(handlers.onSelectCr).toHaveBeenNthCalledWith(2, 'cr-1');

    view.rerender(<SuggestionViewToggleView {...baseProps} filterMode="choice" />);
    fireEvent.click(
      document.querySelector('[data-action-id="editor.suggestion-filter.choice.toggle-all"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="editor.suggestion-filter.choice.toggle"]')!
    );
    expect(handlers.onSelectAll).toHaveBeenCalledOnce();
    expect(handlers.onToggleCr).toHaveBeenCalledWith('cr-1');

    view.rerender(
      <SuggestionViewToggleView
        {...baseProps}
        filterMode="choice"
        isFiltered
        allSelected
        selectedCrIds={new Set(['cr-1'])}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="editor.suggestion-filter.choice.toggle-all"]')!
    );
    expect(handlers.onDeselectAll).toHaveBeenCalledOnce();
  });
});
