import { describe, expect, it } from 'vitest';

import {
  buildCoverageManifest,
  classifyRepositoryFile,
  normalizeRepositoryPath,
} from '../../../tools/testing/coverage-scope.mjs';

describe('coverage scope contracts', () => {
  it('normalizes Windows repository paths', () => {
    expect(normalizeRepositoryPath('src\\features\\groups\\index.ts')).toBe(
      'src/features/groups/index.ts'
    );
  });

  it.each([
    ['src/features/groups/index.ts', 'production-code', 'instrument'],
    ['tools/deploy/deploy.mjs', 'operational-code', 'instrument'],
    ['tools/testing/check-coverage.mjs', 'test-infrastructure', 'self-test'],
    ['tools/e2e/prepare-stack.mjs', 'test-infrastructure', 'self-test'],
    ['src/features/groups/__tests__/group.test.ts', 'test-infrastructure', 'self-test'],
    ['src/environment.d.ts', 'declarative', 'static-contract'],
    ['supabase/schemas/groups.sql', 'declarative', 'database-contract'],
    ['src/routeTree.gen.ts', 'generated', 'regenerate'],
    ['tools/testing/coverage-manifest.json', 'generated', 'regenerate'],
    ['supabase/tests/database_coverage.json', 'generated', 'regenerate'],
    ['README.md', 'documentation', 'static-contract'],
  ])('classifies %s as %s', (file, kind, verification) => {
    expect(classifyRepositoryFile(file)).toMatchObject({ kind, verification });
  });

  it('rejects a new executable without silently adding it to legacy debt', () => {
    const manifest = buildCoverageManifest(['src/features/example/uncovered.ts']);
    expect(manifest.entries[0]).toMatchObject({
      coverageStatus: 'new-gap',
      testRefs: [],
      suggestedTestRefs: [],
    });
  });
});
