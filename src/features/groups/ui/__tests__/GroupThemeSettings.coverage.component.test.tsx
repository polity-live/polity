/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: undefined as any,
  resultType: 'complete',
  parseSuccess: true,
  issues: [] as any[],
  mutate: vi.fn(),
}));
vi.mock('@/features/shared/appearance-theme', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/appearance-theme')>();
  return {
    ...actual,
    appearanceThemeDefinitionSchema: {
      safeParse: (data: any) =>
        mocks.parseSuccess
          ? { success: true, data }
          : { success: false, error: new Error('invalid') },
    },
    validateThemeForPublishing: () => mocks.issues,
  };
});
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: mocks.mutate }),
  useQuery: () => [mocks.rows, { type: mocks.resultType }],
}));
vi.mock('@/zero/queries', () => ({ queries: { appearanceThemes: { groupEditor: () => ({}) } } }));
vi.mock('@/zero/mutators', () => ({
  mutators: {
    appearanceThemes: {
      createGroup: (args: any) => ({ name: 'create', args }),
      updateDraft: (args: any) => ({ name: 'draft', args }),
      publish: (args: any) => ({ name: 'publish', args }),
      delete: (args: any) => ({ name: 'delete', args }),
    },
  },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  onServerError: (_mutation: unknown, onError: (message: string) => void) =>
    onError('server failure'),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, disabled: _disabled, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

import { BUILTIN_THEMES } from '@/features/shared/appearance-theme';
import {
  GroupThemeSettings,
  groupThemeSettingsInternals as internals,
} from '../GroupThemeSettings';

beforeEach(() => {
  mocks.rows = undefined;
  mocks.resultType = 'complete';
  mocks.parseSuccess = true;
  mocks.issues = [];
  mocks.mutate.mockReset().mockReturnValue(Promise.resolve());
  vi.stubGlobal(
    'confirm',
    vi.fn(() => false)
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const preset = BUILTIN_THEMES[0]!;
const revision = (extra: any = {}) => ({
  id: 'revision',
  version: 1,
  status: 'published',
  light_palette: preset.light,
  dark_palette: preset.dark,
  fonts: preset.fonts,
  ...extra,
});
const theme = (extra: any = {}) => ({
  id: 'theme',
  slug: 'theme',
  name: 'Theme',
  group_id: 'g',
  current_revision: revision(),
  ...extra,
});

describe('GroupThemeSettings edge branches', () => {
  it('covers editor conversion and save/publish predicates directly', () => {
    expect(
      internals.toEditorState(theme({ current_revision: null, revisions: undefined }))
    ).toBeNull();
    expect(
      internals.toEditorState(
        theme({
          description: null,
          revisions: [revision({ id: 'draft', version: 3, status: 'draft' })],
        })
      )?.draftId
    ).toBe('draft');
    expect(internals.toEditorState(theme({ revisions: [] }))?.nextVersion).toBe(1);
    expect(internals.isSuccessfulThemeParse(null)).toBe(false);
    expect(internals.isSuccessfulThemeParse({ success: false } as any)).toBe(false);
    expect(internals.isSuccessfulThemeParse({ success: true, data: {} } as any)).toBe(true);
    expect(internals.canPublishParsedTheme(null, [])).toBe(false);
    expect(internals.canPublishParsedTheme({ success: true, data: {} } as any, [{}])).toBe(false);
    expect(internals.canPublishParsedTheme({ success: true, data: {} } as any, [])).toBe(true);
  });

  it('shows loading and accepts non-array query rows', () => {
    mocks.resultType = 'unknown';
    const view = render(<GroupThemeSettings groupId="g" />);
    expect(view.container.textContent).toContain('pages.group.themes.loading');
    mocks.resultType = 'complete';
    view.rerender(<GroupThemeSettings groupId="g" />);
    expect(
      view.container.querySelector('[data-action-id="groups.themes.preset.create"]')
    ).toBeTruthy();
  });

  it('blocks invalid/contrasting themes and handles a falsy draft mutation', () => {
    const view = render(<GroupThemeSettings groupId="g" />);
    fireEvent.click(
      view.container.querySelector('[data-action-id="groups.themes.preset.create"]')!
    );
    mocks.parseSuccess = false;
    view.rerender(<GroupThemeSettings groupId="g-invalid" />);
    expect(view.container.textContent).toContain('pages.group.themes.invalidValues');
    fireEvent.click(view.container.querySelector('[data-action-id="groups.themes.draft.save"]')!);
    fireEvent.click(
      view.container.querySelector('[data-action-id="groups.themes.draft.publish"]')!
    );
    mocks.parseSuccess = true;
    mocks.issues = [{}];
    view.rerender(<GroupThemeSettings groupId="g-issues" />);
    expect(view.container.textContent).toContain('pages.group.themes.contrastError');
    fireEvent.click(
      view.container.querySelector('[data-action-id="groups.themes.draft.publish"]')!
    );
    mocks.issues = [];
    mocks.mutate.mockReturnValueOnce(null);
    view.rerender(<GroupThemeSettings groupId="g-publish" />);
    fireEvent.click(
      view.container.querySelector('[data-action-id="groups.themes.draft.publish"]')!
    );
  });

  it('renders draft and published labels and cancels deletion', () => {
    mocks.rows = [theme(), theme({ id: 'draft-theme', current_revision: null })];
    const view = render(<GroupThemeSettings groupId="g" />);
    expect(view.container.textContent).toContain('pages.group.themes.published');
    expect(view.container.textContent).toContain('pages.group.themes.draft');
    fireEvent.click(
      view.container.querySelectorAll('[data-action-id="groups.themes.existing.delete"]')[0]!
    );
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('executes name, description, palette, chart, save timer, and server-error callbacks', () => {
    vi.useFakeTimers();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = render(<GroupThemeSettings groupId="g" />);
    fireEvent.click(
      view.container.querySelector('[data-action-id="groups.themes.preset.create"]')!
    );
    fireEvent.change(view.container.querySelector('#theme-name')!, {
      target: { value: 'Renamed' },
    });
    fireEvent.change(view.container.querySelector('#theme-description')!, {
      target: { value: 'Description' },
    });
    fireEvent.change(view.container.querySelector('input[type="color"]:not([id*="-chart-"])')!, {
      target: { value: '#112233' },
    });
    fireEvent.change(
      view.container.querySelector('input[id^="pages.group.themes.dark-"][type="color"]')!,
      { target: { value: '#445566' } }
    );
    fireEvent.change(view.container.querySelector('input[pattern]')!, {
      target: { value: '#223344' },
    });
    fireEvent.change(view.container.querySelector('input[id*="-chart-"]')!, {
      target: { value: '#334455' },
    });
    fireEvent.click(view.container.querySelector('[data-action-id="groups.themes.draft.save"]')!);
    fireEvent.click(
      view.container.querySelector('[data-action-id="groups.themes.draft.publish"]')!
    );
    vi.advanceTimersByTime(1600);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
    vi.useRealTimers();

    mocks.rows = [theme()];
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    const list = render(<GroupThemeSettings groupId="g" />);
    fireEvent.click(
      list.container.querySelector('[data-action-id="groups.themes.existing.delete"]')!
    );
    expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ name: 'delete' }));
  });
});
