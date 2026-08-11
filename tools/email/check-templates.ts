import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

import {
  getPolityTemplateDefinition,
  polityTemplateLocales,
  polityTemplateSlugs,
  renderPolityTemplate,
  type PolityTemplateEnvironment,
} from '../../emails/_registry';

export async function checkPolityTemplates(logger: Pick<Console, 'log'> = console) {
  const environments: PolityTemplateEnvironment[] = ['development', 'production'];
  const aliases = new Set<string>();
  for (const environment of environments) {
    for (const slug of polityTemplateSlugs) {
      for (const locale of polityTemplateLocales) {
        const definition = getPolityTemplateDefinition(slug, environment, locale);
        assertUniqueAlias(aliases, definition.alias);

        const { html, text } = await renderPolityTemplate(definition);
        assertIncludes(html, `lang="${locale}"`, definition.alias);
        assertIncludes(html, '{{{RESEND_UNSUBSCRIBE_URL}}}', definition.alias);
        assertIncludes(html, 'https://www.polity.live/imprint', definition.alias);
        assertIncludes(html, 'https://www.polity.live/privacy-policy', definition.alias);
        assertIncludes(
          text,
          locale === 'de' ? 'Newsletter abbestellen' : 'Unsubscribe from newsletter',
          definition.alias
        );
        logger.log(`ok ${definition.alias} (${html.length} HTML chars, ${text.length} text chars)`);
      }
    }
  }
  return { aliases: aliases.size };
}

export function assertUniqueAlias(aliases: Set<string>, alias: string) {
  if (aliases.has(alias)) throw new Error(`Duplicate template alias: ${alias}`);
  aliases.add(alias);
}

export function assertIncludes(value: string, expected: string, alias: string) {
  if (!value.includes(expected)) throw new Error(`${alias} is missing ${expected}`);
}

await runCliIfMain(import.meta.url, checkPolityTemplates);
