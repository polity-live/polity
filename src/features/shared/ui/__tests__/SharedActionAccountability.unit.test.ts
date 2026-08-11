import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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

const testSourceByFile = new Map<string, string>();

function declaresConcreteTestCase(reference: ActionEntry['testRefs'][number]) {
  const testFile = path.resolve(reference.file);
  if (!fs.existsSync(testFile)) {
    return false;
  }
  const source = testSourceByFile.get(testFile) ?? fs.readFileSync(testFile, 'utf8');
  testSourceByFile.set(testFile, source);
  const escapedCaseId = reference.caseId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`\\b(?:it|test)\\s*\\(\\s*(["'])${escapedCaseId}\\1`, 'u').test(source);
}

function expectAccounted(entries: ActionEntry[]) {
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(entry.actionId, entry.file).toMatch(/^[a-z0-9-]+(?:\.[a-z0-9-]+){3,}$/);
    expect(entry.accountabilityStatus, `${entry.file}#${entry.actionId}`).toBe('accounted');
    expect(entry.accessibilityIssues ?? [], `${entry.file}#${entry.actionId}`).toEqual([]);
    const reference = entry.testRefs.find(
      candidate =>
        entry.scenarios.every(scenario => candidate.scenarios?.includes(scenario)) &&
        declaresConcreteTestCase(candidate)
    );
    expect(reference, `${entry.file}#${entry.actionId}`).toBeDefined();
    expect(reference?.project, `${entry.file}#${entry.actionId}:project`).toMatch(
      /^(?:component|unit)$/u
    );
    for (const scenario of entry.scenarios) {
      expect(reference?.scenarios, `${entry.file}#${entry.actionId}:${scenario}`).toContain(
        scenario
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
