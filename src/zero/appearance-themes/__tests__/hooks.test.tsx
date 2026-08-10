/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  catalogRows: undefined as unknown,
  catalogType: 'complete' as 'unknown' | 'complete',
  selectedRow: undefined as unknown,
  selectedType: 'complete' as 'unknown' | 'complete',
  appearanceThemeId: null as string | null,
  preferenceLoading: false,
  builtin: null as null | { id: string; name: string },
  updateAppearanceTheme: vi.fn(),
  setAppearanceTheme: vi.fn(),
  safeParse: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { key: string }) =>
    query.key === 'catalog'
      ? [mocks.catalogRows, { type: mocks.catalogType }]
      : [mocks.selectedRow, { type: mocks.selectedType }],
}));

vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({
    appearanceThemeId: mocks.appearanceThemeId,
    isLoading: mocks.preferenceLoading,
  }),
}));

vi.mock('@/zero/preferences/usePreferenceActions', () => ({
  usePreferenceActions: () => ({ updateAppearanceTheme: mocks.updateAppearanceTheme }),
}));

vi.mock('@/features/shared/global-state/theme.store', () => ({
  useThemeStore: (selector: (state: { setAppearanceTheme: typeof mocks.setAppearanceTheme }) => unknown) =>
    selector({ setAppearanceTheme: mocks.setAppearanceTheme }),
}));

vi.mock('@/features/shared/appearance-theme', () => ({
  appearanceThemeDefinitionSchema: { safeParse: mocks.safeParse },
  BUILTIN_THEMES: [{ id: 'polity', name: 'Polity' }, { id: 'contrast', name: 'Contrast' }],
  POLITY_THEME: { id: 'polity', name: 'Polity' },
  getBuiltinTheme: () => mocks.builtin,
}));

vi.mock('../../queries', () => ({
  queries: {
    appearanceThemes: {
      catalog: () => ({ key: 'catalog' }),
      selectedGroupTheme: (args: unknown) => ({ key: 'selected', args }),
    },
  },
}));

import {
  definitionFromThemeRow,
  useAppearanceThemeSync,
  useAvailableAppearanceThemes,
} from '../hooks';

function revision() {
  return {
    id: 'revision-1',
    version: 2,
    light_palette: { background: '#fff' },
    dark_palette: { background: '#000' },
    fonts: { sans: 'Inter' },
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'theme-1',
    slug: 'theme-one',
    name: 'Valid Theme',
    description: null,
    kind: 'group',
    group_id: null,
    current_revision: revision(),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.catalogRows = undefined;
  mocks.catalogType = 'complete';
  mocks.selectedRow = undefined;
  mocks.selectedType = 'complete';
  mocks.appearanceThemeId = null;
  mocks.preferenceLoading = false;
  mocks.builtin = null;
  mocks.updateAppearanceTheme.mockReset();
  mocks.setAppearanceTheme.mockReset();
  mocks.safeParse.mockReset();
  mocks.safeParse.mockImplementation(input =>
    input.name === 'Invalid Theme'
      ? { success: false, error: new Error('invalid') }
      : { success: true, data: { ...input, parsed: true } }
  );
});

describe('definitionFromThemeRow', () => {
  it('returns null without a current revision or for an invalid definition', () => {
    expect(definitionFromThemeRow(row({ current_revision: null }))).toBeNull();
    expect(definitionFromThemeRow(row({ name: 'Invalid Theme' }))).toBeNull();
  });

  it('parses nullable and populated metadata into the schema contract', () => {
    expect(definitionFromThemeRow(row())).toMatchObject({
      id: 'theme-1',
      description: undefined,
      groupId: null,
      version: 2,
      parsed: true,
    });
    expect(
      definitionFromThemeRow(row({ description: 'Description', group_id: 'group-1' }))
    ).toMatchObject({ description: 'Description', groupId: 'group-1' });
  });
});

describe('useAvailableAppearanceThemes', () => {
  it('returns only builtin themes for a non-array loading payload', () => {
    mocks.catalogRows = null;
    mocks.catalogType = 'unknown';
    const state = renderHook(() => useAvailableAppearanceThemes()).result.current;
    expect(state.groupThemes).toEqual([]);
    expect(state.themes).toEqual(state.builtinThemes);
    expect(state.isLoading).toBe(true);
  });

  it('filters non-group and invalid rows while appending valid group themes', () => {
    mocks.catalogRows = [
      row({ id: 'builtin-row', kind: 'builtin' }),
      row({ id: 'invalid', name: 'Invalid Theme' }),
      row({ id: 'valid' }),
    ];
    const state = renderHook(() => useAvailableAppearanceThemes()).result.current;
    expect(state.groupThemes).toHaveLength(1);
    expect(state.groupThemes[0]).toMatchObject({ id: 'valid', parsed: true });
    expect(state.themes).toHaveLength(3);
    expect(state.isLoading).toBe(false);
  });
});

describe('useAppearanceThemeSync', () => {
  it('waits for preferences before applying a theme', () => {
    mocks.preferenceLoading = true;
    renderHook(() => useAppearanceThemeSync());
    expect(mocks.setAppearanceTheme).not.toHaveBeenCalled();
  });

  it('applies a builtin theme immediately', () => {
    mocks.appearanceThemeId = 'contrast';
    mocks.builtin = { id: 'contrast', name: 'Contrast' };
    renderHook(() => useAppearanceThemeSync());
    expect(mocks.setAppearanceTheme).toHaveBeenCalledWith(mocks.builtin);
    expect(mocks.updateAppearanceTheme).not.toHaveBeenCalled();
  });

  it('waits for an unresolved selected group theme query', () => {
    mocks.appearanceThemeId = 'group-theme';
    mocks.selectedType = 'unknown';
    renderHook(() => useAppearanceThemeSync());
    expect(mocks.setAppearanceTheme).not.toHaveBeenCalled();
  });

  it('applies a valid selected group theme', () => {
    mocks.appearanceThemeId = 'group-theme';
    mocks.selectedRow = row({ id: 'group-theme' });
    renderHook(() => useAppearanceThemeSync());
    expect(mocks.setAppearanceTheme).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'group-theme', parsed: true })
    );
    expect(mocks.updateAppearanceTheme).not.toHaveBeenCalled();
  });

  it('falls back to Polity and clears an invalid preference only once', () => {
    mocks.appearanceThemeId = 'missing-theme';
    const { rerender } = renderHook(() => useAppearanceThemeSync());
    expect(mocks.setAppearanceTheme).toHaveBeenCalledWith({ id: 'polity', name: 'Polity' });
    expect(mocks.updateAppearanceTheme).toHaveBeenCalledWith(null);

    mocks.selectedRow = row({ id: 'missing-theme', name: 'Invalid Theme' });
    rerender();
    expect(mocks.setAppearanceTheme).toHaveBeenCalledTimes(2);
    expect(mocks.updateAppearanceTheme).toHaveBeenCalledTimes(1);
  });

  it('falls back without persisting when no preference id exists', () => {
    renderHook(() => useAppearanceThemeSync());
    expect(mocks.setAppearanceTheme).toHaveBeenCalledWith({ id: 'polity', name: 'Polity' });
    expect(mocks.updateAppearanceTheme).not.toHaveBeenCalled();
  });
});
