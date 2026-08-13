import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  extractTestCases,
  loadAccountabilityManifest,
  projectForTestFile,
  scenariosCovered,
  validateTestReference,
} from '../accountability-scope.mjs';
import {
  tagsInTestTitle,
  validateCriticalProcessE2E,
  validateRouteBehaviorAccountability,
} from '../check-action-catalog.mjs';

describe('test accountability contracts', () => {
  it('indexes only statically addressable test cases', () => {
    const result = extractTestCases(`
      it('literal case', () => {});
      test(\`template case\`, () => {});
      test(\`dynamic \${value}\`, () => {});
      it.each([1, 2])('matrix case %s', () => {});
    `);

    expect(result.parseError).toBeUndefined();
    expect(result.cases.map(testCase => testCase.caseId)).toEqual([
      'literal case',
      'template case',
      'matrix case %s',
    ]);
  });

  it('classifies test projects from their collection contract', () => {
    expect(projectForTestFile('e2e/group.e2e.spec.ts')).toBe('playwright');
    expect(projectForTestFile('src/a/__tests__/a.browser-component.test.tsx')).toBe(
      'browser-component'
    );
    expect(projectForTestFile('src/a/__tests__/a.component-flow.test.tsx')).toBe('component-flow');
    expect(projectForTestFile('src/a/__tests__/a.service-integration.test.ts')).toBe(
      'service-integration'
    );
    expect(projectForTestFile('src/a/__tests__/a.database-integration.test.ts')).toBe(
      'database-integration'
    );
    expect(projectForTestFile('src/a/__tests__/a.static-contract.test.ts')).toBe('static-contract');
    expect(projectForTestFile('src/a/__tests__/a.component.test.tsx')).toBe('component');
    expect(projectForTestFile('src/a/__tests__/a.unit.test.ts')).toBe('unit');
  });

  it('rejects stale, ambiguous, and cross-project references', () => {
    const index = new Map([
      [
        'src/a/__tests__/a.unit.test.ts',
        {
          project: 'unit',
          cases: new Map([
            ['unique', [3]],
            ['duplicate', [4, 9]],
          ]),
        },
      ],
    ]);

    expect(
      validateTestReference(
        {
          file: 'src/a/__tests__/a.unit.test.ts',
          project: 'unit',
          caseId: 'unique',
        },
        index
      )
    ).toEqual([]);
    expect(
      validateTestReference(
        {
          file: 'src/a/__tests__/a.unit.test.ts',
          project: 'component',
          caseId: 'missing',
        },
        index
      )
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('project mismatch'),
        expect.stringContaining('missing test case'),
      ])
    );
    expect(
      validateTestReference(
        {
          file: 'src/a/__tests__/a.unit.test.ts',
          project: 'unit',
          caseId: 'duplicate',
        },
        index
      )
    ).toEqual([expect.stringContaining('not unique')]);
  });

  it('requires every applicable scenario to be named by exact references', () => {
    expect(
      scenariosCovered(
        ['idle', 'loading', 'success'],
        [{ scenarios: ['idle'] }, { scenarios: ['loading', 'success'] }]
      )
    ).toBe(true);
    expect(scenariosCovered(['idle', 'error'], [{ scenarios: ['idle'] }])).toBe(false);
  });

  it('merges domain fragments while rejecting duplicate accountability ownership', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-accountability-'));
    fs.mkdirSync(path.join(root, 'tools/testing/accountability'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'tools/testing/test-accountability.json'),
      JSON.stringify({ version: 1, sourceReferences: {}, actionReferences: { base: [] } })
    );
    fs.writeFileSync(
      path.join(root, 'tools/testing/accountability/timeline.json'),
      JSON.stringify({
        version: 1,
        sourceReferenceAdditions: {
          'src/routes/timeline.tsx': [
            {
              file: 'src/routes/__tests__/timeline.component.test.tsx',
              project: 'component',
              caseId: 'opens',
            },
          ],
        },
        actionReferences: { timeline: [] },
        actionDeclarations: {
          'src/features/timeline/Timeline.tsx#button-legacy': {
            actionId: 'timeline.surface.activate.default',
          },
        },
      })
    );

    expect(Object.keys(loadAccountabilityManifest(root).actionReferences)).toEqual([
      'base',
      'timeline',
    ]);
    expect(loadAccountabilityManifest(root).actionDeclarations).toEqual({
      'src/features/timeline/Timeline.tsx#button-legacy': {
        actionId: 'timeline.surface.activate.default',
      },
    });
    expect(loadAccountabilityManifest(root).sourceReferences['src/routes/timeline.tsx']).toEqual([
      {
        file: 'src/routes/__tests__/timeline.component.test.tsx',
        project: 'component',
        caseId: 'opens',
      },
    ]);

    fs.writeFileSync(
      path.join(root, 'tools/testing/accountability/duplicate.json'),
      JSON.stringify({ version: 1, actionReferences: { base: [] } })
    );
    expect(() => loadAccountabilityManifest(root)).toThrow(/Duplicate accountability key/);
  });
});

describe('action and route catalog accountability', () => {
  const e2eCase = 'executes process one @pr @critical';
  const e2eReference = {
    file: 'e2e/process-one.e2e.spec.ts',
    project: 'playwright',
    caseId: e2eCase,
    tags: ['@pr', '@critical'],
    coversActions: ['submit'],
  };
  const structuralReference = {
    file: 'src/routes/__tests__/routeCatalog.contract.unit.test.ts',
    project: 'unit',
    caseId: 'accounts for every route source with a unique file and path',
  };
  const behaviorReference = {
    file: 'src/routes/__tests__/page.component.test.tsx',
    project: 'component',
    caseId: 'loads and authorizes the page',
    evidence: { relation: 'direct' },
  };
  const testIndex = new Map([
    [e2eReference.file, { project: 'playwright', cases: new Map([[e2eCase, [3]]]) }],
    [
      structuralReference.file,
      { project: 'unit', cases: new Map([[structuralReference.caseId, [11]]]) },
    ],
    [
      behaviorReference.file,
      { project: 'component', cases: new Map([[behaviorReference.caseId, [7]]]) },
    ],
  ]);

  it('requires concrete uniquely-owned PR E2E cases with exact title tags and action claims', () => {
    const valid = validateCriticalProcessE2E(
      {
        processes: [
          {
            id: 'process-one',
            critical: true,
            actions: [{ id: 'submit' }],
            prE2E: [e2eReference],
          },
        ],
      },
      testIndex
    );
    expect(valid).toEqual({ failures: [], gaps: [] });
    expect(tagsInTestTitle(e2eCase)).toEqual(['@pr', '@critical']);

    const duplicate = validateCriticalProcessE2E(
      {
        processes: [
          {
            id: 'process-one',
            critical: true,
            actions: [{ id: 'submit' }],
            prE2E: [e2eReference],
          },
          {
            id: 'process-two',
            critical: true,
            actions: [{ id: 'submit' }],
            prE2E: [e2eReference],
          },
        ],
      },
      testIndex
    );
    expect(duplicate.failures).toContainEqual(expect.stringContaining('already claimed'));

    const invalid = validateCriticalProcessE2E(
      {
        processes: [
          {
            id: 'broken',
            critical: true,
            actions: [{ id: 'submit' }, { id: 'persist' }],
            prE2E: [
              {
                ...e2eReference,
                caseId: 'missing test @pr @critical',
                tags: ['@pr'],
              },
            ],
          },
        ],
      },
      testIndex
    );
    expect(invalid.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing test case'),
        expect.stringContaining('declared tags must exactly match'),
        expect.stringContaining('missing required tag @critical'),
        expect.stringContaining('does not cover action persist'),
      ])
    );
  });

  it('keeps scanner contracts structural and requires direct concrete route behavior evidence', () => {
    const routeCatalog = {
      routes: [
        {
          file: 'src/routes/covered.tsx',
          actions: [{ id: 'open-route', contractCoverage: [structuralReference] }],
        },
        {
          file: 'src/routes/scanner-only.tsx',
          actions: [{ id: 'open-route', contractCoverage: [structuralReference] }],
        },
      ],
    };
    const result = validateRouteBehaviorAccountability(
      routeCatalog,
      {
        sourceReferences: {
          'src/routes/covered.tsx': [behaviorReference],
          'src/routes/scanner-only.tsx': [
            { ...structuralReference, evidence: { relation: 'direct' } },
          ],
        },
      },
      testIndex
    );

    expect(result.failures).toEqual([]);
    expect(result.coveredActions).toBe(1);
    expect(result.gaps).toEqual(['src/routes/scanner-only.tsx#open-route']);

    const legacy = validateRouteBehaviorAccountability(
      {
        routes: [
          {
            file: 'src/routes/legacy.tsx',
            actions: [{ id: 'open-route', coverage: [structuralReference.file] }],
          },
        ],
      },
      { sourceReferences: {} },
      testIndex
    );
    expect(legacy.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('legacy coverage field is forbidden'),
        expect.stringContaining('missing structural contract coverage'),
      ])
    );
  });
});
