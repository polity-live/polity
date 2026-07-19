/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Toolbar, ToolbarButton } from '../Toolbar';
import { KeyboardPlatformProvider } from '@/features/shared/keyboard/keyboard-shortcut';
import { editorShortcuts } from '@/features/shared/ui/ui-platejs/editor-shortcuts';

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

    const button = await screen.findByRole('button', { name: 'Disabled action' });
    const wrapper = button.parentElement;
    expect(wrapper?.getAttribute('tabindex')).toBe('0');
    wrapper?.focus();
    expect((await screen.findByRole('tooltip')).textContent).toContain('Unavailable');
  });
});
