// @vitest-environment jsdom

import * as React from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  activeId: null as string | null,
  before: vi.fn(),
  comboboxInputOptions: undefined as any,
  comboboxProviderProps: undefined as any,
  contextStore: undefined as any,
  filterWords: vi.fn((keyword: string, search: string) =>
    keyword.toLowerCase().includes(search.toLowerCase())
  ),
  findPath: vi.fn(),
  first: vi.fn(() => 'first-item'),
  insertText: vi.fn(),
  items: [] as unknown[],
  move: vi.fn(),
  pointRef: vi.fn(),
  removeInput: vi.fn(),
  setActiveId: vi.fn(),
  setValueConfig: undefined as ((value: string) => void) | undefined,
  storeValue: '',
  unref: vi.fn(),
}));

vi.mock('@ariakit/react', () => ({
  Combobox: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    function MockCombobox(props, ref) {
      return <input ref={ref} aria-label="combobox" {...props} />;
    }
  ),
  ComboboxGroup: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="group" {...props}>
      {children}
    </div>
  ),
  ComboboxGroupLabel: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="group-label" {...props}>
      {children}
    </div>
  ),
  ComboboxItem: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" role="option" {...props}>
      {children}
    </button>
  ),
  ComboboxPopover: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="popover" {...props}>
      {children}
    </div>
  ),
  ComboboxProvider: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    mocks.comboboxProviderProps = props;
    return <div data-testid="provider">{children}</div>;
  },
  ComboboxRow: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="row" {...props}>
      {children}
    </div>
  ),
  Portal: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useComboboxContext: () => mocks.contextStore,
  useComboboxStore: (options: { setValue: (value: string) => void }) => {
    mocks.setValueConfig = options.setValue;
    return {
      first: mocks.first,
      getState: () => ({ activeId: mocks.activeId }),
      setActiveId: mocks.setActiveId,
      useState: (key: string) => (key === 'items' ? mocks.items : mocks.storeValue),
    };
  },
}));

vi.mock('@platejs/combobox', () => ({ filterWords: mocks.filterWords }));

vi.mock('@platejs/combobox/react', () => ({
  useComboboxInput: (options: unknown) => {
    mocks.comboboxInputOptions = options;
    return { props: { 'data-input-prop': 'yes' }, removeInput: mocks.removeInput };
  },
  useHTMLInputCursorState: () => ({ cursor: true }),
}));

vi.mock('class-variance-authority', () => ({
  cva: (base: string) => (options?: { interactive?: boolean }) =>
    `${base}${options?.interactive === false ? ' non-interactive' : ' interactive'}`,
}));

vi.mock('platejs/react', () => ({
  useComposedRef:
    (...refs: (React.Ref<HTMLInputElement> | undefined)[]) =>
    (node: HTMLInputElement | null) => {
      for (const ref of refs) {
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    },
  useEditorRef: () => ({
    api: {
      before: mocks.before,
      findPath: mocks.findPath,
      pointRef: mocks.pointRef,
    },
    tf: { insertText: mocks.insertText, move: mocks.move },
  }),
}));

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
  InlineComboboxRow,
} from '../InlineCombobox';

const element = { type: 'combobox', children: [{ text: '' }] } as any;

function renderCombobox(
  children: React.ReactNode,
  props: Partial<React.ComponentProps<typeof InlineCombobox>> = {}
) {
  return render(
    <InlineCombobox element={element} trigger="@" {...props}>
      {children}
    </InlineCombobox>
  );
}

describe('InlineCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeId = null;
    mocks.before.mockReturnValue({ path: [0], offset: 0 });
    mocks.contextStore = {
      useState: (key: string) => (key === 'items' ? mocks.items : mocks.storeValue),
    };
    mocks.findPath.mockReturnValue([0]);
    mocks.items = [];
    mocks.pointRef.mockReturnValue({ current: { path: [0], offset: 0 }, unref: mocks.unref });
    mocks.storeValue = '';
  });

  afterEach(cleanup);

  it('tracks the insertion point and handles every cancellation cause', () => {
    const view = renderCombobox(<InlineComboboxInput />, { value: 'Ada' });

    expect(mocks.setActiveId).toHaveBeenCalledWith('first-item');
    expect(mocks.comboboxProviderProps.open).toBe(false);

    act(() => mocks.comboboxInputOptions.onCancelInput('backspace'));
    expect(mocks.insertText).not.toHaveBeenCalled();

    act(() => mocks.comboboxInputOptions.onCancelInput('arrowLeft'));
    expect(mocks.insertText).toHaveBeenLastCalledWith('@Ada', {
      at: { path: [0], offset: 0 },
    });
    expect(mocks.move).toHaveBeenLastCalledWith({ distance: 1, reverse: true });

    act(() => mocks.comboboxInputOptions.onCancelInput('arrowRight'));
    expect(mocks.move).toHaveBeenLastCalledWith({ distance: 1, reverse: false });

    act(() => mocks.comboboxInputOptions.onCancelInput('escape'));
    expect(mocks.insertText).toHaveBeenCalledTimes(3);
    expect(mocks.move).toHaveBeenCalledTimes(2);

    view.unmount();
    expect(mocks.unref).toHaveBeenCalledOnce();
  });

  it('supports missing editor locations and controlled and uncontrolled values', () => {
    mocks.findPath.mockReturnValue(undefined);
    const first = renderCombobox(<span>missing path</span>);
    act(() => mocks.setValueConfig?.('local'));
    act(() => mocks.comboboxInputOptions.onCancelInput('escape'));
    expect(mocks.insertText).toHaveBeenLastCalledWith('@local', { at: undefined });
    first.unmount();

    mocks.findPath.mockReturnValue([0]);
    mocks.before.mockReturnValue(undefined);
    mocks.pointRef.mockClear();
    const setValue = vi.fn();
    renderCombobox(<span>missing point</span>, { setValue, value: 'controlled' });
    act(() => mocks.setValueConfig?.('next'));
    expect(setValue).toHaveBeenCalledWith('next');
    expect(mocks.pointRef).not.toHaveBeenCalled();
  });

  it('computes open state for items, empty content, and hidden empty values', () => {
    mocks.items = ['item'];
    mocks.activeId = 'already-active';
    const withItems = renderCombobox(<span>items</span>, { hideWhenNoValue: true, value: 'x' });
    expect(mocks.comboboxProviderProps.open).toBe(true);
    expect(mocks.setActiveId).not.toHaveBeenCalled();
    withItems.unmount();

    mocks.items = [];
    renderCombobox(<InlineComboboxEmpty>Nothing</InlineComboboxEmpty>, {
      hideWhenNoValue: true,
      value: '',
    });
    expect(screen.getByText('Nothing')).toBeTruthy();
    expect(mocks.comboboxProviderProps.open).toBe(false);
  });

  it('renders inputs with and without triggers and composes refs', () => {
    const externalRef = React.createRef<HTMLInputElement>();
    mocks.storeValue = 'query';
    const first = renderCombobox(
      <InlineComboboxInput ref={externalRef} className="custom-input" data-extra="value" />
    );
    expect(screen.getByText('@')).toBeTruthy();
    expect((screen.getByLabelText('combobox') as HTMLInputElement).value).toBe('query');
    expect(externalRef.current).toBe(screen.getByLabelText('combobox'));
    first.unmount();

    mocks.contextStore = undefined;
    renderCombobox(<InlineComboboxInput />, { showTrigger: false });
    expect(screen.queryByText('@')).toBeNull();
    expect((screen.getByLabelText('combobox') as HTMLInputElement).value).toBe('');
  });

  it('filters items and preserves click behavior', () => {
    mocks.storeValue = 'ada';
    const onClick = vi.fn();
    const first = renderCombobox(
      <InlineComboboxItem
        className="custom-item"
        group="people"
        keywords={['mathematician', '']}
        label="Ada Lovelace"
        value="ada"
        onClick={onClick}
      >
        Ada
      </InlineComboboxItem>
    );
    fireEvent.click(screen.getByRole('option'));
    expect(mocks.removeInput).toHaveBeenCalledWith(true);
    expect(onClick).toHaveBeenCalledOnce();
    expect(mocks.filterWords).toHaveBeenCalled();
    first.unmount();

    mocks.storeValue = 'missing';
    renderCombobox(<InlineComboboxItem value="ada">Hidden</InlineComboboxItem>);
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('allows unfiltered items and optional click callbacks', () => {
    renderCombobox(<InlineComboboxItem value="always" focusEditor={false} />, { filter: false });
    fireEvent.click(screen.getByRole('option'));
    expect(mocks.removeInput).toHaveBeenCalledWith(false);
  });

  it('renders empty, content, row, and group primitives in both visibility states', () => {
    mocks.items = ['item'];
    const view = renderCombobox(
      <>
        <InlineComboboxEmpty>Hidden empty</InlineComboboxEmpty>
        <InlineComboboxContent className="content">Content</InlineComboboxContent>
        <InlineComboboxRow>Row</InlineComboboxRow>
        <InlineComboboxGroup className="group-class">Group</InlineComboboxGroup>
        <InlineComboboxGroupLabel className="label-class">Label</InlineComboboxGroupLabel>
      </>
    );

    expect(screen.queryByText('Hidden empty')).toBeNull();
    expect(screen.getByTestId('popover').className).toContain('content');
    expect(screen.getByTestId('row').textContent).toBe('Row');
    expect(screen.getByTestId('group').className).toContain('group-class');
    expect(screen.getByTestId('group-label').className).toContain('label-class');

    view.unmount();
    expect(mocks.comboboxProviderProps.open).toBe(true);
  });
});
