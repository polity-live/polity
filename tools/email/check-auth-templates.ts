import {
  getSupabaseAuthTemplateDefinition,
  renderSupabaseAuthTemplate,
  supabaseAuthTemplateSlugs,
} from '../../emails/auth/_registry';

const fields = new Set<string>();
for (const slug of supabaseAuthTemplateSlugs) {
  const definition = getSupabaseAuthTemplateDefinition(slug);
  const html = await renderSupabaseAuthTemplate(slug);

  assertUnique(definition.subjectField);
  assertUnique(definition.contentField);
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

  console.log(`ok ${slug} (${html.length} HTML chars)`);
}

function assertUnique(field: string) {
  if (fields.has(field)) throw new Error(`Duplicate Management API field: ${field}`);
  fields.add(field);
}

function assertIncludes(value: string, expected: string, slug: string) {
  if (!value.includes(expected)) {
    throw new Error(`${slug} is missing ${expected}`);
  }
}
