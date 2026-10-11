/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, useEffect, useState, type ComponentProps } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Toolbar,
  ToolbarButton,
  ToolbarTooltipContainer,
  ToolbarSplitButton,
  ToolbarSplitButtonPrimary,
  ToolbarSplitButtonSecondary,
} from '../Toolbar';
import { KeyboardPlatformProvider } from '@/features/shared/keyboard/keyboard-shortcut';
import { editorShortcuts } from '@/features/shared/ui/ui-platejs/editor-shortcuts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Toolbar tooltip', () => {
  it('hydrates the SSR control before enabling its accessible disabled tooltip wrapper', () => {
    const element = (
      <Toolbar>
        <ToolbarButton disabled tooltip="Unavailable" aria-label="Hydrated action">
          X
        </ToolbarButton>
      </Toolbar>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(element);
    document.body.append(container);
    expect(container.querySelector('button')?.getAttribute('aria-hidden')).toBeNull();
    const errors = vi.spyOn(console, 'error');
    try {
      render(element, { container, hydrate: true });
      const wrapper = screen.getByRole('button', { name: 'Hydrated action' });
      expect(wrapper.getAttribute('tabindex')).toBe('0');
      expect(wrapper.querySelector('button')?.getAttribute('aria-hidden')).toBe('true');
      expect(
        errors.mock.calls.filter(call => /hydration|did not match/i.test(call.join(' ')))
      ).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });
  it('mounts client-navigation controls once and preserves their state', () => {
    const mounted = vi.fn();
    const Control = forwardRef<HTMLButtonElement, ComponentProps<'button'>>((props, ref) => {
      const [count, setCount] = useState(0);
      useEffect(() => {
        mounted();
      }, []);
      return (
        <button {...props} ref={ref} onClick={() => setCount(value => value + 1)}>
          {count}
        </button>
      );
    });
    const view = render(
      <ToolbarTooltipContainer Component={Control} componentProps={{}} tooltip="Control" />
    );
    expect(mounted).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Control' }));
    view.rerender(
      <ToolbarTooltipContainer Component={Control} componentProps={{}} tooltip="Updated" />
    );
    expect(screen.getByRole('button', { name: 'Updated' }).textContent).toBe('1');
    expect(mounted).toHaveBeenCalledTimes(1);
  });
  it('uses the shared tooltip and a structured shortcut badge', async () => {
    render(
      <KeyboardPlatformProvider platform="windows">
        <Toolbar>
          <ToolbarButton aria-label="Bold" tooltip="Bold" tooltipShortcut={editorShortcuts.bold}>
            B
          </ToolbarButton>
        </Toolbar>
      </KeyboardPlatformProvider>
    );

    const button = await screen.findByRole('button', { name: 'Bold' });
    button.focus();

    expect(button.getAttribute('aria-keyshortcuts')).toBe('Control+B');
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Bold');
    expect(tooltip.textContent).toContain('Ctrl B');
    expect(tooltip.querySelector('[data-slot="kbd"]')).not.toBeNull();
  });

  it('keeps a disabled toolbar control focusable through its tooltip wrapper', async () => {
    render(
      <Toolbar>
        <ToolbarButton disabled tooltip="Unavailable" aria-label="Disabled action">
          X
        </ToolbarButton>
      </Toolbar>
    );

    const wrapper = await screen.findByRole('button', { name: 'Disabled action' });
    expect(wrapper.getAttribute('tabindex')).toBe('0');
    expect(wrapper.querySelector('button')?.getAttribute('aria-hidden')).toBe('true');
    wrapper.focus();
    expect((await screen.findByRole('tooltip')).textContent).toContain('Unavailable');
  });

  it('keeps dropdown toggles as named buttons with compatible expanded state', async () => {
    render(
      <Toolbar>
        <DropdownMenu open={false}>
          <DropdownMenuTrigger asChild>
            <ToolbarButton pressed={false} isDropdown tooltip="Alignment">
              <svg aria-hidden="true" />
            </ToolbarButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>Menu</DropdownMenuContent>
        </DropdownMenu>
      </Toolbar>
    );

    const trigger = await screen.findByRole('button', { name: 'Alignment' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('renders split actions as named sibling buttons instead of nested commands', () => {
    render(
      <ToolbarSplitButton pressed>
        <ToolbarSplitButtonPrimary aria-label="Bulleted list">
          <svg aria-hidden="true" />
        </ToolbarSplitButtonPrimary>
        <ToolbarSplitButtonSecondary aria-label="Bulleted list options" />
      </ToolbarSplitButton>
    );

    const group = screen.getByRole('group');
    expect(screen.getByRole('button', { name: 'Bulleted list' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bulleted list options' })).toBeTruthy();
    expect(group.querySelector('button button')).toBeNull();
  });
});
