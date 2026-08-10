/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TodosTabs } from '../TodosTabs';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('TodosTabs action contracts', () => {
  it('selects each status through stable keyboard-focusable tabs', () => {
    const setSelectedTab = vi.fn();
    render(
      <TodosTabs
        selectedTab="all"
        setSelectedTab={setSelectedTab}
        statusCounts={{
          all: 6,
          pending: 1,
          in_progress: 1,
          completed: 1,
          cancelled: 1,
          archived: 2,
        }}
      >
        <div>Todo list</div>
      </TodosTabs>
    );

    const ids = ['all', 'pending', 'in-progress', 'completed', 'cancelled', 'archived'];
    for (const id of ids) {
      const tab = document.querySelector(
        `[data-action-id="todos.tabs.status.${id}"]`
      ) as HTMLElement;
      tab.focus();
      expect(document.activeElement).toBe(tab);
    }
    fireEvent.mouseDown(document.querySelector('[data-action-id="todos.tabs.status.completed"]')!);
    fireEvent.click(document.querySelector('[data-action-id="todos.tabs.status.completed"]')!);
    expect(setSelectedTab).toHaveBeenCalledWith('completed');
    expect(screen.getByText('Todo list')).toBeTruthy();
  });
});
