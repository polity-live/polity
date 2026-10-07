import { defineMutator } from '@rocicorp/zero';
import {
  createGroupAppearanceThemeSchema,
  createPersonalAppearanceThemeSchema,
  deleteAppearanceThemeSchema,
  publishAppearanceThemeSchema,
  updateAppearanceThemeDraftSchema,
} from './schema';
import { zql } from '../schema';
import { can } from '../rbac/can';
import {
  themeFontsSchema,
  themePaletteSchema,
  themeTextStyleSchema,
  validateThemeForPublishing,
} from '@/features/shared/appearance-theme/contract';

async function requireManageTheme(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  themeId: string
) {
  const theme = await tx.run(zql.appearance_theme.where('id', themeId).one());
  if (!theme || theme.kind !== 'group' || !theme.group_id) {
    throw new Error('Group theme not found');
  }
  await can(tx, ctx, {
    action: 'manage',
    resource: 'groupThemes',
    groupId: theme.group_id,
  });
  return theme;
}

async function requireEditTheme(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  themeId: string
) {
  const theme = await tx.run(zql.appearance_theme.where('id', themeId).one());
  if (!theme) throw new Error('Theme not found');
  if (theme.kind === 'personal') {
    if (theme.created_by_id !== ctx.userID) throw new Error('Theme not found');
    return theme;
  }
  return requireManageTheme(tx, ctx, themeId);
}

export const appearanceThemeSharedMutators = {
  createPersonal: defineMutator(createPersonalAppearanceThemeSchema, async ({ tx, ctx, args }) => {
    const now = Date.now();
    await tx.mutate.appearance_theme.insert({
      id: args.id,
      slug: args.slug,
      name: args.name,
      description: args.description ?? null,
      kind: 'personal',
      group_id: null,
      created_by_id: ctx.userID,
      current_revision_id: null,
      created_at: now,
      updated_at: now,
    });
    await tx.mutate.appearance_theme_revision.insert({
      id: args.revision_id,
      theme_id: args.id,
      version: 1,
      status: 'draft',
      light_palette: args.light_palette,
      dark_palette: args.dark_palette,
      fonts: args.fonts,
      text_styles: args.text_styles ?? [],
      created_by_id: ctx.userID,
      created_at: now,
      updated_at: now,
      published_at: null,
    });
  }),
  createGroup: defineMutator(createGroupAppearanceThemeSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, {
      action: 'manage',
      resource: 'groupThemes',
      groupId: args.group_id,
    });
    const now = Date.now();
    await tx.mutate.appearance_theme.insert({
      id: args.id,
      slug: args.slug,
      name: args.name,
      description: args.description ?? null,
      kind: 'group',
      group_id: args.group_id,
      created_by_id: ctx.userID,
      current_revision_id: null,
      created_at: now,
      updated_at: now,
    });
    await tx.mutate.appearance_theme_revision.insert({
      id: args.revision_id,
      theme_id: args.id,
      version: 1,
      status: 'draft',
      light_palette: args.light_palette,
      dark_palette: args.dark_palette,
      fonts: args.fonts,
      text_styles: args.text_styles ?? [],
      created_by_id: ctx.userID,
      created_at: now,
      updated_at: now,
      published_at: null,
    });
  }),

  updateDraft: defineMutator(updateAppearanceThemeDraftSchema, async ({ tx, ctx, args }) => {
    const theme = await requireEditTheme(tx, ctx, args.theme_id);
    const now = Date.now();
    await tx.mutate.appearance_theme.update({
      id: theme.id,
      name: args.name,
      description: args.description ?? null,
      updated_at: now,
    });

    const existing = await tx.run(
      zql.appearance_theme_revision.where('theme_id', args.theme_id).where('status', 'draft').one()
    );
    if (existing) {
      await tx.mutate.appearance_theme_revision.update({
        id: existing.id,
        light_palette: args.light_palette,
        dark_palette: args.dark_palette,
        fonts: args.fonts,
        text_styles: args.text_styles ?? [],
        updated_at: now,
      });
    } else {
      await tx.mutate.appearance_theme_revision.insert({
        id: args.revision_id,
        theme_id: args.theme_id,
        version: args.version,
        status: 'draft',
        light_palette: args.light_palette,
        dark_palette: args.dark_palette,
        fonts: args.fonts,
        text_styles: args.text_styles ?? [],
        created_by_id: ctx.userID,
        created_at: now,
        updated_at: now,
        published_at: null,
      });
    }
  }),

  publish: defineMutator(publishAppearanceThemeSchema, async ({ tx, ctx, args }) => {
    const theme = await requireEditTheme(tx, ctx, args.theme_id);
    const revision = await tx.run(
      zql.appearance_theme_revision
        .where('id', args.revision_id)
        .where('theme_id', args.theme_id)
        .where('status', 'draft')
        .one()
    );
    if (!revision) throw new Error('Theme draft not found');

    const light = themePaletteSchema.parse(revision.light_palette);
    const dark = themePaletteSchema.parse(revision.dark_palette);
    themeFontsSchema.parse(revision.fonts);
    themeTextStyleSchema
      .array()
      .max(50)
      .parse(revision.text_styles ?? []);
    const issues = validateThemeForPublishing({ light, dark });
    if (issues.length > 0) {
      throw new Error('Theme cannot be published because one or more color pairs fail WCAG AA');
    }

    const now = Date.now();
    await tx.mutate.appearance_theme_revision.update({
      id: revision.id,
      status: 'published',
      published_at: now,
      updated_at: now,
    });
    await tx.mutate.appearance_theme.update({
      id: theme.id,
      current_revision_id: revision.id,
      updated_at: now,
    });
  }),

  delete: defineMutator(deleteAppearanceThemeSchema, async ({ tx, ctx, args }) => {
    await requireEditTheme(tx, ctx, args.id);
    await tx.mutate.appearance_theme.delete({ id: args.id });
  }),
};
