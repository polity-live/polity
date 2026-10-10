import { writeFile } from 'node:fs/promises';
import { loadCases } from './catalog';
import { securityCaseManifest } from './security';

const output = process.argv[process.argv.indexOf('--output') + 1];
if (!process.argv.includes('--output') || !output) throw new Error('Missing inventory output');
await writeFile(
  output,
  JSON.stringify(
    {
      queries: loadCases().map(entry => `${entry.name}/${entry.variant}`),
      security: await securityCaseManifest(),
    },
    null,
    2
  )
);
