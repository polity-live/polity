/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LanguageToggle } from '../language-toggle';

const changeLanguage = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'en', changeLanguage, t: (key: string) => key }),
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { success: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('language popover interactions', () => {
  it('keeps the menu open when clicking a hovered trigger and selects a language', async () => {
    render(<LanguageToggle />);
    const trigger = screen.getByRole('button', { name: 'navigation.toggles.language.title' });

    fireEvent.mouseEnter(trigger);
    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const german = document.querySelector('[data-action-id="navigation.language.popover.german"]')!;
    fireEvent.click(german);
    expect(changeLanguage).toHaveBeenCalledExactlyOnceWith('de');
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
  });

  it('retains keyboard access when the pointer leaves and restores focus after Escape', async () => {
    render(<LanguageToggle />);
    const trigger = screen.getByRole('button', { name: 'navigation.toggles.language.title' });
    trigger.focus();
    fireEvent.click(trigger, { detail: 0 });
    const menu = screen.getByRole('dialog');
    fireEvent.mouseLeave(menu);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger, { detail: 0 });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });
});
