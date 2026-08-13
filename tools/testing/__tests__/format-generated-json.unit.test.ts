import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { formatGeneratedJson } from '../format-generated-json.mjs';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('generated JSON formatting', () => {
  it('resolves the target Prettier configuration and produces idempotent output', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-generated-json-'));
    temporaryDirectories.push(root);
    fs.writeFileSync(path.join(root, '.prettierrc.json'), '{"printWidth": 20}\n');
    const target = path.join(root, 'catalog.json');
    const serialized = JSON.stringify({ entries: [{ references: ['alpha', 'beta'] }] });

    const formatted = await formatGeneratedJson(serialized, target);

    expect(formatted).toBe(
      [
        '{',
        '  "entries": [',
        '    {',
        '      "references": [',
        '        "alpha",',
        '        "beta"',
        '      ]',
        '    }',
        '  ]',
        '}',
        '',
      ].join('\n')
    );
    await expect(formatGeneratedJson(formatted, target)).resolves.toBe(formatted);
  });
});
