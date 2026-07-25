import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  getSupabaseAuthTemplateDefinition,
  renderSupabaseAuthTemplate,
  supabaseAuthTemplateSlugs,
} from '../../emails/auth/_registry';

for (const slug of supabaseAuthTemplateSlugs) {
  const definition = getSupabaseAuthTemplateDefinition(slug);
  const html = await renderSupabaseAuthTemplate(slug);
  const path = resolve('supabase/email-templates', definition.fileName);
  await writeFile(path, `${html}\n`, 'utf8');
  console.log(`wrote ${definition.fileName} (${html.length} HTML chars)`);
}
