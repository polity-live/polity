import { describe, expect, it } from 'vitest';

import {
  buildBranchDebtInventory,
  diffBranchDebt,
  flattenBranchDebts,
  isCriticalDomain,
  normalizeBranchResolutions,
} from '../coverage-branch-accountability.mjs';

describe('branch coverage accountability contracts', () => {
  it('keeps uncovered alternatives as debt and removes only audited exceptions', () => {
    const alternatives = [
      {
        fingerprint: 'covered',
        file: 'src/example.ts',
        domain: 'src:example',
        owner: 'polity/src:example',
        type: 'if',
        line: 1,
        column: 0,
        index: 0,
        covered: true,
        hits: 1,
        testRefs: ['src/__tests__/example.test.ts'],
      },
      {
        fingerprint: 'missing',
        file: 'src/example.ts',
        domain: 'src:example',
        owner: 'polity/src:example',
        type: 'if',
        line: 1,
        column: 0,
        index: 1,
        covered: false,
        hits: 0,
        testRefs: ['src/__tests__/example.test.ts'],
      },
    ];

    expect(
      flattenBranchDebts(buildBranchDebtInventory(alternatives)).map(
        (entry: { fingerprint: string }) => entry.fingerprint
      )
    ).toEqual(['missing']);
    expect(
      flattenBranchDebts(buildBranchDebtInventory(alternatives, [{ fingerprint: 'missing' }]))
    ).toEqual([]);
  });

  it('forbids exceptions throughout critical product and server domains', () => {
    expect(isCriticalDomain('features:auth')).toBe(true);
    expect(isCriticalDomain('zero:votes')).toBe(true);
    expect(isCriticalDomain('server:root')).toBe(true);
    expect(isCriticalDomain('features:charts')).toBe(false);
  });

  it('detects new uncovered alternatives before debt can be resolved', () => {
    const previousDebts = [{ fingerprint: 'old-open' }];
    const alternatives = [
      { fingerprint: 'old-open', covered: false },
      { fingerprint: 'old-covered', covered: true },
      { fingerprint: 'new-open', covered: false },
    ];

    expect(diffBranchDebt({ alternatives, previousDebts })).toEqual({
      newUncovered: [{ fingerprint: 'new-open', covered: false }],
      resolved: [],
    });
  });

  it('deduplicates identical ledger rows and rejects conflicting evidence', () => {
    const resolution = {
      fingerprint: 'branch',
      file: 'src/example.ts',
      line: 1,
      resolution: 'tested',
      evidence: 'coverage/coverage-final.json',
    };

    expect(normalizeBranchResolutions([resolution, resolution])).toEqual([resolution]);
    expect(() => normalizeBranchResolutions([resolution, { ...resolution, line: 2 }])).toThrow(
      'conflicting branch resolutions for branch'
    );
  });
});
