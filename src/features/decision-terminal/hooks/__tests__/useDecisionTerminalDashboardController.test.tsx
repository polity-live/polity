/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  DECISION_TERMINAL_DASHBOARD_VERSION,
  createDefaultDecisionTerminalDashboardConfig,
} from '../../logic/dashboard-config';
import { useDecisionTerminalDashboardController } from '../useDecisionTerminalDashboardController';
import type { DecisionItem } from '../../ui/types';

const { saveDecisionTerminalDashboard } = vi.hoisted(() => ({
  saveDecisionTerminalDashboard: vi.fn(),
}));

vi.mock('@/zero/preferences', async importOriginal => {
  const actual = await importOriginal<typeof import('@/zero/preferences')>();
  return {
    ...actual,
    usePreferenceState: () => ({
      decisionTerminalDashboard: null,
      isLoading: false,
    }),
    usePreferenceActions: () => ({
      saveDecisionTerminalDashboard,
    }),
  };
});

function decision(overrides: Partial<DecisionItem> = {}): DecisionItem {
  return {
    id: 'V-1',
    sourceId: 'vote-1',
    type: 'vote',
    title: 'Budget vote',
    body: 'Assembly',
    endsAt: new Date('2026-06-13T18:00:00Z'),
    status: 'open',
    isClosed: false,
    isClosingSoon: true,
    isOpeningSoon: false,
    isRecentlyClosed: false,
    isUrgent: true,
    visibility: 'public',
    trend: { direction: 'stable', percentage: 0 },
    href: '#',
    ...overrides,
  };
}

describe('useDecisionTerminalDashboardController', () => {
  it('derives dashboard counts and persists a reset layout', () => {
    const { result } = renderHook(() =>
      useDecisionTerminalDashboardController({
        decisions: [
          decision(),
          decision({ id: 'V-2', isUrgent: false, isOpeningSoon: true }),
          decision({ id: 'V-3', isClosed: true, isUrgent: true }),
        ],
      })
    );

    expect(result.current.urgentCount).toBe(1);
    expect(result.current.activeCount).toBe(1);

    act(() => {
      result.current.handleResetLayout();
    });

    expect(saveDecisionTerminalDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        version: DECISION_TERMINAL_DASHBOARD_VERSION,
        widgets: createDefaultDecisionTerminalDashboardConfig().widgets,
      })
    );
  });
});
