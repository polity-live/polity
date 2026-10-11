import { writeFile } from 'node:fs/promises';
import { loadCases } from './catalog';
import { securityCaseManifest } from './security';
import { mutationInventory } from './mutation-runtime';

const output = process.argv[process.argv.indexOf('--output') + 1];
if (!process.argv.includes('--output') || !output) throw new Error('Missing inventory output');
const mutations = await mutationInventory();
await writeFile(
  output,
  JSON.stringify(
    {
      queries: loadCases().map(entry => `${entry.name}/${entry.variant}`),
      security: await securityCaseManifest(),
      mutations: mutations.expectations,
      mutationBootstrap: mutations.bootstrap,
    },
    null,
    2
  )
);
