import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  adaptNavigationHistoryDiagnostic,
  navigationHistoryCanonicalHashes,
  removeNavigationHistoryDiagnostic,
} from '../navigation-history-adapter.mjs';

describe('revision-owned navigation diagnostic adapter', () => {
  const head = readFileSync('tools/e2e/zero-performance/journeys.ts', 'utf8');
  // Exact bae28aeba46c7498a9948dd3c6f7e0605cac911d input, independent of checkout depth.
  const base = readFileSync(
    new URL('./fixtures/journeys-base.fixture.txt', import.meta.url),
    'utf8'
  );
  it('pins the immutable Base fixture independently of repository history', () => {
    expect(createHash('sha256').update(base.replaceAll('\r\n', '\n')).digest('hex')).toBe(
      '332e39228b42655c2f459018bbe7845ad2edae35d8f53f883a662239fbbd0969'
    );
  });
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
