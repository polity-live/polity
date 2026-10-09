import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
if (!args.includes('--query') || !args[args.indexOf('--query') + 1])
  throw new Error(
    'Usage: pnpm zero:analyze --query <registered-name> [--case default|backward|next-page]'
  );
const child = spawn(
  process.execPath,
  ['tools/e2e/zero-performance/run.mjs', '--layer', 'queries', ...args],
  { stdio: 'inherit', shell: false, windowsHide: true }
);
child.once('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once('exit', code => {
  process.exitCode = code ?? 1;
});
