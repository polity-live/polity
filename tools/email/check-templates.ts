import {
  getPolityTemplateDefinition,
  polityTemplateLocales,
  polityTemplateSlugs,
  renderPolityTemplate,
  type PolityTemplateEnvironment,
} from '../../emails/_registry';

const environments: PolityTemplateEnvironment[] = ['development', 'production'];
const aliases = new Set<string>();

for (const environment of environments) {
  for (const slug of polityTemplateSlugs) {
    for (const locale of polityTemplateLocales) {
      const definition = getPolityTemplateDefinition(slug, environment, locale);
      if (aliases.has(definition.alias)) {
        throw new Error(`Duplicate template alias: ${definition.alias}`);
      }
      aliases.add(definition.alias);

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

      console.log(`ok ${definition.alias} (${html.length} HTML chars, ${text.length} text chars)`);
    }
  }
}

function assertIncludes(value: string, expected: string, alias: string) {
  if (!value.includes(expected)) {
    throw new Error(`${alias} is missing ${expected}`);
  }
}
