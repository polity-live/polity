/* @vitest-environment jsdom */

import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAgendaArrowNavigation } from '../useAgendaArrowNavigation';

function createAgendaNav(
  overrides: Partial<Parameters<typeof useAgendaArrowNavigation>[0]['agendaNav']> = {}
) {
  return {
    canNavigate: true,
    isLoading: false,
    hasPreviousItem: true,
    hasNextItem: true,
    canMoveToNextItem: true,
    currentAgendaItem: { id: 'agenda-item' },
    moveToPreviousItem: vi.fn(),
    moveToNextItem: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useAgendaArrowNavigation', () => {
  it('navigates agenda items with global arrow keys', () => {
    const agendaNav = createAgendaNav();

    renderHook(() => useAgendaArrowNavigation({ agendaNav }));

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(agendaNav.moveToPreviousItem).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(agendaNav.moveToNextItem).toHaveBeenCalledTimes(1);
  });

  it('does not move to the next agenda item until existing agenda rules allow it', () => {
    const agendaNav = createAgendaNav({ canMoveToNextItem: false });

    renderHook(() => useAgendaArrowNavigation({ agendaNav }));

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(agendaNav.moveToNextItem).not.toHaveBeenCalled();
  });

  it('prioritizes active change-request step navigation over agenda item navigation', () => {
    const agendaNav = createAgendaNav();
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    renderHook(() =>
      useAgendaArrowNavigation({
        agendaNav,
        changeRequestNav: {
          enabled: true,
          hasPrevious: true,
          hasNext: true,
          onPrevious,
          onNext,
        },
      })
    );

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    fireEvent.keyDown(document, { key: 'ArrowRight' });

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(agendaNav.moveToPreviousItem).not.toHaveBeenCalled();
    expect(agendaNav.moveToNextItem).not.toHaveBeenCalled();
  });
});
