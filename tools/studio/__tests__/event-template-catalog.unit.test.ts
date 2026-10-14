import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { eventTemplateSqlRows } from '../build-event-templates';
import { studioDocumentV3Schema } from '../../../src/features/communication-studio/logic/document-v3';
it('generates deterministic valid SQL templates for every supported agenda type', () => {
  const first = eventTemplateSqlRows();
  expect(
    readFileSync('supabase/schemas/75_event_studio.sql', 'utf8').replace(/\r\n/g, '\n')
  ).toContain(first);
  expect(readFileSync('supabase/migrations/20261011030000_event_intro.sql', 'utf8')).toContain(
    first
      .split('\n')[0]
      .replace(/;$/, ' ON CONFLICT(kind) DO UPDATE SET document=EXCLUDED.document;')
  );
  expect(eventTemplateSqlRows()).toBe(first);
  const rows = Array.from(first.matchAll(/\$template\$(.*?)\$template\$/g));
  expect(rows).toHaveLength(9);
  for (const row of rows)
    expect(studioDocumentV3Schema.safeParse(JSON.parse(row[1])).success).toBe(true);
});
