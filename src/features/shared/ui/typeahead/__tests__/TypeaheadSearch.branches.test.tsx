// @vitest-environment jsdom

import * as React from 'react';

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hook: vi.fn(),
  renderRefs: true,
  renderWrapper: true,
  viewProps: undefined as any,
}));

vi.mock('@/features/shared/hooks/useTypeaheadSearch', () => ({
  useTypeaheadSearch: (options: unknown) => mocks.hook(options),
}));

vi.mock('../TypeaheadSearchBaseView', () => ({
  TypeaheadSearchBaseView: (props: any) => {
    mocks.viewProps = props;
    if (!mocks.renderRefs) return null;
    return (
      <div ref={props.containerRef} data-testid="container" tabIndex={-1}>
        {mocks.renderWrapper ? (
          <div ref={props.inputWrapperRef} data-testid="wrapper">
            <input ref={props.inputRef} aria-label="typeahead" />
          </div>
        ) : null}
        <div ref={props.dropdownPortalRef} data-testid="dropdown" />
      </div>
    );
  },
}));

import {
  TypeaheadCombobox,
  TypeaheadSearch,
  TypeaheadSearchBaseContainer,
} from '../TypeaheadSearch';

const items = [
  {
    avatar: 'ada.png',
    description: 'First programmer',
    entityType: 'user' as const,
    id: 'ada',
    label: 'Ada',
    secondaryLabel: 'Lovelace',
    url: '/ada',
  },
  { entityType: 'user' as const, id: 'grace', label: 'Grace' },
];

function single(overrides: Record<string, unknown> = {}) {
  return {
    onChange: vi.fn(),
    query: '',
    searchResults: items,
    setQuery: vi.fn(),
    sourceItems: items,
    value: undefined,
    ...overrides,
  } as any;
}

function event(key: string) {
  return { key, preventDefault: vi.fn() } as any;
}

describe('TypeaheadSearch branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.renderRefs = true;
    mocks.renderWrapper = true;
    mocks.hook.mockReturnValue({ items, query: '', results: items, setQuery: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('uses the data facade with default and explicit entity types', () => {
    const first = render(<TypeaheadSearch value={undefined} onChange={vi.fn()} />);
    expect(mocks.hook).toHaveBeenCalledWith({ entityTypes: [] });
    expect(mocks.viewProps.visibleResults).toEqual(items);
    first.unmount();

    render(<TypeaheadSearch entityTypes={['group']} value={undefined} onChange={vi.fn()} />);
    expect(mocks.hook).toHaveBeenLastCalledWith({ entityTypes: ['group'] });
  });

  it('uses provided items in the combobox and updates its local query', () => {
    render(<TypeaheadCombobox items={items} value={undefined} onChange={vi.fn()} />);
    expect(mocks.viewProps.visibleResults).toHaveLength(2);
    act(() => mocks.viewProps.setQuery('grace'));
    expect(mocks.viewProps.query).toBe('grace');
    expect(mocks.viewProps.visibleResults.map((item: any) => item.id)).toEqual(['grace']);
  });

  it('refreshes known item fields and preserves selected items absent from the source', () => {
    const view = render(
      <TypeaheadSearchBaseContainer {...single({ sourceItems: items, value: 'ada' })} />
    );
    expect(mocks.viewProps.selectedItem.id).toBe('ada');

    view.rerender(
      <TypeaheadSearchBaseContainer
        {...single({ sourceItems: [{ ...items[0] }], searchResults: items, value: 'ada' })}
      />
    );

    const changed = {
      ...items[0],
      avatar: 'new.png',
      description: 'New description',
      label: 'Ada Updated',
      secondaryLabel: 'New secondary',
      url: '/new',
    };
    view.rerender(
      <TypeaheadSearchBaseContainer
        {...single({ searchResults: [changed], sourceItems: [changed], value: 'ada' })}
      />
    );
    expect(mocks.viewProps.selectedItem.label).toBe('Ada Updated');

    const secondaryChanged = { ...changed, secondaryLabel: 'Another secondary' };
    view.rerender(
      <TypeaheadSearchBaseContainer
        {...single({
          searchResults: [secondaryChanged],
          sourceItems: [secondaryChanged],
          value: 'ada',
        })}
      />
    );
    const descriptionChanged = { ...secondaryChanged, description: 'Another description' };
    view.rerender(
      <TypeaheadSearchBaseContainer
        {...single({
          searchResults: [descriptionChanged],
          sourceItems: [descriptionChanged],
          value: 'ada',
        })}
      />
    );
    const avatarChanged = { ...descriptionChanged, avatar: 'third.png' };
    view.rerender(
      <TypeaheadSearchBaseContainer
        {...single({ searchResults: [avatarChanged], sourceItems: [avatarChanged], value: 'ada' })}
      />
    );
    const urlChanged = { ...avatarChanged, url: '/third' };
    view.rerender(
      <TypeaheadSearchBaseContainer
        {...single({ searchResults: [urlChanged], sourceItems: [urlChanged], value: 'ada' })}
      />
    );

    view.rerender(
      <TypeaheadSearchBaseContainer
        {...single({ searchResults: [], sourceItems: [], value: 'ada' })}
      />
    );
    expect(mocks.viewProps.selectedItem.label).toBe('Ada Updated');
  });

  it('filters, excludes multi selections, shows all on focus, and truncates previews', () => {
    const many = Array.from({ length: 25 }, (_, index) => ({
      entityType: 'user' as const,
      id: `item-${index}`,
      label: `Item ${index}`,
    }));
    const view = render(
      <TypeaheadSearchBaseContainer
        {...single({
          filterFn: (item: any) => item.id !== 'item-2',
          multiple: true,
          onValuesChange: vi.fn(),
          query: '',
          searchResults: [],
          showAllOnFocus: true,
          sourceItems: many,
          values: ['item-0'],
        })}
      />
    );
    expect(mocks.viewProps.visibleResults).toHaveLength(20);
    expect(mocks.viewProps.visibleResults.some((item: any) => item.id === 'item-0')).toBe(false);
    expect(mocks.viewProps.selectedItems).toHaveLength(1);
    expect(mocks.viewProps.selectedItem).toBeNull();

    view.rerender(
      <TypeaheadSearchBaseContainer
        {...single({
          multiple: true,
          onValuesChange: vi.fn(),
          query: 'query',
          searchResults: many,
          showAllOnFocus: true,
          showAllResults: true,
          sourceItems: many,
          values: [],
        })}
      />
    );
    expect(mocks.viewProps.visibleResults).toHaveLength(25);
  });

  it('handles missing single selections and empty result index state', () => {
    const view = render(
      <TypeaheadSearchBaseContainer
        {...single({ searchResults: [], sourceItems: [], value: 'missing' })}
      />
    );
    expect(mocks.viewProps.selectedItem).toBeNull();
    expect(mocks.viewProps.selectedIndex).toBe(0);
    view.rerender(
      <TypeaheadSearchBaseContainer
        {...single({ searchResults: items, sourceItems: items, value: undefined })}
      />
    );
    expect(mocks.viewProps.selectedItem).toBeNull();
  });

  it('selects and removes single items, keeps focus, and supports optional interaction', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onInteract = vi.fn();
    const setQuery = vi.fn();
    render(<TypeaheadSearchBaseContainer {...single({ onChange, onInteract, setQuery })} />);
    act(() => mocks.viewProps.handleSelect(items[0]));
    expect(onInteract).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(items[0]);
    expect(setQuery).toHaveBeenCalledWith('');
    act(() => vi.runAllTimers());

    act(() => mocks.viewProps.handleRemoveSelection('ada'));
    expect(onChange).toHaveBeenLastCalledWith(null);

    const withoutChange = render(
      <TypeaheadSearchBaseContainer {...single({ onChange: undefined })} />
    );
    act(() => mocks.viewProps.handleSelect(items[0]));
    act(() => mocks.viewProps.handleRemoveSelection('ada'));
    withoutChange.unmount();
  });

  it('selects and removes multiple values and ignores disabled actions', () => {
    const onValuesChange = vi.fn();
    const view = render(
      <TypeaheadSearchBaseContainer
        {...single({
          multiple: true,
          onValuesChange,
          values: ['ada'],
        })}
      />
    );
    act(() => mocks.viewProps.handleSelect(items[1]));
    expect(onValuesChange).toHaveBeenLastCalledWith(['ada', 'grace']);
    act(() => mocks.viewProps.handleRemoveSelection('ada'));
    expect(onValuesChange).toHaveBeenLastCalledWith([]);

    view.rerender(
      <TypeaheadSearchBaseContainer
        {...single({ disabled: true, multiple: true, onValuesChange, values: [] })}
      />
    );
    const calls = onValuesChange.mock.calls.length;
    act(() => mocks.viewProps.handleSelect(items[0]));
    act(() => mocks.viewProps.handleRemoveSelection('ada'));
    expect(onValuesChange).toHaveBeenCalledTimes(calls);
  });

  it('opens and navigates from the keyboard, selects, escapes, and ignores other keys', () => {
    const onChange = vi.fn();
    render(<TypeaheadSearchBaseContainer {...single({ onChange })} />);

    const open = event('ArrowDown');
    act(() => mocks.viewProps.handleKeyDown(open));
    expect(mocks.viewProps.isOpen).toBe(true);

    const down = event('ArrowDown');
    act(() => mocks.viewProps.handleKeyDown(down));
    expect(down.preventDefault).toHaveBeenCalled();
    expect(mocks.viewProps.selectedIndex).toBe(1);

    const up = event('ArrowUp');
    act(() => mocks.viewProps.handleKeyDown(up));
    expect(mocks.viewProps.selectedIndex).toBe(0);

    const enter = event('Enter');
    act(() => mocks.viewProps.handleKeyDown(enter));
    expect(onChange).toHaveBeenCalledWith(items[0]);

    act(() => mocks.viewProps.setIsOpen(true));
    const escape = event('Escape');
    act(() => mocks.viewProps.handleKeyDown(escape));
    expect(mocks.viewProps.isOpen).toBe(false);

    const other = event('Tab');
    act(() => mocks.viewProps.handleKeyDown(other));
    expect(other.preventDefault).not.toHaveBeenCalled();
  });

  it('opens on Enter and ignores keyboard input while disabled', () => {
    const view = render(<TypeaheadSearchBaseContainer {...single()} />);
    act(() => mocks.viewProps.handleKeyDown(event('Enter')));
    expect(mocks.viewProps.isOpen).toBe(true);
    view.rerender(<TypeaheadSearchBaseContainer {...single({ disabled: true })} />);
    act(() => mocks.viewProps.handleKeyDown(event('ArrowDown')));
    expect(mocks.viewProps.isOpen).toBe(false);
  });

  it('closes on outside clicks but not container or dropdown clicks', () => {
    render(<TypeaheadSearchBaseContainer {...single()} />);
    act(() => mocks.viewProps.setIsOpen(true));
    fireEvent.mouseDown(document.querySelector('[data-testid="container"]')!);
    expect(mocks.viewProps.isOpen).toBe(true);
    fireEvent.mouseDown(document.querySelector('[data-testid="dropdown"]')!);
    expect(mocks.viewProps.isOpen).toBe(true);
    fireEvent.mouseDown(document.body);
    expect(mocks.viewProps.isOpen).toBe(false);
  });

  it('positions portals against the body and a dialog and disables portals explicitly', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue({
      bottom: 50,
      height: 40,
      left: 20,
      right: 120,
      top: 10,
      width: 100,
      x: 20,
      y: 10,
      toJSON: () => ({}),
    });
    const body = render(<TypeaheadSearchBaseContainer {...single()} />);
    act(() => mocks.viewProps.setIsOpen(true));
    expect(mocks.viewProps.portalTarget).toBe(document.body);
    expect(mocks.viewProps.dropdownStyle.width).toBe(100);
    fireEvent.scroll(window);
    fireEvent.resize(window);
    body.unmount();

    render(
      <div data-slot="dialog-content">
        <TypeaheadSearchBaseContainer {...single()} />
      </div>
    );
    act(() => mocks.viewProps.setIsOpen(true));
    expect(mocks.viewProps.portalTarget?.getAttribute('data-slot')).toBe('dialog-content');
    expect(mocks.viewProps.dropdownStyle.width).toBe(100);
    cleanup();

    render(<TypeaheadSearchBaseContainer {...single({ disablePortal: true })} />);
    act(() => mocks.viewProps.setIsOpen(true));
    expect(mocks.viewProps.portalTarget).toBeNull();
  });

  it('falls back to the body when the view does not attach a container ref', () => {
    mocks.renderRefs = false;
    render(<TypeaheadSearchBaseContainer {...single()} />);
    expect(mocks.viewProps.portalTarget).toBe(document.body);
    act(() => mocks.viewProps.setIsOpen(true));
    expect(mocks.viewProps.isOpen).toBe(true);
  });

  it('falls back from a missing input wrapper to the container', () => {
    mocks.renderWrapper = false;
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue({
      bottom: 20,
      height: 10,
      left: 5,
      right: 35,
      top: 10,
      width: 30,
      x: 5,
      y: 10,
      toJSON: () => ({}),
    });
    render(<TypeaheadSearchBaseContainer {...single()} />);
    act(() => mocks.viewProps.setIsOpen(true));
    expect(mocks.viewProps.dropdownStyle.width).toBe(30);
  });
});
