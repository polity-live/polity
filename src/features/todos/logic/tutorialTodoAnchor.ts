import { getAppTutorialFixtureTextVariants } from '@/features/app-tutorial/fixture-copy';

export function getTodoTutorialAnchor(todo: {
  title?: string | null;
  tutorial_run_id?: string | null;
}) {
  if (!todo.tutorial_run_id) return undefined;

  return getAppTutorialFixtureTextVariants('Die Welt zu einem besseren Ort machen', {
    tutorialRunId: todo.tutorial_run_id,
  }).includes(todo.title ?? '')
    ? 'tutorial-assistant-todo'
    : 'tutorial-network-todo';
}
