import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  getAppTutorialFixtureTextVariants: () => ['Assistant task'],
}));

import { getTodoTutorialAnchor } from '../tutorialTodoAnchor';

describe('tutorial todo anchor branches A09', () => {
  it('distinguishes missing, assistant, network, and absent titles', () => {
    expect(getTodoTutorialAnchor({ title: 'Assistant task' })).toBeUndefined();
    expect(getTodoTutorialAnchor({ tutorial_run_id: 'run', title: 'Assistant task' })).toBe(
      'tutorial-assistant-todo'
    );
    expect(getTodoTutorialAnchor({ tutorial_run_id: 'run', title: 'Network task' })).toBe(
      'tutorial-network-todo'
    );
    expect(getTodoTutorialAnchor({ tutorial_run_id: 'run', title: null })).toBe(
      'tutorial-network-todo'
    );
  });
});
