/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../AppTutorialOrchestrator', () => ({
  AppTutorialOrchestrator: () => <div data-testid="tutorial-orchestrator" />,
}));

import { AppTutorialSessionGate } from '../AppTutorialSessionGate';
import { activateAppTutorialSession, deactivateAppTutorialSession } from '../events';

describe('AppTutorialSessionGate', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('does not mount the orchestrator during normal app loading or navigation', async () => {
    const view = render(<AppTutorialSessionGate pathname="/home" />);

    await waitFor(() => expect(screen.queryByTestId('tutorial-orchestrator')).toBeNull());
    view.rerender(<AppTutorialSessionGate pathname="/group/group-1" />);
    expect(screen.queryByTestId('tutorial-orchestrator')).toBeNull();
  });

  it('mounts only for an explicit tutorial session in the current tab', async () => {
    const view = render(<AppTutorialSessionGate pathname="/home" />);

    activateAppTutorialSession();
    expect(await screen.findByTestId('tutorial-orchestrator')).toBeTruthy();

    view.rerender(<AppTutorialSessionGate pathname="/onboarding" />);
    await waitFor(() => expect(screen.queryByTestId('tutorial-orchestrator')).toBeNull());

    view.rerender(<AppTutorialSessionGate pathname="/home" />);
    expect(await screen.findByTestId('tutorial-orchestrator')).toBeTruthy();

    deactivateAppTutorialSession();
    await waitFor(() => expect(screen.queryByTestId('tutorial-orchestrator')).toBeNull());
  });
});
