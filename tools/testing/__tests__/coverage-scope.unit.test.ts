import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildCoverageManifest, classifyRepositoryFile } from '../coverage-scope.mjs';

const temporaryDirectories: string[] = [];

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-coverage-scope-'));
  temporaryDirectories.push(root);
  return root;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('coverage inventory classification', () => {
  it('classifies pure TypeScript contracts as declarative', () => {
    const root = fixtureRoot();
    fs.mkdirSync(path.join(root, 'src/domain'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'src/domain/model.ts'),
      `export interface Model { id: string }\nexport type Id = string;\n`
    );

    expect(classifyRepositoryFile('src/domain/model.ts', root)).toMatchObject({
      kind: 'declarative',
      verification: 'static-contract',
    });
  });

  it('keeps runtime TypeScript modules instrumented', () => {
    const root = fixtureRoot();
    fs.mkdirSync(path.join(root, 'src/domain'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/domain/model.ts'), `export const value = 1;\n`);

    expect(classifyRepositoryFile('src/domain/model.ts', root)).toMatchObject({
      kind: 'production-code',
      verification: 'instrument',
    });
  });

  it('recognizes rc files as configuration contracts', () => {
    expect(classifyRepositoryFile('.lintstagedrc.mjs')).toMatchObject({
      kind: 'configuration',
      verification: 'static-contract',
    });
  });

  it('does not let filename suggestions close accountability gaps', () => {
    const files = [
      'src/features/groups/logic/createGroup.ts',
      'src/features/groups/logic/__tests__/createGroup.test.ts',
    ];
    const manifest = buildCoverageManifest(files, {
      knownLegacyPaths: files,
      accountability: { sourceReferences: {} },
    });
    const source = manifest.entries.find((entry: { path: string }) =>
      entry.path.endsWith('createGroup.ts')
    );

    expect(source).toMatchObject({
      coverageStatus: 'legacy-reference',
      testRefs: [],
      suggestedTestRefs: ['src/features/groups/logic/__tests__/createGroup.test.ts'],
    });
  });
});
