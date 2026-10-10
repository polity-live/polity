import path from 'node:path';
import { mkdir, readdir, copyFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assertOutputDirectory } from './isolation.mjs';

const excludedDirectories = new Set([
  'project',
  'node_modules',
  '.git',
  '.output',
  'linux-build',
  'build-cache',
  '.pnpm-store',
]);
const records = new Set([
  'runner.json',
  'comparison.json',
  'report.json',
  'results.csv',
  'mutations.csv',
  'journeys.csv',
  'progress.json',
  'fixtures.json',
  'preflight.json',
  'startup.json',
  'integrity.json',
  'failure.json',
  'navigation.cpuprofile',
  'navigation-timeline.json',
  'navigation-style-reads.json',
]);
const allowed = relative => {
  const segments = relative.split(path.sep);
  const filename = segments.at(-1);
  return (
    records.has(filename) ||
    /\.(log|ndjson)$/.test(filename) ||
    (segments.includes('plans') && filename.endsWith('.json')) ||
    (segments.includes('screenshots') && filename.endsWith('.png'))
  );
};

/** Copy original diagnostic bytes without scanning sandboxes, builds or symlinked dependencies. */
export async function stageArtifacts(source, destination) {
  source = path.resolve(source);
  destination = path.resolve(destination);
  const relative = path.relative(source, destination);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)))
    throw new Error('Artifact staging must be outside its source directory');
  const sourceStat = await lstat(source);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink())
    throw new Error('Artifact source must be a real directory');
  await mkdir(path.dirname(destination), { recursive: true });
  await mkdir(destination);
  const started = performance.now();
  let files = 0,
    bytes = 0;
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) await visit(filename);
      } else if (entry.isFile()) {
        const relativeFile = path.relative(source, filename);
        if (!allowed(relativeFile)) continue;
        const target = path.join(destination, relativeFile);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(filename, target);
        files++;
        bytes += (await lstat(filename)).size;
      }
    }
  }
  await visit(source);
  if (!files) throw new Error('No original benchmark diagnostics to upload');
  return { files, bytes, elapsedMs: performance.now() - started };
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const option = name => process.argv[process.argv.indexOf(name) + 1];
  const source = process.argv.includes('--source') && option('--source');
  const destination = process.argv.includes('--output') && option('--output');
  if (!source || !destination) throw new Error('Expected --source and --output');
  assertOutputDirectory(process.cwd(), source);
  assertOutputDirectory(process.cwd(), destination);
  console.log(JSON.stringify(await stageArtifacts(source, destination)));
}
