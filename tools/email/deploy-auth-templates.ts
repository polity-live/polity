import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { config as loadEnvFile } from 'dotenv';

import { deploySupabaseAuthTemplates } from '../../src/server/supabase-auth-template-deployment';

const args = new Set(process.argv.slice(2));
const environment = valueAfter('--environment') ?? 'development';
const dryRun = args.has('--dry-run');
const confirmAlias =
  valueAfter('--confirm-alias') ?? process.env.SUPABASE_AUTH_TEMPLATE_CONFIRM_ALIAS;

if (environment !== 'development' && environment !== 'production') {
  throw new Error('--environment must be development or production');
}

loadEnvFile({ path: resolve(`.env.${environment}.local`), override: false, quiet: true });
loadEnvFile({ path: resolve('.env'), override: false, quiet: true });

const projectRef = requiredEnv('SUPABASE_PROJECT_REF');
const accessToken = requiredEnv('SUPABASE_ACCESS_TOKEN');
const deploymentAlias = `polity-auth-templates-${environment}`;

if (environment === 'production' && !dryRun) {
  await confirmProduction(deploymentAlias, confirmAlias);
}

const result = await deploySupabaseAuthTemplates({
  accessToken,
  dryRun,
  projectRef,
});
console.log(
  JSON.stringify(
    {
      alias: deploymentAlias,
      changedFields: result.changedFields,
      deployed: result.deployed,
      dryRun,
    },
    null,
    2
  )
);

function valueAfter(name: string) {
  const rawArgs = process.argv.slice(2);
  const inline = rawArgs.find(argument => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = rawArgs.indexOf(name);
  return index >= 0 ? rawArgs[index + 1] : undefined;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function confirmProduction(alias: string, providedAlias?: string) {
  if (providedAlias !== undefined) {
    if (providedAlias !== alias) {
      throw new Error(
        `Production auth template deployment was not confirmed: expected alias "${alias}"`
      );
    }
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'Production auth template deployment requires an interactive terminal or --confirm-alias'
    );
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(
      `Type the production deployment alias to continue:\n${alias}\n> `
    );
    if (answer.trim() !== alias) {
      throw new Error('Production auth template deployment was not confirmed');
    }
  } finally {
    readline.close();
  }
}
