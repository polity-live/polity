import { readFile } from 'node:fs/promises';
import type { Execution } from './sharding';

export async function executionMetadata(): Promise<Execution | undefined> {
  const file = process.env.ZERO_PERFORMANCE_EXECUTION;
  if (!file) return undefined;
  const value = JSON.parse(await readFile(file, 'utf8'));
  if (
    !value ||
    [
      'manifestDigest',
      'shardID',
      'revision',
      'sourceSHA',
      'harnessDigest',
      'runnerID',
      'phase',
    ].some(key => typeof value[key] !== 'string' || !value[key])
  )
    throw new Error('Invalid execution metadata');
  return value;
}
