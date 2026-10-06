import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractTestCases } from '../../../../../tools/testing/accountability-scope.mjs';

interface ActionEntry {
  actionId?: string;
  accountabilityStatus: string;
  accessibilityIssues?: string[];
  classification: string;
  file: string;
  identifierSource: string;
  scenarios: string[];
  testRefs: { caseId: string; file: string; project: string; scenarios?: string[] }[];
}

const catalog = JSON.parse(
  fs.readFileSync(path.resolve('tools/testing/ui-action-catalog.json'), 'utf8')
) as { entries: ActionEntry[] };

const sharedDeclarations = catalog.entries.filter(
  entry =>
    entry.file.startsWith('src/features/shared/') &&
    entry.identifierSource === 'manifest-declaration' &&
    entry.classification === 'canonical-action'
);

const testCasesByFile = new Map<string, Set<string>>();

function declaresConcreteTestCase(reference: ActionEntry['testRefs'][number]) {
  const testFile = path.resolve(reference.file);
  if (!fs.existsSync(testFile)) {
    return false;
  }
  let cases = testCasesByFile.get(testFile);
  if (!cases) {
    // Use the repository's AST inventory so parameterized cases are checked
    // with the same exact identities as ordinary cases.
    const result = extractTestCases(fs.readFileSync(testFile, 'utf8'), reference.file);
    if (result.parseError) return false;
    cases = new Set(result.cases.map(testCase => testCase.caseId));
    testCasesByFile.set(testFile, cases);
  }
  return cases.has(reference.caseId);
}

function expectAccounted(entries: ActionEntry[]) {
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(entry.actionId, entry.file).toMatch(/^[a-z0-9-]+(?:\.[a-z0-9-]+){3,}$/);
    expect(entry.accountabilityStatus, `${entry.file}#${entry.actionId}`).toBe('accounted');
    expect(entry.accessibilityIssues ?? [], `${entry.file}#${entry.actionId}`).toEqual([]);
    const references = entry.testRefs.filter(declaresConcreteTestCase);
    // The repository accountability contract permits separate behavior cases for
    // loading, failure and native browser keyboard interaction. Every scenario still needs evidence.
    for (const scenario of entry.scenarios) {
      const reference = references.find(candidate => candidate.scenarios?.includes(scenario));
      expect(reference, `${entry.file}#${entry.actionId}:${scenario}`).toBeDefined();
      expect(reference?.project, `${entry.file}#${entry.actionId}:${scenario}:project`).toMatch(
        /^(?:component|unit|browser-component)$/u
      );
    }
  }
}

describe('shared UI action accountability', () => {
  it('accounts shared interaction actions across idle success keyboard and focus', () => {
    expectAccounted(
      sharedDeclarations.filter(
        entry =>
          !entry.scenarios.includes('selected') &&
          !entry.scenarios.includes('loading') &&
          !entry.scenarios.includes('authorized')
      )
    );
  });

  it('accounts shared selection actions across selected unselected disabled keyboard and focus', () => {
    expectAccounted(sharedDeclarations.filter(entry => entry.scenarios.includes('selected')));
  });

  it('accounts shared async actions across loading success error authorization and disabled states', () => {
    expectAccounted(
      sharedDeclarations.filter(
        entry => entry.scenarios.includes('loading') && entry.scenarios.includes('unauthorized')
      )
    );
  });

  it('accounts shared navigation actions across authorization redirects deep links loading and errors', () => {
    expectAccounted(
      sharedDeclarations.filter(
        entry => entry.scenarios.includes('authorized') && !entry.scenarios.includes('unauthorized')
      )
    );
  });
});
