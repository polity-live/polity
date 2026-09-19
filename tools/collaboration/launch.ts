import { config } from 'dotenv';
import path from 'node:path';
if (process.env.NODE_ENV !== 'production') {
  const inherited = { ...process.env };
  for (const file of ['.env', '.env.local', '.env.development', '.env.development.local'])
    config({ path: path.resolve(file), override: true, quiet: true });
  Object.assign(process.env, inherited);
}
const target = process.argv[2];
if (process.env.COLLABORATION_TEST_DATABASE) {
  const database = new URL(process.env.ZERO_UPSTREAM_DB || '');
  if (
    !['localhost', '127.0.0.1', '::1'].includes(database.hostname) ||
    !/^polity_collaboration_[a-z0-9_]+$/.test(process.env.COLLABORATION_TEST_DATABASE)
  )
    throw new Error('Invalid isolated test database');
  database.pathname = `/${process.env.COLLABORATION_TEST_DATABASE}`;
  process.env.ZERO_UPSTREAM_DB = database.toString();
  process.env.STUDIO_DATABASE_URL = database.toString();
}
if (
  ![
    'server',
    'migrate',
    'rehearsal',
    'seed',
    'acceptance',
    'studio-acceptance',
    'faults',
    'restart',
    'tutorial-acceptance',
    'verify',
  ].includes(target)
)
  throw new Error('Expected server, migrate or rehearsal');
const testTargets = ['acceptance', 'studio-acceptance', 'faults', 'restart', 'tutorial-acceptance'];
await import(testTargets.includes(target) ? `../e2e/collaboration/${target}.ts` : `./${target}.ts`);
