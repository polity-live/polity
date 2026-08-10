import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

import {
  getSupabaseAuthTemplateDefinition,
  renderSupabaseAuthTemplate,
  supabaseAuthTemplateSlugs,
} from '../../emails/auth/_registry';

export async function buildSupabaseAuthTemplates(
  options: {
    outputDirectory?: string;
    logger?: Pick<Console, 'log'>;
    write?: typeof writeFile;
  } = {}
) {
  const outputDirectory = resolve(options.outputDirectory ?? 'supabase/email-templates');
  const logger = options.logger ?? console;
  const write = options.write ?? writeFile;
  const written: string[] = [];
  for (const slug of supabaseAuthTemplateSlugs) {
    const definition = getSupabaseAuthTemplateDefinition(slug);
    const html = await renderSupabaseAuthTemplate(slug);
    const target = resolve(outputDirectory, definition.fileName);
    await write(target, `${html}\n`, 'utf8');
    logger.log(`wrote ${definition.fileName} (${html.length} HTML chars)`);
    written.push(target);
  }
  return written;
}

await runCliIfMain(import.meta.url, buildSupabaseAuthTemplates);
