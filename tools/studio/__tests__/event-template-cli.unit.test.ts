import { afterEach, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';

const io = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('node:fs', () => ({ readFileSync: io.read, writeFileSync: io.write }));
const originalArgs = [...process.argv];
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
afterEach(() => {
  process.argv = [...originalArgs];
  Object.defineProperty(process, 'platform', originalPlatform);
  vi.resetModules();
  vi.clearAllMocks();
});

it.each(['win32', 'linux'])('recognizes its executable entry path on %s', async platform => {
  Object.defineProperty(process, 'platform', { ...originalPlatform, value: platform });
  io.read.mockReturnValue(
    '-- EVENT_TEMPLATE_ROWS\nold\n\nCREATE TABLE public.studio_live_source(id uuid);'
  );
  const entry = resolve('tools/studio/build-event-templates.ts');
  process.argv = [
    process.execPath,
    platform === 'win32' ? entry.toUpperCase() : entry,
    '--schema-only',
  ];
  vi.resetModules();
  await import('../build-event-templates');
  expect(io.write).toHaveBeenCalledOnce();
});

it.each([false, true])(
  'regenerates canonical SQL templates with schema-only=%s',
  async schemaOnly => {
    const schema =
      '-- Existing schema\r\n-- EVENT_TEMPLATE_ROWS\r\nold rows\r\n\r\nCREATE TABLE public.studio_live_source(id uuid);';
    io.read.mockReturnValue(schema);
    process.argv = [
      process.execPath,
      resolve('tools/studio/build-event-templates.ts'),
      ...(schemaOnly ? ['--schema-only'] : []),
    ];
    vi.resetModules();
    const { eventTemplateSqlRows } = await import('../build-event-templates');
    const expected = `-- MANUAL_SQL: Required Event Studio template rows; schema diffs never emit DML.\n-- EVENT_TEMPLATE_ROWS\n${eventTemplateSqlRows()}\n`;
    expect(io.write).toHaveBeenCalledWith('supabase/schemas/99_event_templates.sql', expected);
    expect(io.write).toHaveBeenCalledOnce();
    expect(expected).not.toContain('\r');
    expect(expected.match(/INSERT INTO public.studio_event_template/g)).toHaveLength(9);
    expect(expected.match(/ON CONFLICT\(kind\)/g)).toHaveLength(9);
  }
);

it('does not rewrite files when imported with no executable entry path', async () => {
  process.argv = [process.execPath];
  vi.resetModules();
  const { eventTemplateSqlRows } = await import('../build-event-templates');
  expect(eventTemplateSqlRows()).toContain('INSERT INTO public.studio_event_template');
  expect(io.write).not.toHaveBeenCalled();
});
