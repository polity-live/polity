import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function expectRuntimeCleanupBeforeTutorialRun(source: string) {
  const normalized = source.toLowerCase();
  const runtimeDelete = normalized.indexOf('delete from public.amendment_process_run');
  const unqualifiedRuntimeDelete = normalized.indexOf('delete from amendment_process_run');
  const tutorialRunDelete = normalized.indexOf('delete from public.app_tutorial_run');
  const unqualifiedTutorialRunDelete = normalized.indexOf('delete from app_tutorial_run');
  const runtimeIndex = Math.max(runtimeDelete, unqualifiedRuntimeDelete);
  const tutorialRunIndex = Math.max(tutorialRunDelete, unqualifiedTutorialRunDelete);

  expect(runtimeIndex).toBeGreaterThanOrEqual(0);
  expect(tutorialRunIndex).toBeGreaterThan(runtimeIndex);
}

describe('app tutorial cleanup order', () => {
  it('deletes amendment process runtime data before the server root cascade', () => {
    expectRuntimeCleanupBeforeTutorialRun(
      readFileSync(new URL('../service.ts', import.meta.url), 'utf8')
    );
  });

  it.each([
    '../../../../supabase/schemas/33_app_tutorial.sql',
    '../../../../supabase/migrations/20260726150000_app_tutorial.sql',
  ])('uses the safe order in %s', path => {
    expectRuntimeCleanupBeforeTutorialRun(readFileSync(new URL(path, import.meta.url), 'utf8'));
  });
});
