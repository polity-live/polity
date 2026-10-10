import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Execution } from './sharding';

/** Collector and worker fingerprints must describe the same revision-owned runtime. */
export async function runtimeMetadata(schemaTables: number) {
  if (!Number.isSafeInteger(schemaTables) || schemaTables < 1)
    throw new Error('Invalid runtime schema');
  const version = JSON.parse(
    await readFile('node_modules/@rocicorp/zero/package.json', 'utf8')
  ).version;
  if (typeof version !== 'string' || !version) throw new Error('Missing Zero runtime version');
  const lock = await readFile('pnpm-lock.yaml');
  if (!lock.length) throw new Error('Missing runtime lockfile');
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    zero: version,
    lockSHA256: createHash('sha256').update(lock).digest('hex'),
    schemaTables,
  };
}

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
