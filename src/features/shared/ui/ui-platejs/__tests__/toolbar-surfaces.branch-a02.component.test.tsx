/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  linkMode: false,
  aiOpen: false,
  listPressed: false,
  toggleList: vi.fn(),
  todoState: { active: true },
  todoProps: { 'aria-label': 'todo-list' },
  floatingStateInput: undefined as unknown,
  floatingResult: { clickOutsideRef: vi.fn(), hidden: false, props: {}, ref: vi.fn() },
  fixedClassName: 'viewport-class',
}));

vi.mock('@platejs/list', () => ({
  ListStyleType: {
    Disc: 'disc',
    Circle: 'circle',
    Square: 'square',
    Decimal: 'decimal',
    LowerAlpha: 'lower-alpha',
    UpperAlpha: 'upper-alpha',
    LowerRoman: 'lower-roman',
    UpperRoman: 'upper-roman',
  },
  someList: () => mocks.listPressed,
  toggleList: (...args: unknown[]) => mocks.toggleList(...args),
}));
vi.mock('@platejs/list/react', () => ({
  useIndentTodoToolBarButtonState: () => mocks.todoState,
  useIndentTodoToolBarButton: () => ({ props: mocks.todoProps }),
}));
vi.mock('@platejs/floating', () => ({
  offset: (value: number) => ({ kind: 'offset', value }),
  flip: (options: unknown) => ({ kind: 'flip', options }),
  useFloatingToolbarState: (input: unknown) => {
    mocks.floatingStateInput = input;
    return { resolved: true };
  },
  useFloatingToolbar: () => mocks.floatingResult,
}));
vi.mock('@udecode/cn', () => ({ useComposedRef: (...refs: unknown[]) => refs }));
vi.mock('platejs', () => ({ KEYS: { link: 'link', aiChat: 'aiChat' } }));
vi.mock('platejs/react', () => ({
  useEditorId: () => 'editor-1',
  useEventEditorValue: () => 'focused-1',
  usePluginOption: (plugin: { key: string }) =>
    plugin.key === 'link' ? mocks.linkMode : mocks.aiOpen,
  useEditorRef: () => ({ id: 'editor' }),
  useEditorSelector: (selector: (editor: unknown) => boolean) => selector({}),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/shared/hooks/useFixedToolbarController', () => ({
  useFixedToolbarController: () => ({ className: mocks.fixedClassName }),
}));
vi.mock('@/features/shared/ui/layout', () => ({
  Toolbar: ({ children, ...props }: any) => <div {...props}>{children}</div>,
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
  ToolbarMenuGroup: ({ children, label }: { children: ReactNode; label: string }) => (
    <section aria-label={label}>{children}</section>
  ),
  ToolbarSplitButton: ({ children, pressed }: { children: ReactNode; pressed: boolean }) => (
    <div data-pressed={pressed}>{children}</div>
  ),
  ToolbarSplitButtonPrimary: ({ children, ...props }: any) => (
    <button aria-label="primary" {...props}>
      {children}
    </button>
  ),
  ToolbarSplitButtonSecondary: (props: any) => <button aria-label="secondary" {...props} />,
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({ children, onOpenChange }: any) => (
    <div>
      <button onClick={() => onOpenChange?.(true)}>open-menu</button>
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, onSelect }: any) => (
    <button onClick={onClick ?? onSelect}>{children}</button>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => children,
  DropdownMenuRadioGroup: ({ children, onValueChange }: any) => (
    <div>
      <button onClick={() => onValueChange('right')}>change-align</button>
      {children}
    </div>
  ),
  DropdownMenuRadioItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
}));
vi.mock('../FixedToolbarView', () => ({
  FixedToolbarView: ({ className }: { className: string }) => (
    <div data-testid="fixed" className={className} />
  ),
}));

import { AlignToolbarButtonView } from '../AlignToolbarButtonView';
import { FixedToolbar } from '../fixed-toolbar';
import { InsertToolbarButtonView } from '../InsertToolbarButtonView';
import {
  BulletedListToolbarButton,
  NumberedListToolbarButton,
  TodoListToolbarButton,
} from '../list-toolbar-button';
import { SuggestionToolbarButtonView } from '../SuggestionToolbarButtonView';
import { useFloatingToolbarController } from '../useFloatingToolbarController';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.linkMode = false;
  mocks.aiOpen = false;
  mocks.listPressed = false;
});
afterEach(cleanup);

describe('toolbar surfaces branch campaign A02', () => {
  it('renders known and fallback alignment icons and forwards menu changes', () => {
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    const view = render(
      <AlignToolbarButtonView
        dropdownProps={{}}
        label="Align"
        open={false}
        onOpenChange={onOpenChange}
        value="center"
        onValueChange={onValueChange}
      />
    );
    fireEvent.click(screen.getByText('open-menu'));
    fireEvent.click(screen.getByText('change-align'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(onValueChange).toHaveBeenCalledWith('right');
    expect(view.container.querySelectorAll('[data-value]')).toHaveLength(4);
    view.rerender(
      <AlignToolbarButtonView
        dropdownProps={{}}
        label="Align"
        open
        onOpenChange={onOpenChange}
        value="unknown"
        onValueChange={onValueChange}
      />
    );
    expect(screen.getByRole('button', { name: 'Align' })).toBeTruthy();
  });

  it('selects insert items with and without refocusing the editor', () => {
    const focus = vi.fn();
    const onSelect = vi.fn();
    render(
      <InsertToolbarButtonView
        props={{}}
        editor={{ tf: { focus } }}
        t={(key: string) => key}
        open={false}
        setOpen={vi.fn()}
        groupsList={[
          {
            group: 'Insert',
            items: [
              { focusEditor: false, icon: null, label: 'No focus', value: 'a', onSelect },
              { icon: null, label: 'Focus', value: 'b', onSelect },
            ],
          },
        ]}
      />
    );
    fireEvent.click(screen.getByText('No focus'));
    expect(focus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Focus'));
    expect(focus).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(expect.anything(), 'a');
    expect(onSelect).toHaveBeenCalledWith(expect.anything(), 'b');
  });

  it('toggles suggestion mode and prevents mouse focus loss', () => {
    const setOption = vi.fn();
    const t = (key: string) => key;
    const view = render(
      <SuggestionToolbarButtonView setOption={setOption} isSuggesting={false} t={t} />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(setOption).toHaveBeenCalledWith('isSuggesting', true);
    expect(fireEvent.mouseDown(screen.getByRole('button'))).toBe(false);
    view.rerender(<SuggestionToolbarButtonView setOption={setOption} isSuggesting t={t} />);
    expect(screen.getByRole('button').className).toContain('text-brand');
    fireEvent.click(screen.getByRole('button'));
    expect(setOption).toHaveBeenLastCalledWith('isSuggesting', false);
  });

  it('renders viewport default and explicit contained fixed toolbar', () => {
    const view = render(<FixedToolbar className="custom" />);
    expect(screen.getByTestId('fixed').className).toBe('viewport-class');
    view.rerender(<FixedToolbar positionMode="container" className="custom" />);
    expect(screen.getByTestId('fixed').className).toContain('custom');
  });

  it('builds floating state for default/custom options and both hide modes', () => {
    const { result, rerender } = renderHook(
      ({ state }) => useFloatingToolbarController({ children: 'x', state } as never),
      { initialProps: { state: undefined as any } }
    );
    expect(mocks.floatingStateInput).toMatchObject({ hideToolbar: false, editorId: 'editor-1' });
    expect(result.current.hidden).toBe(false);

    mocks.linkMode = true;
    rerender({ state: { floatingOptions: { placement: 'bottom' }, custom: 'value' } as any });
    expect(mocks.floatingStateInput).toMatchObject({
      hideToolbar: true,
      custom: 'value',
      floatingOptions: { placement: 'bottom' },
    });
    mocks.linkMode = false;
    mocks.aiOpen = true;
    rerender({ state: undefined });
    expect(mocks.floatingStateInput).toMatchObject({ hideToolbar: true });
  });

  it('runs every bulleted and numbered list action and reflects pressed state', () => {
    const bulleted = render(<BulletedListToolbarButton />);
    fireEvent.click(screen.getByRole('button', { name: 'plateJs.toolbar.bulletedList' }));
    expect(
      screen.getByRole('button', {
        name: 'plateJs.toolbar.bulletedList: plateJs.toolbar.more',
      })
    ).toBeTruthy();
    for (const label of [
      'plateJs.toolbar.listTypes.bulleted.default',
      'plateJs.toolbar.listTypes.bulleted.circle',
      'plateJs.toolbar.listTypes.bulleted.square',
    ]) {
      fireEvent.click(screen.getByText(label));
    }
    expect(mocks.toggleList).toHaveBeenCalledTimes(4);
    mocks.listPressed = true;
    bulleted.rerender(<BulletedListToolbarButton />);
    expect(
      screen
        .getByRole('button', { name: 'plateJs.toolbar.bulletedList' })
        .getAttribute('data-state')
    ).toBe('on');
    bulleted.unmount();

    mocks.listPressed = false;
    const numbered = render(<NumberedListToolbarButton />);
    fireEvent.click(screen.getByRole('button', { name: 'plateJs.toolbar.numberedList' }));
    for (const label of ['decimal', 'lowerAlpha', 'upperAlpha', 'lowerRoman', 'upperRoman']) {
      fireEvent.click(screen.getByText(`plateJs.toolbar.listTypes.${label}`));
    }
    expect(
      screen
        .getByRole('button', { name: 'plateJs.toolbar.numberedList' })
        .getAttribute('data-state')
    ).toBe('off');
    expect(mocks.toggleList).toHaveBeenCalledTimes(10);
    mocks.listPressed = true;
    numbered.rerender(<NumberedListToolbarButton />);
    expect(
      screen
        .getByRole('button', { name: 'plateJs.toolbar.numberedList' })
        .getAttribute('data-state')
    ).toBe('on');
    numbered.unmount();

    render(<TodoListToolbarButton data-extra="yes" />);
    expect(screen.getByRole('button', { name: 'todo-list' }).getAttribute('data-extra')).toBe(
      'yes'
    );
  });
});
