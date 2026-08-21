import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

import { config as loadEnvFile } from 'dotenv';
import { Resend } from 'resend';

import {
  getPolityTemplateDefinition,
  isPolityTemplateSlug,
  renderPolityTemplate,
  type PolityTemplateEnvironment,
  type PolityTemplateLocale,
} from '../../emails/_registry';
import {
  assertTemplateEnvironment,
  deployPolityTemplate,
} from '../../src/server/resend-template-deployment';

export interface CliOptions {
  confirmAlias?: string;
  dryRun: boolean;
  environment: PolityTemplateEnvironment;
  locale: PolityTemplateLocale;
  slug: string;
}

export async function runPolityTemplateDeployCli(
  dependencies: {
    args?: string[];
    env?: NodeJS.ProcessEnv;
    isTemplateSlug?: typeof isPolityTemplateSlug;
    load?: typeof loadEnvironment;
    assertEnvironment?: typeof assertTemplateEnvironment;
    getDefinition?: typeof getPolityTemplateDefinition;
    render?: typeof renderPolityTemplate;
    confirm?: typeof confirmProduction;
    createClient?: (apiKey: string) => Parameters<typeof deployPolityTemplate>[0]['client'];
    deploy?: typeof deployPolityTemplate;
  } = {}
) {
  const env = dependencies.env ?? process.env;
  const options = parseOptions(dependencies.args ?? process.argv.slice(2));
  if (!(dependencies.isTemplateSlug ?? isPolityTemplateSlug)(options.slug)) {
    throw new Error(`Unknown template "${options.slug}". Use newsletter or product-update.`);
  }

  (dependencies.load ?? loadEnvironment)(options.environment);
  (dependencies.assertEnvironment ?? assertTemplateEnvironment)(
    options.environment,
    env.NEWSLETTER_ENVIRONMENT
  );

  const definition = (dependencies.getDefinition ?? getPolityTemplateDefinition)(
    options.slug,
    options.environment,
    options.locale
  );
  const rendered = await (dependencies.render ?? renderPolityTemplate)(definition);

  if (options.environment === 'production' && !options.dryRun) {
    await (dependencies.confirm ?? confirmProduction)(definition.alias, options.confirmAlias);
  }

  const apiKey = options.dryRun ? 'dry-run' : requireEnv('RESEND_API_KEY', env);
  const client = dependencies.createClient
    ? dependencies.createClient(apiKey)
    : new Resend(apiKey).templates;
  await (dependencies.deploy ?? deployPolityTemplate)({
    client,
    definition,
    dryRun: options.dryRun,
    rendered,
  });
  return { alias: definition.alias, dryRun: options.dryRun };
}

export async function main() {
  await runPolityTemplateDeployCli();
}

export function parseOptions(args: string[]): CliOptions {
  let confirmAlias: string | undefined;
  let dryRun = false;
  let environment: PolityTemplateEnvironment = 'development';
  let locale: PolityTemplateLocale = 'de';
  let slug: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (argument === '--confirm-alias') {
      const value = args[index + 1];
      if (!value) throw new Error('--confirm-alias requires the exact production alias');
      confirmAlias = value;
      index += 1;
      continue;
    }
    if (argument.startsWith('--confirm-alias=')) {
      confirmAlias = argument.slice('--confirm-alias='.length);
      continue;
    }
    if (argument === '--environment') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--environment requires development or production');
      }
      environment = parseEnvironment(value);
      index += 1;
      continue;
    }
    if (argument.startsWith('--environment=')) {
      environment = parseEnvironment(argument.slice('--environment='.length));
      continue;
    }
    if (argument === '--locale') {
      const value = args[index + 1];
      if (!value) throw new Error('--locale requires de or en');
      locale = parseLocale(value);
      index += 1;
      continue;
    }
    if (argument.startsWith('--locale=')) {
      locale = parseLocale(argument.slice('--locale='.length));
      continue;
    }
    if (argument.startsWith('--')) {
      throw new Error(`Unknown option "${argument}"`);
    }
    if (slug && (argument === 'development' || argument === 'production')) {
      environment = argument;
      continue;
    }
    if (slug) {
      throw new Error(`Unexpected argument "${argument}"`);
    }
    slug = argument;
  }

  if (!slug) {
    throw new Error(
      'Template slug is required. Example: pnpm run email:template:deploy -- newsletter'
    );
  }

  return { confirmAlias, dryRun, environment, locale, slug };
}

export function parseEnvironment(value: string): PolityTemplateEnvironment {
  if (value !== 'development' && value !== 'production') {
    throw new Error(`Invalid environment "${value}". Use development or production.`);
  }
  return value;
}

export function parseLocale(value: string): PolityTemplateLocale {
  if (value !== 'de' && value !== 'en') {
    throw new Error(`Invalid locale "${value}". Use de or en.`);
  }
  return value;
}

export function loadEnvironment(environment: PolityTemplateEnvironment) {
  loadEnvFile({
    path: resolve(`.env.${environment}.local`),
    override: false,
    quiet: true,
  });
  loadEnvFile({ path: resolve('.env'), override: false, quiet: true });
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
        `Production template deployment was not confirmed: expected alias "${alias}"`
      );
    }
    return;
  }

  const inputIsTTY = options.inputIsTTY ?? process.stdin.isTTY;
  const outputIsTTY = options.outputIsTTY ?? process.stdout.isTTY;
  if (!inputIsTTY || !outputIsTTY) {
    throw new Error(
      'Production template deployment requires an interactive terminal or --confirm-alias'
    );
  }

  const readline = (options.createReadline ?? createInterface)({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await readline.question(
      `Type the production template alias to publish it:\n${alias}\n> `
    );
    if (answer.trim() !== alias) {
      throw new Error('Production template deployment was not confirmed');
    }
  } finally {
    readline.close();
  }
}

export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function reportMainError(
  error: unknown,
  logger: Pick<Console, 'error'> = console,
  processState: { exitCode?: NodeJS.Process['exitCode'] } = process
) {
  logger.error(error instanceof Error ? error.stack : error);
  processState.exitCode = 1;
}

await runCliIfMain(import.meta.url, main, { onError: reportMainError });
