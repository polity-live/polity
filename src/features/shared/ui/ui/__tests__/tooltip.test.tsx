/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
import { KeyboardPlatformProvider } from '@/features/shared/keyboard/keyboard-shortcut';
import { commandDialogShortcut } from '@/features/navigation/nav-keyboard/keyboard-navigation';

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

describe('Tooltip', () => {
  it('renders compact content, arrow, portal and class overrides', async () => {
    render(
      <Tooltip defaultOpen>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent className="test-override">Compact help</TooltipContent>
      </Tooltip>
    );

    const tooltip = await screen.findByRole('tooltip');
    const content = document.querySelector('[data-slot="tooltip-content"]');
    expect(content?.className).toContain('max-w-64');
    expect(content?.className).toContain('motion-reduce:animate-none');
    expect(content?.className).toContain('test-override');
    expect(content?.querySelector('svg')).not.toBeNull();
    expect(content?.parentElement?.hasAttribute('data-radix-popper-content-wrapper')).toBe(true);
    expect(tooltip.textContent).toContain('Compact help');
  });

  it('uses the larger rich variant for multiline content', async () => {
    render(
      <Tooltip defaultOpen>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent variant="rich">
          <p>First line</p>
          <p>Second line</p>
        </TooltipContent>
      </Tooltip>
    );

    await screen.findByRole('tooltip');
    expect(document.querySelector('[data-slot="tooltip-content"]')?.className).toContain(
      'max-w-80'
    );
  });

  it('renders a shortcut badge and derives aria-keyshortcuts', async () => {
    render(
      <KeyboardPlatformProvider platform="windows">
        <Tooltip defaultOpen shortcut={commandDialogShortcut}>
          <TooltipTrigger>Search</TooltipTrigger>
          <TooltipContent>Open Command Box</TooltipContent>
        </Tooltip>
      </KeyboardPlatformProvider>
    );

    expect(screen.getByRole('button', { name: 'Search' }).getAttribute('aria-keyshortcuts')).toBe(
      'Control+K'
    );
    expect((await screen.findByRole('tooltip')).textContent).toContain('Ctrl K');
  });

  it('opens on focus and closes with Escape', async () => {
    render(
      <Tooltip>
        <TooltipTrigger>Focusable</TooltipTrigger>
        <TooltipContent>Focus help</TooltipContent>
      </Tooltip>
    );

    screen.getByRole('button', { name: 'Focusable' }).focus();
    expect(await screen.findByRole('tooltip')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('gives disabled buttons a focusable tooltip trigger without a native title', async () => {
    render(
      <Button disabled title="Unavailable">
        Save
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('title')).toBeNull();
    const wrapper = button.parentElement;
    expect(wrapper?.getAttribute('tabindex')).toBe('0');
    wrapper?.focus();
    expect((await screen.findByRole('tooltip')).textContent).toContain('Unavailable');
  });
});
