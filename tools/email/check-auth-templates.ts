import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

import {
  getSupabaseAuthTemplateDefinition,
  renderSupabaseAuthTemplate,
  supabaseAuthTemplateSlugs,
} from '../../emails/auth/_registry';

export async function checkSupabaseAuthTemplates(logger: Pick<Console, 'log'> = console) {
  const fields = new Set<string>();
  for (const slug of supabaseAuthTemplateSlugs) {
    const definition = getSupabaseAuthTemplateDefinition(slug);
    const html = await renderSupabaseAuthTemplate(slug);

    assertUnique(fields, definition.subjectField);
    assertUnique(fields, definition.contentField);
    assertIncludes(definition.subject, '{{ if eq .Data.language `de` }}', slug);
    assertIncludes(definition.subject, '{{ else }}', slug);
    assertIncludes(html, '{{ if eq .Data.language `de` }}', slug);
    assertIncludes(html, '{{ else }}', slug);
    assertIncludes(html, '{{ end }}', slug);
    assertIncludes(html, '{{ .SiteURL }}/android-chrome-192x192.png', slug);

    if (!slug.endsWith('_notification') && slug !== 'reauthentication') {
      assertIncludes(html, '{{ .ConfirmationURL }}', slug);
    }
    if (slug === 'magic_link' || slug === 'reauthentication') {
      assertIncludes(html, '{{ .Token }}', slug);
    }
    logger.log(`ok ${slug} (${html.length} HTML chars)`);
  }
  return { fields: fields.size, templates: supabaseAuthTemplateSlugs.length };
}

export function assertUnique(fields: Set<string>, field: string) {
  if (fields.has(field)) throw new Error(`Duplicate Management API field: ${field}`);
  fields.add(field);
}

export function assertIncludes(value: string, expected: string, slug: string) {
  if (!value.includes(expected)) throw new Error(`${slug} is missing ${expected}`);
}

await runCliIfMain(import.meta.url, checkSupabaseAuthTemplates);
