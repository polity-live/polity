import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkChangedFormat, filterFormattableFiles } from '../check-changed-format.mjs';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('changed-format ratchet', () => {
  it('keeps only existing supported files and removes duplicates', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-format-filter-'));
    temporaryDirectories.push(root);
    fs.writeFileSync(path.join(root, 'valid.ts'), 'export const valid = true;\n');
    fs.writeFileSync(path.join(root, 'ignored.sql'), 'select 1;\n');

    expect(
      filterFormattableFiles(
        [
          'ignored.sql',
          'missing.ts',
          'supabase/tests/database_coverage.json',
          'valid.ts',
          'valid.ts',
        ],
        root
      )
    ).toEqual(['valid.ts']);
  });

  it('reports unformatted files and accepts formatted files', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-format-check-'));
    temporaryDirectories.push(root);
    const previousDirectory = process.cwd();
    process.chdir(root);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      fs.writeFileSync('sample.ts', 'export const value={answer:42}\n');
      await expect(checkChangedFormat(['sample.ts'])).resolves.toBe(false);
      expect(error).toHaveBeenCalledWith('Changed files are not formatted (1 checked):');

      fs.writeFileSync('sample.ts', 'export const value = { answer: 42 };\n');
      await expect(checkChangedFormat(['sample.ts'])).resolves.toBe(true);
    } finally {
      process.chdir(previousDirectory);
    }
  });
});
