import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildBranchDebtInventory,
  collectBranchAlternatives,
  diffBranchDebt,
  flattenBranchDebts,
  normalizeBranchResolutions,
  readJson,
} from './coverage-branch-accountability.mjs';

export function serializeBranchAccountability(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function planCoveredBranchDebtResolution({
  alternatives,
  previous,
  previousInventoryText = serializeBranchAccountability(previous),
  ledger,
  exceptions = [],
  root = process.cwd(),
  fileExists = fs.existsSync,
}) {
  const previousDebts = flattenBranchDebts(previous);
  const difference = diffBranchDebt({ alternatives, previousDebts, exceptions });

  if (difference.newUncovered.length) {
    return {
      status: 'refused',
      newUncovered: difference.newUncovered,
    };
  }

  const all = new Map(alternatives.map(entry => [entry.fingerprint, entry]));
  const resolved = difference.resolved.map(debt => ({
    fingerprint: debt.fingerprint,
    file: debt.file,
    line: debt.line,
    resolution: all.has(debt.fingerprint)
      ? 'tested'
      : fileExists(path.resolve(root, debt.file))
        ? 'refactored'
        : 'removed-dead-code',
    evidence: 'coverage/coverage-final.json',
  }));
  const previousResolutionCount = ledger.resolutions?.length ?? 0;
  const normalizedExisting = normalizeBranchResolutions(ledger.resolutions ?? []);
  const normalizedResolutions = normalizeBranchResolutions([
    ...(ledger.resolutions ?? []),
    ...resolved,
  ]);
  const nextLedger = { ...ledger, resolutions: normalizedResolutions };
  const inventory = buildBranchDebtInventory(alternatives, exceptions);
  const inventoryText = serializeBranchAccountability(inventory);
  const ledgerText = serializeBranchAccountability(nextLedger);
  const inventoryChanged = inventoryText !== previousInventoryText;
  const ledgerChanged = JSON.stringify(nextLedger) !== JSON.stringify(ledger);
  const duplicatesRemoved = previousResolutionCount - normalizedExisting.length;

  return {
    status: inventoryChanged || ledgerChanged ? 'updated' : 'noop',
    resolved,
    duplicatesRemoved,
    inventory,
    inventoryText,
    inventoryChanged,
    ledger: nextLedger,
    ledgerText,
    ledgerChanged,
  };
}

export function runCoveredBranchDebtResolver({ root = process.cwd() } = {}) {
  const debtPath = path.resolve(root, 'tools/testing/coverage-branch-debt.json');
  const ledgerPath = path.resolve(root, 'tools/testing/coverage-branch-resolution-ledger.json');
  const exceptionsPath = path.resolve(root, 'tools/testing/coverage-branch-exceptions.json');
  const previousInventoryText = fs.readFileSync(debtPath, 'utf8');
  const alternatives = collectBranchAlternatives({
    coverage: readJson(path.resolve(root, 'coverage/coverage-final.json')),
    manifest: readJson(path.resolve(root, 'tools/testing/coverage-manifest.json')),
    root,
  });
  const plan = planCoveredBranchDebtResolution({
    alternatives,
    previous: JSON.parse(previousInventoryText),
    previousInventoryText,
    ledger: readJson(ledgerPath),
    exceptions: readJson(exceptionsPath).exceptions ?? [],
    root,
  });

  if (plan.status === 'refused') {
    console.error(
      `Refusing to resolve branch debt while ${plan.newUncovered.length} new uncovered alternatives exist:`
    );
    for (const entry of plan.newUncovered.slice(0, 100)) {
      console.error(`- ${entry.file}:${entry.line}: ${entry.fingerprint}`);
    }
    return 1;
  }

  if (plan.inventoryChanged) fs.writeFileSync(debtPath, plan.inventoryText);
  if (plan.ledgerChanged) fs.writeFileSync(ledgerPath, plan.ledgerText);

  if (plan.status === 'noop') {
    console.info('No verified branch debt reductions or inventory metadata changes to resolve.');
    return 0;
  }

  console.info(
    `Resolved ${plan.resolved.length} branch debts, removed ${plan.duplicatesRemoved} duplicate ledger rows, and ${plan.inventoryChanged ? 'synchronized' : 'kept'} the inventory; ${plan.inventory.baseline.uncoveredAlternatives} remain.`
  );
  return 0;
}

const invokedModule = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (import.meta.url === invokedModule) process.exitCode = runCoveredBranchDebtResolver();
