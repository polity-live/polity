import { spawn } from 'node:child_process';
import process from 'node:process';
import { config as loadDotEnv } from 'dotenv';

// Explicit CLI/CI values define the isolated stack. Dotenv files only fill gaps.
loadDotEnv({ path: '.env.development.local', override: false, quiet: true });
loadDotEnv({ path: '.env.test.local', override: false, quiet: true });

const [requestedCommand, ...args] = process.argv.slice(2);
if (!requestedCommand) throw new Error('run-with-env requires a command.');

const command = requestedCommand === 'node' ? process.execPath : requestedCommand;

const child = spawn(command, args, {
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', error => {
  throw error;
});

child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
