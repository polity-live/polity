/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  localizeAppError: vi.fn(() => 'Launch failed'),
  navigate: vi.fn(),
  restart: false,
  startTutorial: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => ({ restart: mocks.restart }),
}));

vi.mock('../api', () => ({
  startTutorial: (...args: unknown[]) => mocks.startTutorial(...args),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'features.appTutorial.launcher.title': 'Tutorial failed',
        'features.appTutorial.launcher.retry': 'Retry',
        'features.appTutorial.launcher.restart': 'Restart',
      })[key] ?? key,
  }),
}));

vi.mock('@/features/shared/errors', () => ({
  localizeAppError: mocks.localizeAppError,
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  AppBootLoadingState: () => <div role="status">Loading tutorial</div>,
}));

import { TutorialLauncherPage } from '../TutorialLauncherPage';

beforeEach(() => {
  mocks.navigate.mockResolvedValue(undefined);
  mocks.restart = false;
  mocks.startTutorial.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TutorialLauncherPage actions', () => {
  it('deduplicates concurrent starts and launches only once per mounted page', async () => {
    let resolveStart!: (value: { run: { route: string } }) => void;
    mocks.startTutorial.mockReturnValue(
      new Promise<{ run: { route: string } }>(resolve => (resolveStart = resolve))
    );

    const view = render(
      <>
        <TutorialLauncherPage />
        <TutorialLauncherPage />
      </>
    );
    expect(mocks.startTutorial).toHaveBeenCalledTimes(1);

    mocks.restart = true;
    view.rerender(
      <>
        <TutorialLauncherPage />
        <TutorialLauncherPage />
      </>
    );
    expect(mocks.startTutorial).toHaveBeenCalledTimes(1);

    resolveStart({ run: { route: '/tutorial/shared' } });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(2));
  });

  it('retries a failed launch through a stable async action', async () => {
    mocks.startTutorial
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce({ run: { route: '/tutorial/ready' } });
    render(<TutorialLauncherPage />);

    expect(await screen.findByText('Launch failed')).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry.getAttribute('data-action-id')).toBe('app-tutorial.launcher.retry');
    retry.focus();
    expect(document.activeElement).toBe(retry);
    fireEvent.click(retry);

    await waitFor(() => expect(mocks.startTutorial).toHaveBeenLastCalledWith(false));
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/tutorial/ready', replace: true })
    );
  });

  it('rebuilds a failed tutorial through a separate stable restart action', async () => {
    mocks.startTutorial
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce({ run: { route: '/tutorial/rebuilt' } });
    render(<TutorialLauncherPage />);

    expect(await screen.findByText('Launch failed')).toBeTruthy();
    const restart = screen.getByRole('button', { name: 'Restart' });
    expect(restart.getAttribute('data-action-id')).toBe('app-tutorial.launcher.restart');
    restart.focus();
    expect(document.activeElement).toBe(restart);
    fireEvent.click(restart);

    await waitFor(() => expect(mocks.startTutorial).toHaveBeenLastCalledWith(true));
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/tutorial/rebuilt', replace: true })
    );
  });

  it('keeps the launcher recoverable when rebuilding also fails', async () => {
    mocks.startTutorial
      .mockRejectedValueOnce(new Error('initial failure'))
      .mockRejectedValueOnce(new Error('rebuild failure'));
    render(<TutorialLauncherPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Restart' }));

    await waitFor(() => expect(mocks.startTutorial).toHaveBeenLastCalledWith(true));
    await waitFor(() => expect(mocks.localizeAppError).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Launch failed')).toBeTruthy();
  });
});
