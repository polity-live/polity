import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const COVERAGE_SHARD_USAGE = `Usage:
  pnpm run test:coverage:shard <index>/<count> [max-workers] [reports-directory]
  node tools/testing/run-coverage-shard.mjs --shard <index>/<count> \\
    [--max-workers <count>] [--reports-directory <path>]

Environment alternatives:
  COVERAGE_SHARD, COVERAGE_SHARD_MAX_WORKERS,
  COVERAGE_SHARD_REPORTS_DIRECTORY, COVERAGE_SHARD_ARTIFACT_DIR`;

function parseCliArguments(argv) {
  const named = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h' || argument === 'help') {
      named.help = true;
      continue;
    }
    const equalMatch = argument.match(/^--(shard|max-workers|reports-directory)=(.*)$/);
    if (equalMatch) {
      named[equalMatch[1]] = equalMatch[2];
      continue;
    }
    if (
      argument === '--shard' ||
      argument === '--max-workers' ||
      argument === '--reports-directory'
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${argument}.`);
      }
      named[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    if (argument.startsWith('-')) {
      throw new Error(`Unknown option ${argument}.`);
    }
    positional.push(argument);
  }
  return { named, positional };
}

export function parseCoverageShardOptions({
  argv = process.argv.slice(2),
  env = process.env,
  tempDirectory = os.tmpdir(),
} = {}) {
  const { named, positional } = parseCliArguments(argv);
  if (named.help) return { help: true };

  const remaining = [...positional];
  const shard = named.shard ?? env.COVERAGE_SHARD ?? remaining.shift();
  if (!/^\d+\/\d+$/.test(shard ?? '')) {
    throw new Error('A Vitest shard in <index>/<count> format is required.');
  }
  const [index, count] = shard.split('/').map(Number);
  if (index < 1 || count < 1 || index > count) {
    throw new Error(`Invalid Vitest shard ${shard}.`);
  }

  const maxWorkers =
    named['max-workers'] ?? env.COVERAGE_SHARD_MAX_WORKERS ?? remaining.shift() ?? '2';
  if (!/^\d+$/.test(maxWorkers) || Number(maxWorkers) < 1) {
    throw new Error(`Invalid coverage shard worker count ${maxWorkers}.`);
  }

  const artifactRoot =
    env.COVERAGE_SHARD_ARTIFACT_DIR ?? path.join(tempDirectory, 'polity-coverage-shards');
  const reportsDirectory = path.resolve(
    named['reports-directory'] ??
      env.COVERAGE_SHARD_REPORTS_DIRECTORY ??
      remaining.shift() ??
      path.join(artifactRoot, `${index}-of-${count}`)
  );
  if (remaining.length > 0) {
    throw new Error(`Unexpected positional arguments: ${remaining.join(' ')}`);
  }

  return { help: false, shard, index, count, maxWorkers, reportsDirectory };
}

export function buildVitestShardArguments({ shard, maxWorkers, reportsDirectory }) {
  return [
    'run',
    '--config',
    'vitest.coverage.config.ts',
    '--project',
    'unit',
    '--project',
    'component',
    '--project',
    'component-flow',
    '--project',
    'service-integration',
    '--coverage',
    '--passWithNoTests',
    '--reporter=blob',
    `--shard=${shard}`,
    `--maxWorkers=${maxWorkers}`,
    `--coverage.reportsDirectory=${reportsDirectory}`,
  ];
}

export function runCoverageShard({
  argv = process.argv.slice(2),
  env = process.env,
  root = process.cwd(),
  spawn = spawnSync,
} = {}) {
  let options;
  try {
    options = parseCoverageShardOptions({ argv, env });
  } catch (error) {
    console.error(error.message);
    console.error(COVERAGE_SHARD_USAGE);
    return 1;
  }
  if (options.help) {
    console.info(COVERAGE_SHARD_USAGE);
    return 0;
  }

  const vitestCli = path.resolve(root, 'node_modules/vitest/vitest.mjs');
  if (!fs.existsSync(vitestCli)) {
    console.error(`Vitest CLI missing at ${vitestCli}. Run pnpm install --frozen-lockfile first.`);
    return 1;
  }
  fs.mkdirSync(options.reportsDirectory, { recursive: true });

  const result = spawn(process.execPath, [vitestCli, ...buildVitestShardArguments(options)], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    console.error(`Could not start coverage shard ${options.shard}: ${result.error.message}`);
    return 1;
  }
  if (result.status !== 0) return result.status ?? 1;
  console.info(
    `Coverage shard ${options.shard} completed; intermediate files: ${options.reportsDirectory}`
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runCoverageShard();
}
