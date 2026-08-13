/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  open: false,
  setOpen: vi.fn(),
  pickerState: {} as Record<string, unknown>,
}));

vi.mock('@platejs/emoji', () => ({
  EmojiSettings: { perLine: { value: 2 }, buttonSize: { value: 32 } },
}));
vi.mock('@platejs/emoji/react', () => ({
  useEmojiDropdownMenuState: () => ({
    emojiPickerState: mocks.pickerState,
    isOpen: mocks.open,
    setIsOpen: mocks.setOpen,
  }),
}));
vi.mock('@radix-ui/react-popover', () => ({
  Root: ({ children, onOpenChange }: any) => (
    <div>
      <button type="button" onClick={() => onOpenChange(true)}>
        popover-open
      </button>
      {children}
    </div>
  ),
  Trigger: ({ children }: { children: ReactNode }) => children,
  Portal: ({ children }: { children: ReactNode }) => children,
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/shared/ui/layout', () => ({
  ToolbarButton: ({
    children,
    tooltip,
    pressed: _pressed,
    isDropdown: _isDropdown,
    ...props
  }: any) => (
    <button aria-label={tooltip} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/tooltip.tsx', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
}));

import { EmojiPicker, EmojiPopover, EmojiToolbarButton } from '../emoji-toolbar-button';

const wave = { id: 'wave', name: 'Wave', skins: [{ native: '👋' }] };
const smile = { id: 'smile', name: 'Smile', skins: [{ native: '🙂' }] };

function buildPickerProps(overrides: Record<string, unknown> = {}) {
  const rows = [{ id: 'row-1', elements: ['wave'] }];
  const sections = [{ id: 'activity' }, { id: 'flags' }];
  const section = {
    root: vi.fn(),
    getRows: () => rows,
  };
  return {
    clearSearch: vi.fn(),
    emoji: undefined,
    emojiLibrary: {
      getEmoji: (id: string) => (id === 'wave' ? wave : smile),
      getGrid: () => ({
        sections: () => sections,
        section: () => section,
      }),
    },
    focusedCategory: 'activity',
    hasFound: true,
    i18n: { categories: {}, searchResult: 'results' },
    isSearching: false,
    refs: { current: { contentRoot: vi.fn(), content: vi.fn() } },
    searchResult: [smile],
    searchValue: '',
    setSearch: vi.fn(),
    visibleCategories: new Map([
      ['activity', true],
      ['flags', false],
    ]),
    handleCategoryClick: vi.fn(),
    onMouseOver: vi.fn(),
    onSelectEmoji: vi.fn(),
    isOpen: true,
    setIsOpen: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.open = false;
  mocks.pickerState = buildPickerProps();
});
afterEach(cleanup);

describe('emoji toolbar branch campaign A02', () => {
  it('forwards default and custom settings through toolbar popover state', () => {
    const view = render(<EmojiToolbarButton />);
    fireEvent.click(screen.getByText('popover-open'));
    expect(mocks.setOpen).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'plateJs.toolbar.emoji' })).toBeTruthy();

    mocks.open = true;
    view.rerender(
      <EmojiToolbarButton
        options={{ settings: { perLine: { value: 2 }, buttonSize: { value: 32 } } } as never}
      />
    );
    expect(screen.getByRole('button', { name: 'plateJs.toolbar.emoji' })).toBeTruthy();
  });

  it('forwards popover changes independently', () => {
    const setIsOpen = vi.fn();
    render(
      <EmojiPopover control={<button>control</button>} isOpen={false} setIsOpen={setIsOpen}>
        picker
      </EmojiPopover>
    );
    fireEvent.click(screen.getByText('popover-open'));
    expect(setIsOpen).toHaveBeenCalledWith(true);
    expect(screen.getByText('picker')).toBeTruthy();
  });

  it('renders categories, visibility alternatives, navigation, search input and emoji events', () => {
    const props = buildPickerProps();
    const view = render(
      <EmojiPicker {...(props as unknown as ComponentProps<typeof EmojiPicker>)} />
    );
    expect(screen.getAllByText('plateJs.emoji.categories.activity')).toHaveLength(2);
    expect(screen.getAllByText('plateJs.emoji.categories.flags')).toHaveLength(2);
    expect(screen.getByText('plateJs.emoji.pickEmoji')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '👋' })).toHaveLength(1);

    const emojiButton = screen.getByRole('button', { name: '👋' });
    fireEvent.mouseEnter(emojiButton);
    fireEvent.mouseLeave(emojiButton);
    fireEvent.click(emojiButton);
    expect(props.onMouseOver).toHaveBeenCalledWith(wave);
    expect(props.onMouseOver).toHaveBeenCalledWith();
    expect(props.onSelectEmoji).toHaveBeenCalledWith(wave);

    fireEvent.click(screen.getByRole('button', { name: 'plateJs.emoji.categories.flags' }));
    expect(props.handleCategoryClick).toHaveBeenCalledWith('flags');
    fireEvent.change(screen.getByRole('textbox', { name: 'plateJs.emoji.search' }), {
      target: { value: 'new' },
    });
    expect(props.setSearch).toHaveBeenCalledWith('new');

    view.rerender(
      <EmojiPicker
        {...(buildPickerProps({
          visibleCategories: new Map(),
          icons: {
            categories: {
              activity: { outline: <span>A</span>, solid: <span>AS</span> },
              flags: { outline: <span>F</span>, solid: <span>FS</span> },
            },
            search: { loupe: <span>L</span>, delete: <span>D</span> },
          },
        }) as unknown as ComponentProps<typeof EmojiPicker>)}
      />
    );
    expect(screen.queryByRole('button', { name: '👋' })).toBeNull();
  });

  it('renders search results, clear control, not-found, preview and pick states', () => {
    const clearSearch = vi.fn();
    const select = vi.fn();
    const over = vi.fn();
    const view = render(
      <EmojiPicker
        {...(buildPickerProps({
          clearSearch,
          onSelectEmoji: select,
          onMouseOver: over,
          isSearching: true,
          hasFound: false,
          searchValue: 'x',
        }) as unknown as ComponentProps<typeof EmojiPicker>)}
      />
    );
    expect(screen.getByText('plateJs.emoji.searchResults')).toBeTruthy();
    expect(screen.getByText('plateJs.emoji.notFound')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'plateJs.emoji.clear' }));
    expect(clearSearch).toHaveBeenCalledOnce();
    const result = screen.getByRole('button', { name: '🙂' });
    fireEvent.mouseEnter(result);
    fireEvent.mouseLeave(result);
    fireEvent.click(result);
    expect(over).toHaveBeenCalledWith(smile);
    expect(select).toHaveBeenCalledWith(smile);

    view.rerender(
      <EmojiPicker
        {...(buildPickerProps({ emoji: wave, hasFound: true }) as unknown as ComponentProps<
          typeof EmojiPicker
        >)}
      />
    );
    expect(screen.getByText('Wave')).toBeTruthy();
    expect(screen.getByText(':wave:')).toBeTruthy();

    view.rerender(
      <EmojiPicker
        {...(buildPickerProps({
          isSearching: true,
          hasFound: true,
          emoji: undefined,
        }) as unknown as ComponentProps<typeof EmojiPicker>)}
      />
    );
    expect(screen.getByText('plateJs.emoji.pickEmoji')).toBeTruthy();

    view.rerender(
      <EmojiPicker
        {...(buildPickerProps({
          isSearching: true,
          hasFound: false,
          emoji: wave,
        }) as unknown as ComponentProps<typeof EmojiPicker>)}
      />
    );
    expect(screen.getByText('plateJs.emoji.notFound')).toBeTruthy();
    expect(screen.queryByText('Wave')).toBeNull();
  });
});
