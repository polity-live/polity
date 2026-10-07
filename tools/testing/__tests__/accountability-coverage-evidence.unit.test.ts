import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateAccountabilityCoverageEvidence } from '../check-accountability-coverage-evidence.mjs';

const root = path.resolve('coverage-evidence-contract');
const source = 'src/feature.ts';
const reference = { file: 'src/__tests__/feature.unit.test.ts', project: 'unit', caseId: 'runs' };
function verify({
  kind = 'production-code',
  verification = 'instrument',
  report = {} as Record<
    string,
    { s: Record<string, number>; f: Record<string, number>; b: Record<string, number[]> }
  >,
  references = [reference],
} = {}) {
  return validateAccountabilityCoverageEvidence({
    root,
    accountability: { sourceReferences: { [source]: references } },
    coverageManifest: { entries: [{ path: source, kind, verification }] },
    rawCoverage: report,
  });
}
describe('accountability execution evidence', () => {
  it('requires an instrumented report for explicitly referenced production code', () => {
    expect(verify()).toEqual({
      failures: [`${source}: missing from instrumented coverage`],
      verified: 0,
      selfTested: 0,
    });
  });
  it('rejects production code that the full suite never executes', () => {
    expect(
      verify({
        report: { [path.join(root, source)]: { s: { 0: 0 }, f: { 0: 0 }, b: { 0: [0, 0] } } },
      }).failures
    ).toEqual([`${source}: exact references exist, but the full suite never executes it`]);
  });
  it('accepts real execution hits after normalizing source paths', () => {
    expect(
      verify({
        report: { [path.join(root, source)]: { s: { 0: 0 }, f: { 0: 0 }, b: { 0: [0, 1] } } },
      })
    ).toEqual({ failures: [], verified: 1, selfTested: 0 });
  });
  it('uses the declared self-test verification for test infrastructure', () => {
    expect(verify({ kind: 'test-infrastructure', verification: 'self-test' })).toEqual({
      failures: [],
      verified: 0,
      selfTested: 1,
    });
  });
  it('continues to require coverage for instrumented test infrastructure', () => {
    expect(verify({ kind: 'test-infrastructure' }).failures).toEqual([
      `${source}: missing from instrumented coverage`,
    ]);
  });
  it('never accepts production code as self-tested infrastructure', () => {
    expect(verify({ verification: 'self-test' }).failures).toEqual([
      `${source}: missing from instrumented coverage`,
    ]);
  });
  it('does not demand execution evidence for unreferenced files', () => {
    expect(verify({ references: [] })).toEqual({ failures: [], verified: 0, selfTested: 0 });
  });
});
