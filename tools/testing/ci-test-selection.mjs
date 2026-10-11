import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const CI_TEST_FLAGS = [
  'performance',
  'static',
  'unit',
  'component',
  'flow',
  'browser',
  'coverage',
  'security',
  'service',
  'database',
  'build',
  'e2e',
  'dependencies',
];

/** Omitted selection runs everything. Unknown names fail closed. */
export function selectCITests(selection = 'all') {
  if (typeof selection !== 'string' || !selection.trim())
    throw new Error('CI tests must be all or a comma-separated list of test flags');
  const names = selection.split(',').map(name => name.trim());
  if (names.includes('all') && names.length !== 1)
    throw new Error('all cannot be combined with individual CI test flags');
  for (const name of names)
    if (name !== 'all' && !CI_TEST_FLAGS.includes(name))
      throw new Error(`Unknown CI test flag: ${name}`);
  const enabled = Object.fromEntries(
    CI_TEST_FLAGS.map(name => [name, names.includes('all') || names.includes(name)])
  );
  // The ratchet consumes browser and database coverage artifacts too.
  if (enabled.coverage) enabled.browser = enabled.database = true;
  return enabled;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = '.github/ci-tests.json';
  const configured = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).tests : undefined;
  const enabled = selectCITests(process.env.CI_TEST_SELECTION || configured);
  if (!process.env.GITHUB_OUTPUT) throw new Error('Missing GitHub Actions output file');
  appendFileSync(process.env.GITHUB_OUTPUT, `enabled=${JSON.stringify(enabled)}\n`);
  console.info(
    `Enabled CI tests: ${Object.keys(enabled)
      .filter(name => enabled[name])
      .join(', ')}`
  );
}
