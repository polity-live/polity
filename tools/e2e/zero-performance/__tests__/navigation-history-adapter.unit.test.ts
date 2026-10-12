import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  adaptNavigationHistoryDiagnostic,
  navigationHistoryCanonicalHashes,
  removeNavigationHistoryDiagnostic,
} from '../navigation-history-adapter.mjs';

describe('revision-owned navigation diagnostic adapter', () => {
  const head = readFileSync('tools/e2e/zero-performance/journeys.ts', 'utf8');
  const base = execFileSync(
    'git',
    ['show', 'bae28aeba46c7498a9948dd3c6f7e0605cac911d:tools/e2e/zero-performance/journeys.ts'],
    { encoding: 'utf8' }
  );
  for (const [name, original] of [
    ['Head', head],
    ['Base', base],
  ]) {
    for (const newline of ['\n', '\r\n']) {
      it(`inserts only diagnostics and restores exact ${name} bytes with ${JSON.stringify(newline)} newlines`, () => {
        const source = original.replaceAll('\r\n', '\n').replaceAll('\n', newline);
        const result = adaptNavigationHistoryDiagnostic(source);
        expect(navigationHistoryCanonicalHashes.get(result.inputSHA256)).toBe(result.outputSHA256);
        expect(removeNavigationHistoryDiagnostic(result.source)).toBe(source);
        expect(result.source.indexOf('Post-acceptance fresh-context')).toBeGreaterThan(
          result.source.indexOf('await page.waitForTimeout(5_100)')
        );
        expect(result.source).toContain("record.visit === 'back'");
        expect(result.source).toContain("failure.startsWith('Cached display exceeds ')");
        expect(() => adaptNavigationHistoryDiagnostic(result.source)).toThrow(/already present/);
      });
    }
  }
  it('rejects unknown revisions instead of adapting a changed workload', () => {
    expect(() => adaptNavigationHistoryDiagnostic(head.replace('5_100', '1'))).toThrow(
      /source hash/
    );
    expect(() => removeNavigationHistoryDiagnostic(head)).toThrow(/output/);
  });
});
