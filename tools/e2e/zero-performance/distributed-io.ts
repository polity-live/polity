import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mechanics } from './mechanics.mjs';

export const harnessRoot = path.resolve('tools/e2e/zero-performance');
export const option = (name: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
export const requiredOption = (name: string) => {
  const value = option(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
export const readJSON = async <T = any>(file: string): Promise<T> =>
  JSON.parse(await readFile(file, 'utf8'));
export async function writeJSON(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2));
}
export function git(...args: string[]) {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`Git ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}
export async function harnessDigest() {
  const hash = createHash('sha256');
  const files = [
    ...mechanics,
    'distributed.ts',
    'distributed-runner.ts',
    'distributed-merge.ts',
    'distributed-report.ts',
    'distributed-io.ts',
    'distributed-timing.ts',
    'shard-weights.json',
    'stage-artifacts.mjs',
  ];
  for (const file of files.sort())
    hash.update(file).update(await readFile(path.join(harnessRoot, file)));
  return hash.digest('hex');
}
export function command(args: string[], env = process.env, signal?: AbortSignal) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
    const stop = () => {
      child.kill('SIGINT');
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    signal?.addEventListener('abort', stop, { once: true });
    child.once('error', reject);
    child.once('exit', code => {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      signal?.removeEventListener('abort', stop);
      resolve(code ?? 1);
    });
    if (signal?.aborted) stop();
  });
}
export function ownedPath(root: string, relative: string) {
  const result = path.resolve(root, relative);
  if (!result.startsWith(path.resolve(root) + path.sep))
    throw new Error('Artifact path escapes its runner directory');
  return result;
}
