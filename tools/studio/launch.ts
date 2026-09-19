import { config } from 'dotenv';
import path from 'node:path';
if (process.env.NODE_ENV !== 'production') {
  const inherited = { ...process.env };
  for (const file of ['.env', '.env.local', '.env.development', '.env.development.local'])
    config({ path: path.resolve(file), override: true, quiet: true });
  Object.assign(process.env, inherited);
}
const target = process.argv[2];
if (!['collaboration-server', 'worker'].includes(target))
  throw new Error('Expected collaboration-server or worker');
await import(`./${target}.ts`);
