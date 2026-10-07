/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_THEMES } from '@/features/shared/appearance-theme';

const boundary = vi.hoisted(() => ({ rows: [] as unknown[], mutate: vi.fn() }));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: boundary.mutate }),
  useQuery: () => [boundary.rows, { type: 'complete' }],
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

import { GroupThemeSettings } from '../GroupThemeSettings';

beforeEach(() => {
  vi.useFakeTimers();
  boundary.mutate.mockReset().mockImplementation(() => ({
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' }),
  }));
  const preset = BUILTIN_THEMES[0]!;
  boundary.rows = [
    {
      id: crypto.randomUUID(),
      slug: 'saved-feedback',
      name: 'Saved feedback',
      current_revision: {
        id: crypto.randomUUID(),
        version: 1,
        status: 'published',
        light_palette: preset.light,
        dark_palette: preset.dark,
        fonts: preset.fonts,
        text_styles: preset.textStyles,
      },
      revisions: [],
    },
  ];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function openEditor() {
  const view = render(<GroupThemeSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'pages.group.themes.edit' }));
  const save = screen.getByRole('button', { name: 'pages.group.themes.saveDraft' });
  expect((save as HTMLButtonElement).disabled).toBe(false);
  return { ...view, save };
}

describe('GroupThemeSettings saved feedback timers', () => {
  it('expires the saved indicator after 1600 milliseconds', () => {
    const { save } = openEditor();
    fireEvent.click(save);
    expect(save.textContent).toContain('pages.group.themes.saved');
    act(() => vi.advanceTimersByTime(1599));
    expect(save.textContent).toContain('pages.group.themes.saved');
    act(() => vi.advanceTimersByTime(1));
    expect(save.textContent).toContain('pages.group.themes.saveDraft');
    expect(boundary.mutate).toHaveBeenCalledOnce();
  });

  it('keeps the indicator visible for a full interval after a second save', () => {
    const { save } = openEditor();
    fireEvent.click(save);
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(save);
    act(() => vi.advanceTimersByTime(600));
    expect(save.textContent).toContain('pages.group.themes.saved');
    act(() => vi.advanceTimersByTime(1000));
    expect(save.textContent).toContain('pages.group.themes.saveDraft');
    expect(boundary.mutate).toHaveBeenCalledTimes(2);
  });

  it('cancels the pending saved timer when the editor unmounts', () => {
    const { save, unmount } = openEditor();
    const beforeSave = vi.getTimerCount();
    fireEvent.click(save);
    expect(vi.getTimerCount()).toBe(beforeSave + 1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(2000));
    expect(boundary.mutate).toHaveBeenCalledOnce();
  });
});
