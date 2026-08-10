import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

import { config as loadEnvFile } from 'dotenv';

import { deploySupabaseAuthTemplates } from '../../src/server/supabase-auth-template-deployment';

interface AuthTemplateDeployOptions {
  confirmAlias?: string;
  dryRun: boolean;
  environment: 'development' | 'production';
}

export function parseAuthTemplateDeployOptions(
  args: string[],
  env: NodeJS.ProcessEnv = process.env
): AuthTemplateDeployOptions {
  const valueAfter = (name: string) => {
    const inline = args.find(argument => argument.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const environment = valueAfter('--environment') ?? 'development';
  if (environment !== 'development' && environment !== 'production') {
    throw new Error('--environment must be development or production');
  }
  return {
    environment,
    dryRun: args.includes('--dry-run'),
    confirmAlias: valueAfter('--confirm-alias') ?? env.SUPABASE_AUTH_TEMPLATE_CONFIRM_ALIAS,
  };
}

export async function runAuthTemplateDeployCli(
  options: {
    args?: string[];
    env?: NodeJS.ProcessEnv;
    loadEnvironmentFile?: typeof loadEnvFile;
    deploy?: typeof deploySupabaseAuthTemplates;
    confirm?: typeof confirmProduction;
    logger?: Pick<Console, 'log'>;
  } = {}
) {
  const args = options.args ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const parsed = parseAuthTemplateDeployOptions(args, env);
  const load = options.loadEnvironmentFile ?? loadEnvFile;
  load({ path: resolve(`.env.${parsed.environment}.local`), override: false, quiet: true });
  load({ path: resolve('.env'), override: false, quiet: true });

  const projectRef = requiredEnv(env, 'SUPABASE_PROJECT_REF');
  const accessToken = requiredEnv(env, 'SUPABASE_ACCESS_TOKEN');
  const deploymentAlias = `polity-auth-templates-${parsed.environment}`;
  if (parsed.environment === 'production' && !parsed.dryRun) {
    await (options.confirm ?? confirmProduction)(deploymentAlias, parsed.confirmAlias);
  }
  const result = await (options.deploy ?? deploySupabaseAuthTemplates)({
    accessToken,
    dryRun: parsed.dryRun,
    projectRef,
  });
  const output = {
    alias: deploymentAlias,
    changedFields: result.changedFields,
    deployed: result.deployed,
    dryRun: parsed.dryRun,
  };
  (options.logger ?? console).log(JSON.stringify(output, null, 2));
  return output;
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export async function confirmProduction(
  alias: string,
  providedAlias?: string,
  options: {
    createReadline?: typeof createInterface;
    inputIsTTY?: boolean;
    outputIsTTY?: boolean;
  } = {}
) {
  if (providedAlias !== undefined) {
    if (providedAlias !== alias) {
      throw new Error(
        `Production auth template deployment was not confirmed: expected alias "${alias}"`
      );
    }
    return;
  }
  const inputIsTTY = options.inputIsTTY ?? process.stdin.isTTY;
  const outputIsTTY = options.outputIsTTY ?? process.stdout.isTTY;
  if (!inputIsTTY || !outputIsTTY) {
    throw new Error(
      'Production auth template deployment requires an interactive terminal or --confirm-alias'
    );
  }
  const readline = (options.createReadline ?? createInterface)({
    input: process.stdin,
    output: process.stdout,
  });
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

await runCliIfMain(import.meta.url, runAuthTemplateDeployCli);
