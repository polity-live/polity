import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

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

interface CliOptions {
  confirmAlias?: string;
  dryRun: boolean;
  environment: PolityTemplateEnvironment;
  locale: PolityTemplateLocale;
  slug: string;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (!isPolityTemplateSlug(options.slug)) {
    throw new Error(`Unknown template "${options.slug}". Use newsletter or product-update.`);
  }

  loadEnvironment(options.environment);
  assertTemplateEnvironment(options.environment, process.env.NEWSLETTER_ENVIRONMENT);

  const definition = getPolityTemplateDefinition(options.slug, options.environment, options.locale);
  const rendered = await renderPolityTemplate(definition);

  if (options.environment === 'production' && !options.dryRun) {
    await confirmProduction(definition.alias, options.confirmAlias);
  }

  const apiKey = options.dryRun ? 'dry-run' : requireEnv('RESEND_API_KEY');
  const resend = new Resend(apiKey);
  await deployPolityTemplate({
    client: resend.templates,
    definition,
    dryRun: options.dryRun,
    rendered,
  });
}

function parseOptions(args: string[]): CliOptions {
  let confirmAlias = process.env.npm_config_confirm_alias;
  let dryRun = process.env.npm_config_dry_run === 'true';
  let environment: PolityTemplateEnvironment =
    process.env.npm_config_environment === 'production' ||
    process.env.npm_config_environment === 'development'
      ? process.env.npm_config_environment
      : 'development';
  let locale: PolityTemplateLocale = process.env.npm_config_locale === 'en' ? 'en' : 'de';
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
      'Template slug is required. Example: npm run email:template:deploy -- newsletter'
    );
  }

  return { confirmAlias, dryRun, environment, locale, slug };
}

function parseEnvironment(value: string): PolityTemplateEnvironment {
  if (value !== 'development' && value !== 'production') {
    throw new Error(`Invalid environment "${value}". Use development or production.`);
  }
  return value;
}

function parseLocale(value: string): PolityTemplateLocale {
  if (value !== 'de' && value !== 'en') {
    throw new Error(`Invalid locale "${value}". Use de or en.`);
  }
  return value;
}

function loadEnvironment(environment: PolityTemplateEnvironment) {
  loadEnvFile({
    path: resolve(`.env.${environment}.local`),
    override: false,
    quiet: true,
  });
  loadEnvFile({ path: resolve('.env'), override: false, quiet: true });
}

async function confirmProduction(alias: string, providedAlias?: string) {
  if (providedAlias !== undefined) {
    if (providedAlias !== alias) {
      throw new Error(
        `Production template deployment was not confirmed: expected alias "${alias}"`
      );
    }
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'Production template deployment requires an interactive terminal or --confirm-alias'
    );
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });
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

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
