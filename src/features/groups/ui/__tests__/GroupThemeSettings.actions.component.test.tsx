/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUILTIN_THEMES } from '@/features/shared/appearance-theme';
import { GroupThemeSettings } from '../GroupThemeSettings';

vi.mock('@/features/shared/appearance-theme', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/appearance-theme')>();
  return {
    ...actual,
    appearanceThemeDefinitionSchema: {
      safeParse: (data: unknown) => ({ success: true as const, data }),
    },
    validateThemeForPublishing: () => [],
  };
});

const mocks = vi.hoisted(() => ({
  rows: [] as unknown[],
  mutate: vi.fn(() => Promise.resolve()),
  confirm: vi.fn(() => true),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: mocks.mutate }),
  useQuery: () => [mocks.rows, { type: 'complete' }],
}));

vi.mock('@/zero/queries', () => ({
  queries: { appearanceThemes: { groupEditor: vi.fn(() => ({})) } },
}));

vi.mock('@/zero/mutators', () => ({
  mutators: {
    appearanceThemes: {
      createGroup: (args: unknown) => ({ name: 'createGroup', args }),
      updateDraft: (args: unknown) => ({ name: 'updateDraft', args }),
      publish: (args: unknown) => ({ name: 'publish', args }),
      delete: (args: unknown) => ({ name: 'delete', args }),
    },
  },
}));

vi.mock('@/zero/mutate-with-server-check', () => ({ onServerError: vi.fn() }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  mocks.rows = [];
  mocks.mutate.mockClear();
  mocks.confirm.mockClear();
  vi.stubGlobal('confirm', mocks.confirm);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GroupThemeSettings actions', () => {
  it('creates and edits a preset through stable theme actions', () => {
    const { container } = render(<GroupThemeSettings groupId="group-1" />);
    const preset = container.querySelector<HTMLElement>(
      '[data-action-id="groups.themes.preset.create"]'
    )!;
    preset.focus();
    expect(document.activeElement).toBe(preset);
    fireEvent.click(preset);

    const font = container.querySelector<HTMLSelectElement>(
      '[data-action-id="groups.themes.font.select"]'
    )!;
    fireEvent.change(font, { target: { value: font.options[1]?.value } });
    fireEvent.click(container.querySelector('[data-action-id="groups.themes.draft.save"]')!);
    expect(mocks.mutate).toHaveBeenCalled();

    fireEvent.click(container.querySelector('[data-action-id="groups.themes.editor.back"]')!);
    expect(container.querySelector('[data-action-id="groups.themes.preset.create"]')).toBeTruthy();
  });

  it('edits and deletes existing themes through stable actions', () => {
    const preset = BUILTIN_THEMES[0]!;
    mocks.rows = [
      {
        id: 'theme-1',
        slug: 'custom',
        name: 'Custom',
        group_id: 'group-1',
        current_revision: {
          id: 'revision-1',
          version: 1,
          status: 'published',
          light_palette: preset.light,
          dark_palette: preset.dark,
          fonts: preset.fonts,
        },
        revisions: [],
      },
    ];
    const { container } = render(<GroupThemeSettings groupId="group-1" />);

    fireEvent.click(container.querySelector('[data-action-id="groups.themes.existing.delete"]')!);
    expect(mocks.confirm).toHaveBeenCalled();
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'delete', args: { id: 'theme-1' } })
    );
    fireEvent.click(container.querySelector('[data-action-id="groups.themes.existing.edit"]')!);
    const publish = container.querySelector<HTMLButtonElement>(
      '[data-action-id="groups.themes.draft.publish"]'
    )!;
    expect(publish).toBeTruthy();
    if (!publish.disabled) fireEvent.click(publish);
    expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ name: 'publish' }));
  });
});
