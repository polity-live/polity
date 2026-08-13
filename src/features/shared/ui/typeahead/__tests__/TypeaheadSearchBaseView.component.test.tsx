// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dropdownProps: undefined as any,
  inputProps: undefined as any,
  selectedCardProps: [] as any[],
}));

vi.mock('@/features/shared/ui/ui/input', async () => {
  const ReactModule = await import('react');
  return {
    Input: ReactModule.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
      (props, ref) => {
        mocks.inputProps = props;
        return <input ref={ref} data-testid="input" {...props} />;
      }
    ),
  };
});

vi.mock('../TypeaheadDropdown', () => ({
  TypeaheadDropdown: (props: any) => {
    mocks.dropdownProps = props;
    return <div data-testid="dropdown-content" />;
  },
}));

vi.mock('../TypeaheadSelectedCard', () => ({
  TypeaheadSelectedCard: (props: any) => {
    const index = mocks.selectedCardProps.push(props) - 1;
    return (
      <div data-testid={`selected-${props.variant}-${props.item.id}`}>
        <button data-testid={`open-${index}`} onClick={props.onClick} />
        <button data-testid={`remove-${index}`} onClick={props.onRemove} />
      </div>
    );
  },
}));

import {
  TypeaheadSearchBaseView,
  type TypeaheadSearchBaseViewProps,
} from '../TypeaheadSearchBaseView';

const ada = { entityType: 'user', id: 'ada', label: 'Ada' };
const grace = { entityType: 'user', id: 'grace', label: 'Grace' };

function props(overrides: Partial<TypeaheadSearchBaseViewProps> = {}) {
  return {
    ariaRequired: false,
    className: 'custom-class',
    containerRef: React.createRef<HTMLDivElement>(),
    disablePortal: false,
    disabled: false,
    dropdownPortalRef: React.createRef<HTMLDivElement>(),
    dropdownStyle: { left: 20, top: 10, width: 100 },
    handleKeyDown: vi.fn(),
    handleRemoveSelection: vi.fn(),
    handleSelect: vi.fn(),
    inputRef: React.createRef<HTMLInputElement>(),
    inputWrapperRef: React.createRef<HTMLDivElement>(),
    isOpen: false,
    label: null,
    multiple: false,
    onInteract: undefined,
    placeholder: 'Search',
    portalTarget: null,
    query: '',
    selectedIndex: 0,
    selectedItem: null,
    selectedItems: [],
    setIsOpen: vi.fn(),
    setQuery: vi.fn(),
    setSelectedIndex: vi.fn(),
    visibleResults: [ada],
    ...overrides,
  } as TypeaheadSearchBaseViewProps;
}

describe('TypeaheadSearchBaseView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dropdownProps = undefined;
    mocks.inputProps = undefined;
    mocks.selectedCardProps = [];
  });

  afterEach(() => cleanup());

  it('renders and drives the enabled input with its optional interaction callback', () => {
    const onInteract = vi.fn();
    const viewProps = props({ ariaRequired: true, label: 'Person', onInteract });
    const { container } = render(<TypeaheadSearchBaseView {...viewProps} />);

    expect(screen.getByText('Person')).toBeTruthy();
    expect(container.firstElementChild?.className).toContain('custom-class');
    expect(mocks.inputProps['aria-required']).toBe(true);

    fireEvent.change(screen.getByTestId('input'), { target: { value: 'Ada' } });
    expect(onInteract).toHaveBeenCalledTimes(1);
    expect(viewProps.setQuery).toHaveBeenCalledWith('Ada');
    expect(viewProps.setIsOpen).toHaveBeenCalledWith(true);
    expect(viewProps.setSelectedIndex).toHaveBeenCalledWith(0);

    fireEvent.focus(screen.getByTestId('input'));
    expect(onInteract).toHaveBeenCalledTimes(2);
    expect(viewProps.setIsOpen).toHaveBeenCalledTimes(2);
  });

  it('keeps disabled input handlers inert and supports an absent interaction callback', () => {
    const disabled = props({ disabled: true });
    const { container, rerender } = render(<TypeaheadSearchBaseView {...disabled} />);
    expect(container.firstElementChild?.className).toContain('opacity-60');
    expect(mocks.inputProps['aria-required']).toBeUndefined();

    mocks.inputProps.onChange({ target: { value: 'ignored' } });
    mocks.inputProps.onFocus();
    expect(disabled.setQuery).not.toHaveBeenCalled();
    expect(disabled.setIsOpen).not.toHaveBeenCalled();

    const enabled = props();
    rerender(<TypeaheadSearchBaseView {...enabled} />);
    mocks.inputProps.onChange({ target: { value: 'used' } });
    mocks.inputProps.onFocus();
    expect(enabled.setQuery).toHaveBeenCalledWith('used');
    expect(enabled.setIsOpen).toHaveBeenCalledWith(true);
  });

  it('renders compact and stacked selections and delegates their actions', () => {
    const viewProps = props({
      multiple: true,
      selectedItem: ada,
      selectedItems: [ada, grace],
    });
    const { container } = render(<TypeaheadSearchBaseView {...viewProps} />);

    expect(container.firstElementChild?.className).toContain('space-y-3');
    expect(screen.getByTestId('selected-compact-ada')).toBeTruthy();
    expect(screen.getByTestId('selected-stacked-grace')).toBeTruthy();

    fireEvent.click(screen.getByTestId('open-0'));
    fireEvent.click(screen.getByTestId('open-2'));
    expect(viewProps.setIsOpen).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId('remove-0'));
    fireEvent.click(screen.getByTestId('remove-2'));
    expect(viewProps.handleRemoveSelection).toHaveBeenNthCalledWith(1, 'ada');
    expect(viewProps.handleRemoveSelection).toHaveBeenNthCalledWith(2, 'grace');
  });

  it('does not open disabled selections and displays the input while already open', () => {
    const disabled = props({
      disabled: true,
      multiple: true,
      selectedItem: ada,
      selectedItems: [grace],
    });
    const view = render(<TypeaheadSearchBaseView {...disabled} />);
    fireEvent.click(screen.getByTestId('open-0'));
    fireEvent.click(screen.getByTestId('open-1'));
    expect(disabled.setIsOpen).not.toHaveBeenCalled();

    view.rerender(<TypeaheadSearchBaseView {...props({ isOpen: true, selectedItem: ada })} />);
    expect(screen.getByTestId('input')).toBeTruthy();
  });

  it('renders an inline dropdown and forwards dropdown behavior', () => {
    const viewProps = props({ disablePortal: true, isOpen: true, query: 'ad' });
    render(<TypeaheadSearchBaseView {...viewProps} />);
    expect(document.querySelector('[data-typeahead-dropdown]')).toBeTruthy();
    expect(mocks.dropdownProps).toMatchObject({
      onHoverIndex: viewProps.setSelectedIndex,
      onSelect: viewProps.handleSelect,
      query: 'ad',
      results: [ada],
      selectedIndex: 0,
    });
  });

  it('renders a positioned portal and stops pointer and mouse propagation', () => {
    const portalParent = document.createElement('div');
    const portalTarget = document.createElement('div');
    portalParent.appendChild(portalTarget);
    document.body.appendChild(portalParent);
    const viewProps = props({ isOpen: true, portalTarget });
    render(<TypeaheadSearchBaseView {...viewProps} />);

    const portal = portalTarget.querySelector('[data-typeahead-portal]') as HTMLElement;
    expect(portal.style.left).toBe('20px');
    expect(portal.style.top).toBe('10px');
    expect(portal.style.width).toBe('100px');
    const parentPointer = vi.fn();
    const parentMouse = vi.fn();
    portalParent.addEventListener('pointerdown', parentPointer);
    portalParent.addEventListener('mousedown', parentMouse);
    fireEvent.pointerDown(portal);
    fireEvent.mouseDown(portal);
    expect(parentPointer).not.toHaveBeenCalled();
    expect(parentMouse).not.toHaveBeenCalled();
    portalParent.remove();
  });

  it('renders no dropdown when an open portal has no target', () => {
    render(<TypeaheadSearchBaseView {...props({ isOpen: true })} />);
    expect(document.querySelector('[data-typeahead-dropdown]')).toBeNull();
  });
});
