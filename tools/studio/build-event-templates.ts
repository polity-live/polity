import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEventTemplate,
  eventTemplateTypes,
} from '../../src/features/communication-studio/logic/event-templates';
const file = 'supabase/schemas/75_event_studio.sql';
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
      return `INSERT INTO public.studio_event_template(kind,document) VALUES('${kind}',$template$${json}$template$::jsonb);`;
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
  const schema = readFileSync(file, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(
      /-- EVENT_TEMPLATE_ROWS[\s\S]*?\n\nCREATE TABLE public.studio_live_source/,
      `-- EVENT_TEMPLATE_ROWS\n${rows}\n\nCREATE TABLE public.studio_live_source`
    );
  writeFileSync(file, schema);
  if (!process.argv.includes('--schema-only'))
    writeFileSync('supabase/migrations/20261011010000_event_studio.sql', schema);
}
