/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateFormStyle } from '@/zero/preferences/schema';
import type { CreateSubmitOutcome } from '../../types/create-form.types';

let createFormStyle: CreateFormStyle = 'carousel';
const updateFormStyle = vi.fn();
const navigate = vi.fn();

vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({
    createFormStyle,
    groupNetworkLayouts: {},
    isLoading: false,
    preference: { id: 'preference-1' },
  }),
}));

vi.mock('@/zero/preferences/usePreferenceActions', () => ({
  usePreferenceActions: () => ({
    updateFormStyle,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'pages.create.preferences.auto': 'Automatisch',
        'pages.create.preferences.carousel': 'Karussell',
        'pages.create.preferences.onePage': 'Eine Seite',
        'pages.create.group.title': 'Neue Gruppe erstellen',
        'pages.create.common.review': 'Review',
        'pages.create.progress.submission.overlay.title': 'POLITY is working.',
        'pages.create.progress.submission.overlay.ready': 'Ready',
        'pages.create.progress.submission.overlay.interrupted': 'Interrupted',
        'pages.create.progress.submission.overlay.creating': 'Creating',
        'pages.create.progress.submission.overlay.defaultError': 'Creation could not be completed.',
        'pages.create.progress.submission.overlay.readyDescription':
          'Alpha Group Review is created and ready to open.',
        'pages.create.progress.submission.overlay.progressLabel': 'Creation progress',
        'pages.create.progress.submission.overlay.reviewNeeded': 'Review needed',
        'pages.create.progress.submission.overlay.completed': 'Completed',
        'pages.create.progress.submission.overlay.running': 'Running',
        'pages.create.progress.submission.overlay.waiting': 'Waiting',
        'pages.create.progress.submission.overlay.backToForm': 'Back to form',
        'pages.create.progress.submission.overlay.retry': 'Try again',
      })[key] ?? key,
  }),
}));

vi.mock('@/features/timeline/hooks/useIsMobile', () => ({
  BREAKPOINTS: { lg: 1024 },
  useIsMobile: () => false,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}));

vi.mock('../CarouselFormLayout', () => ({
  CarouselFormLayout: ({
    onSubmit,
    isSubmitting,
  }: {
    onSubmit: () => Promise<void>;
    isSubmitting: boolean;
  }) => (
    <div data-testid="carousel-layout">
      <button type="button" disabled={isSubmitting} onClick={onSubmit}>
        Submit
      </button>
    </div>
  ),
}));

vi.mock('../OnePageFormLayout', () => ({
  OnePageFormLayout: ({
    onSubmit,
    isSubmitting,
  }: {
    onSubmit: () => Promise<void>;
    isSubmitting: boolean;
  }) => (
    <div data-testid="one-page-layout">
      <button type="button" disabled={isSubmitting} onClick={onSubmit}>
        Submit
      </button>
    </div>
  ),
}));

import { CreateFormShell } from '../CreateFormShell';
import { CreateSummaryStep } from '../CreateSummaryStep';
import type { CreateFormConfig, CreateSubmitContext } from '../../types/create-form.types';

const config: CreateFormConfig = {
  entityType: 'group',
  isSubmitting: false,
  onSubmit: vi.fn().mockResolvedValue({ status: 'blocked' }),
  steps: [
    {
      label: 'Review',
      isValid: () => true,
      fields: [
        {
          key: 'review',
          kind: 'customComponent',
          component: CreateSummaryStep,
          props: {
            entityType: 'group',
            badge: 'Group',
            title: 'Alpha Group Review',
            sections: [
              {
                title: 'Basics',
                fields: [{ label: 'Name', value: 'Alpha Group' }],
              },
            ],
          },
        },
      ],
    },
  ],
  title: 'pages.create.group.title',
};

const groupSuccessOutcome: CreateSubmitOutcome = {
  status: 'success',
  target: {
    kind: 'route',
    entityType: 'group',
    label: 'Zur Gruppe',
    to: '/group/$id',
    params: { id: 'group-1' },
  },
};

afterEach(cleanup);

describe('CreateFormShell', () => {
  beforeEach(() => {
    createFormStyle = 'carousel';
    updateFormStyle.mockClear();
    navigate.mockClear();
    vi.mocked(config.onSubmit).mockReset();
    vi.mocked(config.onSubmit).mockResolvedValue({ status: 'blocked' });
  });

  it('renders the create flow frame with the title and form style selector', () => {
    render(<CreateFormShell config={config} />);

    expect(screen.getByTestId('create-flow-frame')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Neue Gruppe erstellen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /eine seite/i })).toBeTruthy();
  });

  it('switches to one-page layout immediately when the preference button is clicked', () => {
    render(<CreateFormShell config={config} />);

    expect(screen.queryByTestId('carousel-layout')).not.toBeNull();
    expect(screen.queryByTestId('one-page-layout')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /eine seite/i }));

    expect(screen.queryByTestId('carousel-layout')).toBeNull();
    expect(screen.queryByTestId('one-page-layout')).not.toBeNull();
    expect(updateFormStyle).toHaveBeenCalledWith('one_page');
  });

  it('shows the fullscreen submit overlay and activates the target button after success', async () => {
    let resolveSubmit: (outcome: CreateSubmitOutcome) => void = () => undefined;
    vi.mocked(config.onSubmit).mockImplementation(
      () =>
        new Promise<CreateSubmitOutcome>(resolve => {
          resolveSubmit = resolve;
        })
    );

    render(<CreateFormShell config={config} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'POLITY is working.' })).toBeTruthy();
    expect(screen.getByText('Alpha Group Review')).toBeTruthy();
    expect(screen.getByText('Alpha Group')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /zur gruppe/i }).disabled).toBe(
      true
    );

    await act(async () => {
      resolveSubmit(groupSuccessOutcome);
    });

    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: /zur gruppe/i }).disabled).toBe(
        false
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /zur gruppe/i }));

    expect(navigate).toHaveBeenCalledWith({
      to: '/group/$id',
      params: { id: 'group-1' },
      search: undefined,
      hash: undefined,
    });
  });

  it('updates fullscreen progress from the submit context', async () => {
    let submitContext: CreateSubmitContext | undefined;
    let resolveSubmit: (outcome: CreateSubmitOutcome) => void = () => undefined;
    vi.mocked(config.onSubmit).mockImplementation(
      context =>
        new Promise<CreateSubmitOutcome>(resolve => {
          submitContext = context;
          resolveSubmit = resolve;
        })
    );

    render(<CreateFormShell config={config} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();

    act(() => {
      submitContext?.reportProgress({ key: 'create', status: 'complete' });
      submitContext?.reportProgress({
        key: 'sync',
        label: 'Synchronisiert Testdaten',
        status: 'active',
      });
    });

    expect(screen.getByText('Synchronisiert Testdaten')).toBeTruthy();
    expect(screen.getByText('Running')).toBeTruthy();

    await act(async () => {
      resolveSubmit(groupSuccessOutcome);
    });

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeTruthy();
    });
  });

  it('does not show the overlay when submit is blocked by validation', async () => {
    vi.mocked(config.onSubmit).mockResolvedValue({ status: 'blocked' });

    render(<CreateFormShell config={config} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(config.onSubmit).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps form data available after a submit error and can return to the form', async () => {
    vi.mocked(config.onSubmit).mockRejectedValue(new Error('Create failed'));

    render(<CreateFormShell config={config} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Create failed')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /back to form/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByTestId('carousel-layout')).toBeTruthy();
  });

  it('navigates to the recovery target after a submit error that happens after creation', async () => {
    vi.mocked(config.onSubmit).mockImplementation(async context => {
      context?.setRecoveryTarget(groupSuccessOutcome.target);
      throw new Error('Link failed');
    });

    render(<CreateFormShell config={config} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Link failed')).toBeTruthy();
    expect(screen.getByRole('button', { name: /zur gruppe/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /zurück zum formular/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /erneut versuchen/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /zur gruppe/i }));

    expect(navigate).toHaveBeenCalledWith({
      to: '/group/$id',
      params: { id: 'group-1' },
      search: undefined,
      hash: undefined,
    });
  });
});
