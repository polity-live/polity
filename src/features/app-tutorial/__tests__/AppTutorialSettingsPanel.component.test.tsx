/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  completedAt: null as string | null,
  loadRun: vi.fn(),
}));

vi.mock('lucide-react', () => ({
  GraduationCap: () => <span data-icon="graduation" />,
  Play: () => <span data-icon="play" />,
  RotateCw: () => <span data-icon="restart" />,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, search }: any) => (
    <a href="/onboarding" data-restart={String(search.restart)}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, values?: Record<string, unknown>) =>
      values?.chapter ? `${key}:${values.chapter}` : key,
  }),
}));
vi.mock('@/features/shared/ui/form', () => ({
  SettingsPanel: ({ children }: any) => <section>{children}</section>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, disabled }: any) => <button disabled={disabled}>{children}</button>,
}));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({ appTutorialCompletedAt: mocks.completedAt }),
}));
vi.mock('../catalog', () => ({
  getAppTutorialCheckpoint: () => ({
    chapter: 4,
    copy: { en: { title: 'Checkpoint title' }, de: { title: 'Prüfpunkt' } },
  }),
}));
vi.mock('../api', () => ({ loadTutorialRun: () => mocks.loadRun() }));

import { AppTutorialSettingsPanel } from '../AppTutorialSettingsPanel';

function run(status: 'active' | 'paused') {
  return {
    runId: 'run-1',
    status,
    currentCheckpointId: 'checkpoint',
    route: '/route',
    revision: 1,
    expiresAt: '2099-01-01T00:00:00Z',
  };
}

beforeEach(() => {
  mocks.completedAt = null;
  mocks.loadRun.mockReset();
});

afterEach(() => cleanup());

describe('AppTutorialSettingsPanel', () => {
  it.each([
    ['active', 'features.appTutorial.settings.active'],
    ['paused', 'features.appTutorial.settings.paused'],
  ] as const)('renders a %s run with checkpoint progress', async (status, statusCopy) => {
    mocks.loadRun.mockResolvedValue({ run: run(status) });
    render(<AppTutorialSettingsPanel />);
    expect(await screen.findByText(statusCopy)).toBeTruthy();
    expect(screen.getByText('features.appTutorial.settings.resume')).toBeTruthy();
    expect(
      screen.getByText((_content, element) =>
        Boolean(
          element?.tagName === 'P' &&
          element.textContent?.includes('features.appTutorial.settings.chapter:4')
        )
      )
    ).toBeTruthy();
    expect(document.querySelector('[data-icon="play"]')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('data-restart')).toBe('false');
  });

  it('renders completed and never-started actions', async () => {
    mocks.completedAt = '2026-08-09T00:00:00Z';
    mocks.loadRun.mockResolvedValue({ run: null });
    const completed = render(<AppTutorialSettingsPanel />);
    expect(await screen.findByText('features.appTutorial.settings.complete')).toBeTruthy();
    expect(screen.getByText('features.appTutorial.settings.restart')).toBeTruthy();
    expect(document.querySelector('[data-icon="restart"]')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('data-restart')).toBe('true');
    completed.unmount();

    mocks.completedAt = null;
    mocks.loadRun.mockResolvedValue({ run: null });
    render(<AppTutorialSettingsPanel />);
    expect(await screen.findByText('features.appTutorial.settings.notStarted')).toBeTruthy();
    expect(screen.getByText('features.appTutorial.settings.start')).toBeTruthy();
    expect(document.querySelector('[data-icon="graduation"]')).toBeTruthy();
  });

  it('disables the action while loading and reports load errors', async () => {
    let reject!: (error: Error) => void;
    mocks.loadRun.mockReturnValue(
      new Promise((_resolve, rejectPromise) => (reject = rejectPromise))
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<AppTutorialSettingsPanel />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    reject(new Error('offline'));
    await waitFor(() =>
      expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false)
    );
    expect(errorSpy).toHaveBeenCalledWith('Tutorial status load failed:', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('ignores a late result after unmounting', async () => {
    let resolve!: (value: unknown) => void;
    mocks.loadRun.mockReturnValue(new Promise(resolvePromise => (resolve = resolvePromise)));
    const view = render(<AppTutorialSettingsPanel />);
    view.unmount();
    resolve({ run: run('active') });
    await Promise.resolve();
    await Promise.resolve();
  });
});
