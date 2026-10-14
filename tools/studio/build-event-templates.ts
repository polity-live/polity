import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEventTemplate,
  eventTemplateTypes,
} from '../../src/features/communication-studio/logic/event-templates';
const file = 'supabase/schemas/99_event_templates.sql';
export function eventTemplateSqlRows() {
  return eventTemplateTypes
    .map(kind => {
      const document = createEventTemplate(kind, '00000000-0000-4000-8000-000000000000');
      const ids = new Set<string>();
      const collect = (value: any) => {
        if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === 'object')
          Object.entries(value).forEach(([key, v]) => {
            if (key === 'eventSource') return;
            if (key === 'id' && typeof v === 'string') ids.add(v);
            else collect(v);
          });
      };
      collect(document.nodes);
      let json = JSON.stringify(document);
      [...ids].forEach((id, index) => {
        const h = createHash('sha256').update(`event-template:${kind}:${index}`).digest('hex');
        const stable = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
        json = json.replaceAll(id, stable);
      });
      return `INSERT INTO public.studio_event_template(kind,document) VALUES('${kind}',$template$${json}$template$::jsonb) ON CONFLICT(kind) DO UPDATE SET document=EXCLUDED.document;`;
    })
    .join('\n');
}
const entryPath = process.argv[1] ? resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);
if (
  entryPath &&
  (process.platform === 'win32'
    ? entryPath.toLowerCase() === modulePath.toLowerCase()
    : entryPath === modulePath)
) {
  const rows = eventTemplateSqlRows();
  // Edit the canonical source only. Migration delivery must follow the reviewed
  // schema workflow; rebuilding templates must never resurrect old migrations.
  writeFileSync(
    file,
    `-- MANUAL_SQL: Required Event Studio template rows; schema diffs never emit DML.\n-- EVENT_TEMPLATE_ROWS\n${rows}\n`
  );
}
