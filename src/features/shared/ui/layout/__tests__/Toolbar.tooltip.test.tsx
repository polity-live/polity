/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Toolbar,
  ToolbarButton,
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
