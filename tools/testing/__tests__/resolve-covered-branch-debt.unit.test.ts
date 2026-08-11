import { describe, expect, it, vi } from 'vitest';

import { buildBranchDebtInventory } from '../coverage-branch-accountability.mjs';
import {
  planCoveredBranchDebtResolution,
  serializeBranchAccountability,
} from '../resolve-covered-branch-debt.mjs';

const coveredAlternative = (fingerprint: string) => ({
  fingerprint,
  file: `src/${fingerprint}.ts`,
  domain: 'src:example',
  owner: 'polity/src:example',
  type: 'if',
  line: 1,
  column: 0,
  index: 0,
  covered: true,
  hits: 1,
  testRefs: [`src/__tests__/${fingerprint}.test.ts`],
});

const emptyLedger = { version: 1, resolutions: [] };

describe('covered branch debt resolver', () => {
  it('synchronizes changed inventory metadata without rewriting the ledger', () => {
    const alternatives = [coveredAlternative('one'), coveredAlternative('two')];
    const previous = buildBranchDebtInventory(alternatives.slice(0, 1));

    const plan = planCoveredBranchDebtResolution({
      alternatives,
      previous,
      previousInventoryText: serializeBranchAccountability(previous),
      ledger: emptyLedger,
    });

    expect(plan).toMatchObject({
      status: 'updated',
      resolved: [],
      duplicatesRemoved: 0,
      inventoryChanged: true,
      ledgerChanged: false,
      inventory: {
        baseline: {
          totalAlternatives: 2,
          coveredAlternatives: 2,
          uncoveredAlternatives: 0,
        },
      },
    });
  });

  it('is a true no-op when inventory and ledger already match', () => {
    const alternatives = [coveredAlternative('one')];
    const previous = buildBranchDebtInventory(alternatives);

    const plan = planCoveredBranchDebtResolution({
      alternatives,
      previous,
      previousInventoryText: serializeBranchAccountability(previous),
      ledger: emptyLedger,
    });

    expect(plan).toMatchObject({
      status: 'noop',
      resolved: [],
      duplicatesRemoved: 0,
      inventoryChanged: false,
      ledgerChanged: false,
    });
  });

  it('refuses new uncovered alternatives before producing writable state', () => {
    const fileExists = vi.fn();
    const uncovered = { ...coveredAlternative('new-open'), covered: false, hits: 0 };
    const previous = buildBranchDebtInventory([]);

    const plan = planCoveredBranchDebtResolution({
      alternatives: [uncovered],
      previous,
      previousInventoryText: serializeBranchAccountability(previous),
      ledger: emptyLedger,
      fileExists,
    });

    expect(plan).toEqual({ status: 'refused', newUncovered: [uncovered] });
    expect(fileExists).not.toHaveBeenCalled();
    expect(plan).not.toHaveProperty('inventoryText');
    expect(plan).not.toHaveProperty('ledgerText');
  });
});
