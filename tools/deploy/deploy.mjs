#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ── ANSI colors ──────────────────────────────────────────────
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// ── Parse CLI flags ──────────────────────────────────────────
const args = new Set(process.argv.slice(2));

const skipSupabaseFlag = args.has('--skip-supabase');
const skipFlyFlag = args.has('--skip-fly');
const skipVercelFlag = args.has('--skip-vercel');
const deployAll = args.has('--all') || args.has('--yes');
const dryRun = args.has('--dry-run');

const ALLOWED_FLAGS = new Set([
  '--skip-supabase',
  '--skip-fly',
  '--skip-vercel',
  '--all',
  '--yes',
  '--dry-run',
]);

for (const arg of args) {
  if (!ALLOWED_FLAGS.has(arg)) {
    error(`Unknown flag: ${arg}`);
    info(`Allowed flags: ${[...ALLOWED_FLAGS].join(', ')}`);
    process.exit(1);
  }
}

// ── Helpers ──────────────────────────────────────────────────
function info(msg) {
}

function success(msg) {
}

function warn(msg) {
}

function error(msg) {
  console.error(`${RED}✖${RESET}  ${msg}`);
}

function step(label) {
}

function run(label, cmd) {
  info(`${label}: ${BOLD}${cmd}${RESET}`);
  if (dryRun) {
    warn('(dry-run) skipped');
    return;
  }
  execSync(cmd, { stdio: 'inherit' });
}

function hasCommand(name) {
  try {
    const check = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
    execSync(check, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function formatTargets({ supabase, fly, vercel }) {
  const selected = [];
  if (vercel) {
    selected.push('Frontend → Vercel');
  }
  if (supabase) {
    selected.push('Supabase → Supabase');
  }
  if (fly) {
    selected.push('Docker/Zero → Fly.io');
  }
  return selected.length ? selected.join(', ') : 'none';
}

async function confirmTarget(readline, question, defaultValue = true) {
  const hint = defaultValue ? 'Y/n' : 'y/N';

  while (true) {
    const answer = (await readline.question(`${question} (${hint}) `)).trim().toLowerCase();

    if (!answer) {
      return defaultValue;
    }

    if (['y', 'yes', 'j', 'ja'].includes(answer)) {
      return true;
    }

    if (['n', 'no', 'nein'].includes(answer)) {
      return false;
    }

    warn('Please answer with y/yes/j/ja or n/no/nein.');
  }
}

async function promptDeployTargets() {
  step('Deploy targets');
  info('Choose which parts should be deployed. Press Enter for yes.');

  const readline = createInterface({ input, output });

  try {
    return {
      vercel: await confirmTarget(readline, 'Deploy frontend to Vercel?'),
      supabase: await confirmTarget(readline, 'Deploy Supabase migrations to Supabase?'),
      fly: await confirmTarget(readline, 'Deploy Docker/Zero to Fly.io?'),
    };
  } finally {
    readline.close();
  }
}

const skipFlagsProvided = skipSupabaseFlag || skipFlyFlag || skipVercelFlag;
const promptForTargets = !deployAll && !skipFlagsProvided;

if (promptForTargets && !input.isTTY) {
  error('Interactive target selection requires a terminal.');
  info('Use --all for a full deploy or --skip-* flags for non-interactive target selection.');
  process.exit(1);
}

const targets = promptForTargets
  ? await promptDeployTargets()
  : {
      supabase: !skipSupabaseFlag,
      fly: !skipFlyFlag,
      vercel: !skipVercelFlag,
    };

const skipSupabase = !targets.supabase;
const skipFly = !targets.fly;
const skipVercel = !targets.vercel;

if (!promptForTargets) {
  step('Deploy targets');
}

info(`Selected: ${formatTargets(targets)}`);

if (!targets.supabase && !targets.fly && !targets.vercel) {
  warn('No deploy targets selected. Nothing to do.');
  process.exit(0);
}

// ── 1. Git branch check ─────────────────────────────────────
step('Pre-flight checks');

const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
const allowedBranches = ['master', 'deploy'];

if (!allowedBranches.includes(branch)) {
  error(
    `Current branch is "${branch}". Deploy is only allowed from: ${allowedBranches.join(', ')}`
  );
  process.exit(1);
}

success(`Branch: ${branch}`);

// ── 2. CLI availability ──────────────────────────────────────
// Fly CLI can be "flyctl" or "fly" depending on the install method
const flyBin = hasCommand('flyctl') ? 'flyctl' : 'fly';

const cliChecks = [
  { name: 'supabase', skip: skipSupabase },
  { name: 'fly', skip: skipFly, cmd: flyBin },
  { name: 'vercel', skip: skipVercel },
];

for (const { name, skip, cmd } of cliChecks) {
  if (skip) {
    info(`${name} CLI check skipped (--skip-${name})`);
    continue;
  }
  const bin = cmd || name;
  if (!hasCommand(bin)) {
    error(`"${bin}" CLI not found. Install it or pass --skip-${name}`);
    process.exit(1);
  }
  success(`${name} CLI found (${bin})`);
}

// ── 3. Project linking checks ────────────────────────────────
if (!skipVercel && !existsSync(resolve('.vercel/project.json'))) {
  error('Vercel project not linked. Run: vercel link');
  process.exit(1);
}

if (dryRun) {
  warn('Running in dry-run mode — commands will be printed but not executed.\n');
}

// ── 4. Supabase: push migrations ─────────────────────────────
if (!skipSupabase) {
  step('Supabase — push migrations');
  run('Pushing migrations', 'supabase db push');
  success('Supabase migrations applied');
} else {
  info('Supabase step skipped');
}

// ── 5. Fly.io: deploy Zero ───────────────────────────────────
if (!skipFly) {
  step('Fly.io — deploy Zero');
  run('Deploying zero-cache', `${flyBin} deploy --yes`);
  success('Fly.io deploy complete');

  // Healthcheck polling
  if (!dryRun) {
    info('Waiting for zero-cache healthcheck…');
    const healthUrl = 'https://zero.polity.live/keepalive';
    const timeout = 180_000;
    const interval = 5_000;
    const start = Date.now();
    let healthy = false;
    let lastError = '';

    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(healthUrl);
        if (res.ok) {
          healthy = true;
          break;
        }
        const body = await res.text().catch(() => '');
        lastError = `HTTP ${res.status}${body ? ': ' + body.slice(0, 200) : ''}`;
      } catch (err) {
        lastError = err.cause?.code || err.message || String(err);
      }
      await new Promise(r => setTimeout(r, interval));
    }

    if (healthy) {
      success('zero-cache is healthy');
    } else {
      warn(`zero-cache did not become healthy within ${timeout / 1000}s — continuing anyway`);
      if (lastError) {
        warn(`Last error: ${lastError}`);
      }
      info(`Check Fly.io logs: ${flyBin} logs`);
    }
  }
} else {
  info('Fly.io step skipped');
}

// ── 6. Vercel: deploy app ────────────────────────────────────
if (!skipVercel) {
  step('Vercel — deploy app');
  run('Deploying to production', 'vercel --prod');
  success('Vercel deploy complete');
} else {
  info('Vercel step skipped');
}

// ── Done ─────────────────────────────────────────────────────
