import assert from 'node:assert/strict';
import { checkDatabase, db } from './fixtures/db';
import { BUILTIN_THEMES } from '../src/features/shared/appearance-theme/presets';

async function assertBuiltinAppearanceThemes() {
  const rows = (await db()`
    select
      theme.id::text,
      theme.slug,
      theme.name,
      theme.description,
      theme.current_revision_id::text,
      revision.id::text as revision_id,
      revision.version,
      revision.status,
      revision.light_palette,
      revision.dark_palette,
      revision.fonts
    from public.appearance_theme as theme
    join public.appearance_theme_revision as revision
      on revision.id = theme.current_revision_id
    where theme.kind = 'builtin'
    order by theme.id
  `) as unknown as {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    current_revision_id: string;
    revision_id: string;
    version: number;
    status: string;
    light_palette: unknown;
    dark_palette: unknown;
    fonts: unknown;
  }[];

  assert.equal(rows.length, BUILTIN_THEMES.length, 'Expected all builtin appearance themes');
  const rowsById = new Map(rows.map(row => [row.id, row]));

  for (const theme of BUILTIN_THEMES) {
    const row = rowsById.get(theme.id);
    assert.ok(row, `Missing builtin appearance theme "${theme.slug}"`);
    const revisionId = `10000000-0000-4000-8000-${theme.id.slice(-12)}`;
    assert.equal(row.slug, theme.slug);
    assert.equal(row.name, theme.name);
    assert.equal(row.description, theme.description ?? null);
    assert.equal(row.current_revision_id, revisionId);
    assert.equal(row.revision_id, revisionId);
    assert.equal(row.version, theme.version);
    assert.equal(row.status, 'published');
    assert.deepEqual(row.light_palette, theme.light);
    assert.deepEqual(row.dark_palette, theme.dark);
    assert.deepEqual(row.fonts, theme.fonts);
  }
}

export default async function globalSetup() {
  await checkDatabase();
  if (process.env.E2E_ASSERT_BUILTIN_THEMES === '1') {
    await assertBuiltinAppearanceThemes();
  }
}
