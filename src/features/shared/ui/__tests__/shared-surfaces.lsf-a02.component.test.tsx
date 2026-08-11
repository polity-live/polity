/* @vitest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  geo: vi.fn((props: unknown) => ({ marker: 'geo', props })),
  typeaheadProps: [] as Record<string, unknown>[],
}));

vi.mock('@tanstack/react-router', () => ({
  Link: React.forwardRef<HTMLAnchorElement, any>(({ children, to, ...props }, ref) => (
    <a ref={ref} href={to} {...props}>
      {children}
    </a>
  )),
  useRouter: () => ({ history: { back: mocks.back } }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('motion/react', () => ({
  MotionConfig: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/select.tsx', () => ({
  Select: ({ children, onValueChange }: any) => (
    <div>
      {children}
      <button onClick={() => onValueChange('time')}>choose-time</button>
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span>value</span>,
}));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, asChild: _asChild, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, asChild: _asChild, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/features/shared/ui/ui/input.tsx', () => ({
  Input: React.forwardRef<HTMLInputElement, any>((props, ref) => <input ref={ref} {...props} />),
}));
vi.mock('@/features/shared/ui/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, any>((props, ref) => <input ref={ref} {...props} />),
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuSeparator: () => <hr />,
}));
vi.mock('@/features/shared/ui/form/FormFieldShell', () => ({
  FormFieldShell: ({ children }: any) =>
    children({ id: 'search', describedBy: 'search-description', invalid: false }),
}));
vi.mock('@/features/shared/ui/layout/SurfaceDepthContext', () => ({
  useResolvedSurfaceMode: () => 'standalone',
}));
vi.mock('@/features/shared/ui/ui/empty', () => ({
  Empty: ({ children }: any) => <div>{children}</div>,
  EmptyContent: ({ children }: any) => <div>{children}</div>,
  EmptyDescription: ({ children }: any) => <div>{children}</div>,
  EmptyHeader: ({ children }: any) => <div>{children}</div>,
  EmptyTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/skeleton', () => ({ Skeleton: () => <div /> }));
vi.mock('@/features/shared/ui/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
}));
vi.mock('@tanstack/react-table', () => ({
  flexRender: (value: unknown) => String(value ?? ''),
}));
vi.mock('../form/useGeoAddressPickerController', () => ({
  useGeoAddressPickerController: mocks.geo,
}));
vi.mock('../form/GeoAddressPickerView', () => ({
  GeoAddressPickerView: (props: any) => <div data-testid="geo">{props.marker}</div>,
}));
vi.mock('platejs/react', () => ({
  Plate: ({ children, onChange }: any) => (
    <button onClick={() => onChange({ value: [] })}>{children}</button>
  ),
}));
vi.mock('@/features/shared/ui/layout/Toolbar', () => ({
  Toolbar: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui-platejs/editor', () => ({
  Editor: (props: any) => <div data-testid="editor" {...props} />,
  EditorContainer: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui-platejs/fixed-toolbar-buttons', () => ({
  FixedToolbarButtons: () => <div>toolbar</div>,
}));
vi.mock('@/features/shared/logic/entityCardHelpers', () => ({
  getEntityIcon: () => (props: any) => <i {...props} />,
}));
vi.mock('@/features/shared/logic/typeaheadHelpers', () => ({
  TYPEAHEAD_ENTITY_ORDER: ['group'],
  getTypeaheadEntityGroupLabel: (value: string) => value,
  groupResultsByType: (results: any[]) => ({ group: results }),
}));
vi.mock('../typeahead/TypeaheadResultCard', () => ({
  TypeaheadResultCard: (props: any) => {
    mocks.typeaheadProps.push(props);
    return (
      <button onClick={props.onClick} onMouseEnter={props.onMouseEnter}>
        result
      </button>
    );
  },
}));

import { useDisplayCurrencyStore } from '../../global-state/currency.store';
import { useMounted } from '../../hooks/use-mounted';
import { usePasswordFieldController } from '../../hooks/usePasswordFieldController';
import { MotionProvider } from '../../motion/MotionProvider';
import { CommentSortSelect } from '../action-buttons/CommentSortSelect';
import { ShareButtonView } from '../action-buttons/ShareButtonView';
import { DataTableView } from '../data-table/DataTableView';
import { NotFound } from '../feedback/NotFound';
import { NotFoundView } from '../feedback/NotFoundView';
import { GeoAddressPicker } from '../form/GeoAddressPicker';
import { InlineSwitch } from '../form/InlineSwitch';
import { SearchField } from '../form/SearchField';
import { SimpleRichTextEditorView } from '../form/SimpleRichTextEditorView';
import { ModeProvider, useModeContext } from '../kit-platejs/mode-context';
import { ActionToolbar } from '../layout/PageShell';
import { SmartLink, toRouterHref } from '../navigation/SmartLink';
import { EntitySearchBar } from '../typeahead/EntitySearchBar';
import { TypeaheadDropdown } from '../typeahead/TypeaheadDropdown';

afterEach(cleanup);

describe('A02 shared surface LSF contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.typeaheadProps.length = 0;
    useDisplayCurrencyStore.setState({ displayCurrency: 'EUR' });
  });

  it('executes stores and stateful shared hooks', () => {
    act(() => useDisplayCurrencyStore.getState().setDisplayCurrency('USD'));
    expect(useDisplayCurrencyStore.getState().displayCurrency).toBe('USD');

    const mounted = renderHook(() => useMounted());
    expect(mounted.result.current).toBe(true);

    const password = renderHook(() => usePasswordFieldController());
    act(() => password.result.current.onVisibilityToggle());
    expect(password.result.current.isVisible).toBe(true);
    act(() => password.result.current.onVisibilityToggle());
    expect(password.result.current.isVisible).toBe(false);

    const mode = renderHook(() => useModeContext(), {
      wrapper: ({ children }) => <ModeProvider currentMode="edit">{children}</ModeProvider>,
    });
    expect(mode.result.current.currentMode).toBe('edit');
  });

  it('renders provider, feedback, layout, and connected form facades', () => {
    const onChange = vi.fn();
    const view = render(
      <MotionProvider>
        <ActionToolbar>action</ActionToolbar>
        <NotFound />
        <GeoAddressPicker
          idPrefix="address"
          values={{} as never}
          onFieldChange={vi.fn()}
          labels={{} as never}
          placeholders={{} as never}
          coordinates={null}
          onCoordinatesChange={vi.fn()}
        />
        <InlineSwitch aria-label="inline" />
        <SimpleRichTextEditorView editor={{} as never} onChange={onChange} />
      </MotionProvider>
    );
    fireEvent.click(screen.getByText('pages.notFound.goBack'));
    expect(mocks.back).toHaveBeenCalledOnce();
    expect(screen.getByTestId('geo')).toBeTruthy();
    fireEvent.click(screen.getByTestId('editor').closest('button')!);
    expect(onChange).toHaveBeenCalledWith({ value: [] });

    view.rerender(
      <NotFoundView t={(key: string) => key} router={{ history: { back: mocks.back } }} />
    );
    expect(screen.getByText('404')).toBeTruthy();
  });

  it('executes selection, input, share, and filter callbacks', () => {
    const sort = vi.fn();
    const share = vi.fn();
    const search = vi.fn();
    const filter = vi.fn();
    const Icon = (props: any) => <i {...props} />;
    const view = render(<CommentSortSelect sortBy="votes" onSortChange={sort} />);
    fireEvent.click(screen.getByText('choose-time'));
    expect(sort).toHaveBeenCalledWith('time');

    view.rerender(
      <ShareButtonView
        url="/share"
        title="title"
        description="description"
        shareContextItem={null}
        renderConversationDialog={null}
        internalShareLabel="internal"
        variant="default"
        size="default"
        className=""
        t={(key: string) => key}
        copied={false}
        setCopied={vi.fn()}
        isOpen
        setIsOpen={vi.fn()}
        conversationDialogOpen={false}
        setConversationDialogOpen={vi.fn()}
        fullUrl="https://example.test/share"
        encodedUrl="encoded-url"
        encodedTitle="encoded-title"
        sharePlatforms={[]}
        directSharePlatforms={[{ key: 'direct', label: 'direct', Icon }]}
        manualSharePlatforms={[{ key: 'manual', label: 'manual', Icon }]}
        handleCopyUrl={vi.fn()}
        handleShare={share}
      />
    );
    fireEvent.click(screen.getByText('direct'));
    fireEvent.click(screen.getByText('manual'));
    fireEvent.click(screen.getByDisplayValue('https://example.test/share'));
    expect(share).toHaveBeenCalledTimes(2);

    view.rerender(
      <SearchField value="query" onValueChange={search} label="search" clearLabel="clear" />
    );
    fireEvent.click(screen.getByText('clear'));
    expect(search).toHaveBeenCalledWith('');

    view.rerender(
      <EntitySearchBar
        searchQuery="query"
        onSearchQueryChange={search}
        filterOptions={[{ label: 'groups', value: 'group', active: false }]}
        onFilterToggle={filter}
      />
    );
    fireEvent.click(screen.getByText('generated.inline.1132_clear_search_67300d0f'));
    fireEvent.click(screen.getByText('groups'));
    expect(filter).toHaveBeenCalledWith('group');
  });

  it('runs the table input and typeahead hover callbacks', () => {
    const setGlobalFilter = vi.fn();
    const table = {
      getHeaderGroups: () => [],
      getPageCount: () => 0,
      previousPage: vi.fn(),
      nextPage: vi.fn(),
      getCanPreviousPage: () => false,
      getCanNextPage: () => false,
    } as never;
    const view = render(
      <DataTableView
        isLoading={false}
        filter={{ placeholder: 'filter', value: '', onChange: vi.fn() }}
        filterPlaceholder="filter"
        table={table}
        rows={[]}
        globalFilter=""
        setGlobalFilter={setGlobalFilter}
        columnsLength={1}
        paginationEnabled={false}
        resolvedPreviousLabel="previous"
        resolvedNextLabel="next"
        resolvedEmptyTitle="empty"
        loadingRows={[]}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('filter'), { target: { value: 'updated' } });
    expect(setGlobalFilter).toHaveBeenCalledWith('updated');

    const select = vi.fn();
    const hover = vi.fn();
    view.rerender(
      <TypeaheadDropdown
        results={[{ id: 'group', entityType: 'group', label: 'Group' }] as never}
        query="g"
        selectedIndex={0}
        onSelect={select}
        onHoverIndex={hover}
      />
    );
    fireEvent.mouseEnter(screen.getByText('result'));
    expect(hover).toHaveBeenCalledWith(0);
  });

  it('executes the malformed absolute SmartLink catch path', () => {
    expect(toRouterHref('http://%')).toBeNull();
    render(<SmartLink href="/internal">internal</SmartLink>);
    expect(screen.getByText('internal').getAttribute('href')).toBe('/internal');
  });
});
