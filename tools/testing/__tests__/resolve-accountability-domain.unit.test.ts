import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');
const resolver = path.join(root, 'tools/testing/resolve-accountability-domain.mjs');
const baseline = path.join(root, 'tools/testing/ui-action-debt-baseline.json');
const ledger = path.join(root, 'tools/testing/debt-resolution-ledger.json');

describe('domain accountability resolver safety contract', () => {
  it('rejects batches larger than the atomic 100-key domain limit', () => {
    const result = spawnSync(
      process.execPath,
      [resolver, '--source-prefix', 'src/features/shared/', '--limit', '101'],
      { cwd: root, encoding: 'utf8' }
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('--limit <1..100>');
  });

  it('does not mutate evidence files when a domain has no pending debt', () => {
    const baselineBefore = fs.readFileSync(baseline, 'utf8');
    const ledgerBefore = fs.readFileSync(ledger, 'utf8');

    const output = execFileSync(
      process.execPath,
      [resolver, '--source-prefix', 'src/features/nonexistent/', '--limit', '1'],
      { cwd: root, encoding: 'utf8' }
    );

    expect(output).toContain('No pending UI debt');
    expect(fs.readFileSync(baseline, 'utf8')).toBe(baselineBefore);
    expect(fs.readFileSync(ledger, 'utf8')).toBe(ledgerBefore);
  });
});
