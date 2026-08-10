/* global console, fetch, setTimeout */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process, { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const ALLOWED_FLAGS = new Set([
  '--skip-supabase',
  '--skip-fly',
  '--skip-vercel',
  '--all',
  '--yes',
  '--dry-run',
]);

export function parseDeployOptions(argv) {
  const args = new Set(argv);
  for (const argument of args) {
    if (!ALLOWED_FLAGS.has(argument)) throw new Error(`Unknown flag: ${argument}`);
  }
  const skipSupabase = args.has('--skip-supabase');
  const skipFly = args.has('--skip-fly');
  const skipVercel = args.has('--skip-vercel');
  const deployAll = args.has('--all') || args.has('--yes');
  return {
    deployAll,
    dryRun: args.has('--dry-run'),
    promptForTargets: !deployAll && !skipSupabase && !skipFly && !skipVercel,
    targets: {
      supabase: !skipSupabase,
      fly: !skipFly,
      vercel: !skipVercel,
    },
  };
}

export function createReporter(logger = console) {
  return {
    info: message => logger.log(`${CYAN}ℹ${RESET}  ${message}`),
    success: message => logger.log(`${GREEN}✔${RESET}  ${message}`),
    warn: message => logger.warn(`${YELLOW}⚠${RESET}  ${message}`),
    error: message => logger.error(`${RED}✖${RESET}  ${message}`),
    step: label => logger.log(`\n${CYAN}${BOLD}${label}${RESET}`),
  };
}

export function hasCommand(name, options = {}) {
  const execute = options.execute ?? execSync;
  const platform = options.platform ?? process.platform;
  try {
    execute(platform === 'win32' ? `where ${name}` : `which ${name}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function formatTargets({ supabase, fly, vercel }) {
  const selected = [];
  if (vercel) selected.push('Frontend → Vercel');
  if (supabase) selected.push('Supabase → Supabase');
  if (fly) selected.push('Docker/Zero → Fly.io');
  return selected.length === 0 ? 'none' : selected.join(', ');
}

export async function confirmTarget(readline, question, defaultValue = true, warn = console.warn) {
  const hint = defaultValue ? 'Y/n' : 'y/N';
  while (true) {
    const answer = (await readline.question(`${question} (${hint}) `)).trim().toLowerCase();
    if (!answer) return defaultValue;
    if (['y', 'yes', 'j', 'ja'].includes(answer)) return true;
    if (['n', 'no', 'nein'].includes(answer)) return false;
    warn('Please answer with y/yes/j/ja or n/no/nein.');
  }
}

export async function promptDeployTargets(options = {}) {
  const reporter = options.reporter ?? createReporter();
  reporter.step('Deploy targets');
  reporter.info('Choose which parts should be deployed. Press Enter for yes.');
  const readline = (options.createReadline ?? createInterface)({
    input: options.input ?? input,
    output: options.output ?? output,
  });
  try {
    return {
      vercel: await confirmTarget(readline, 'Deploy frontend to Vercel?', true, reporter.warn),
      supabase: await confirmTarget(
        readline,
        'Deploy Supabase migrations to Supabase?',
        true,
        reporter.warn
      ),
      fly: await confirmTarget(readline, 'Deploy Docker/Zero to Fly.io?', true, reporter.warn),
    };
  } finally {
    readline.close();
  }
}

export async function waitForZeroHealth(options = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const wait = options.wait ?? (milliseconds => new Promise(resolveWait => setTimeout(resolveWait, milliseconds)));
  const timeout = options.timeout ?? 180_000;
  const interval = options.interval ?? 5_000;
  const start = now();
  let lastError = '';

  while (now() - start < timeout) {
    try {
      const response = await fetcher('https://zero.polity.live/keepalive');
      if (response.ok) return { healthy: true, lastError: '' };
      let body = '';
      try {
        body = await response.text();
      } catch {
        body = '';
      }
      lastError = `HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`;
    } catch (error) {
      lastError = error?.cause?.code ?? error?.message ?? String(error);
    }
    await wait(interval);
  }
  return { healthy: false, lastError };
}

export async function runDeployCli(options = {}) {
  const reporter = options.reporter ?? createReporter(options.logger);
  const parsed = parseDeployOptions(options.args ?? process.argv.slice(2));
  if (parsed.promptForTargets && !(options.inputIsTTY ?? input.isTTY)) {
    throw new Error(
      'Interactive target selection requires a terminal. Use --all or --skip-* flags.'
    );
  }
  const targets = parsed.promptForTargets
    ? await (options.promptTargets ?? promptDeployTargets)({ reporter })
    : parsed.targets;
  if (!parsed.promptForTargets) reporter.step('Deploy targets');
  reporter.info(`Selected: ${formatTargets(targets)}`);
  if (!targets.supabase && !targets.fly && !targets.vercel) {
    reporter.warn('No deploy targets selected. Nothing to do.');
    return { deployed: false, reason: 'no-targets', targets };
  }

  reporter.step('Pre-flight checks');
  const execute = options.execute ?? execSync;
  const branch = String(
    execute('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' })
  ).trim();
  const allowedBranches = ['master', 'deploy'];
  if (!allowedBranches.includes(branch)) {
    throw new Error(
      `Current branch is "${branch}". Deploy is only allowed from: ${allowedBranches.join(', ')}`
    );
  }
  reporter.success(`Branch: ${branch}`);

  const commandAvailable =
    options.commandAvailable ??
    (name => hasCommand(name, { execute, platform: options.platform ?? process.platform }));
  const flyBin = commandAvailable('flyctl') ? 'flyctl' : 'fly';
  const checks = [
    { name: 'supabase', enabled: targets.supabase },
    { name: 'fly', enabled: targets.fly, bin: flyBin },
    { name: 'vercel', enabled: targets.vercel },
  ];
  for (const check of checks) {
    if (!check.enabled) {
      reporter.info(`${check.name} CLI check skipped (--skip-${check.name})`);
      continue;
    }
    const bin = check.bin ?? check.name;
    if (!commandAvailable(bin)) {
      throw new Error(`"${bin}" CLI not found. Install it or pass --skip-${check.name}`);
    }
    reporter.success(`${check.name} CLI found (${bin})`);
  }

  const projectLinked = options.projectLinked ?? existsSync(resolve('.vercel/project.json'));
  if (targets.vercel && !projectLinked) throw new Error('Vercel project not linked. Run: vercel link');
  if (parsed.dryRun) reporter.warn('Running in dry-run mode — commands will be printed but not executed.\n');

  const run = (label, command) => {
    reporter.info(`${label}: ${BOLD}${command}${RESET}`);
    if (parsed.dryRun) {
      reporter.warn('(dry-run) skipped');
      return;
    }
    execute(command, { stdio: 'inherit' });
  };

  if (targets.supabase) {
    reporter.step('Supabase — push migrations');
    run('Pushing migrations', 'supabase db push');
    reporter.success('Supabase migrations applied');
    reporter.step('Supabase — apply production seed');
    run('Applying production seed', 'supabase db query --linked --file supabase/seed.production.sql');
    reporter.success('Supabase production seed applied');
  } else {
    reporter.info('Supabase step skipped');
  }

  if (targets.fly) {
    reporter.step('Fly.io — deploy Zero');
    run('Deploying zero-cache', `${flyBin} deploy --yes`);
    reporter.success('Fly.io deploy complete');
    if (!parsed.dryRun) {
      reporter.info('Waiting for zero-cache healthcheck…');
      const health = await (options.checkHealth ?? waitForZeroHealth)();
      if (health.healthy) {
        reporter.success('zero-cache is healthy');
      } else {
        reporter.warn('zero-cache did not become healthy within 180s — continuing anyway');
        if (health.lastError) reporter.warn(`Last error: ${health.lastError}`);
        reporter.info(`Check Fly.io logs: ${flyBin} logs`);
      }
    }
  } else {
    reporter.info('Fly.io step skipped');
  }

  if (targets.vercel) {
    reporter.step('Vercel — deploy app');
    run('Deploying to production', 'vercel --prod --archive=tgz');
    reporter.success('Vercel deploy complete');
  } else {
    reporter.info('Vercel step skipped');
  }
  return { deployed: !parsed.dryRun, dryRun: parsed.dryRun, targets };
}

export function reportDeployError(error, logger = console, processState = process) {
  createReporter(logger).error(error instanceof Error ? error.message : String(error));
  processState.exitCode = 1;
}

await runCliIfMain(import.meta.url, runDeployCli, { onError: reportDeployError });
