import { defineMutator } from '@rocicorp/zero';
import { createUserPreferenceSchema, updateUserPreferenceSchema } from './schema';
import { zql } from '../schema';
import { requireAuthenticated, requireOwner } from '../rbac/authorize';
import {
  changeWorkspaceFavorite,
  readWorkspacePreferences,
  setWorkspaceFavoriteSchema,
  setWorkspaceDisplaySchema,
  type WorkspacePreferences,
} from './workspace-schema';

async function writeWorkspacePreferences(
  tx: Parameters<typeof requireAuthenticated>[0],
  userId: string,
  id: string,
  transform: (value: WorkspacePreferences) => WorkspacePreferences
) {
  const existing = await tx.run(zql.user_preference.where('user_id', userId).one());
  const workspace_preferences = transform(
    readWorkspacePreferences(existing?.workspace_preferences)
  );
  if (existing) {
    await tx.mutate.user_preference.update({
      id: existing.id,
      workspace_preferences,
      updated_at: Date.now(),
    });
  } else {
    await tx.mutate.user_preference.insert({
      id,
      user_id: userId,
      create_form_style: 'carousel',
      theme: 'system',
      language: 'en',
      display_currency: 'EUR',
      navigation_view: 'asButtonList',
      group_network_layouts: {},
      appearance_theme_id: null,
      app_tutorial_completed_at: null,
      workspace_preferences,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  }
}

const ACTIVE_GROUP_MEMBERSHIP_STATUSES = ['active', 'member', 'admin'];

async function requireAvailableAppearanceTheme(
  tx: Parameters<typeof requireAuthenticated>[0],
  userId: string,
  themeId: string | null | undefined
) {
  if (!themeId || tx.location === 'client') return;
  const theme = await tx.run(zql.appearance_theme.where('id', themeId).one());
  if (!theme) throw new Error('Appearance theme not found');
  if (theme.kind === 'builtin') return;
  if (!theme.group_id || !theme.current_revision_id) {
    throw new Error('Appearance theme is not published');
  }
  const publishedRevision = await tx.run(
    zql.appearance_theme_revision
      .where('id', theme.current_revision_id)
      .where('theme_id', theme.id)
      .where('status', 'published')
      .one()
  );
  if (!publishedRevision) throw new Error('Appearance theme is not published');
  const membership = await tx.run(
    zql.group_membership
      .where('group_id', theme.group_id)
      .where('user_id', userId)
      .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES)
      .one()
  );
  if (!membership) throw new Error('Appearance theme is not available to this user');
}

function isDuplicateUserPreferenceError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('user_preference_user_id_key');
}

export const preferenceSharedMutators = {
  setWorkspaceFavorite: defineMutator(setWorkspaceFavoriteSchema, async ({ tx, ctx, args }) => {
    requireAuthenticated(tx, ctx, { action: 'update', resource: 'preferences' });
    await writeWorkspacePreferences(tx, ctx.userID, args.id, value =>
      changeWorkspaceFavorite(value, args.favorite, args.active)
    );
  }),
  setWorkspaceDisplay: defineMutator(setWorkspaceDisplaySchema, async ({ tx, ctx, args }) => {
    requireAuthenticated(tx, ctx, { action: 'update', resource: 'preferences' });
    await writeWorkspacePreferences(tx, ctx.userID, args.id, value => ({
      ...value,
      display: {
        ...value.display,
        ...args.display,
        ...(args.display.collectionViews
          ? {
              collectionViews: {
                ...value.display.collectionViews,
                ...args.display.collectionViews,
              },
            }
          : {}),
      },
    }));
  }),
  create: defineMutator(createUserPreferenceSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'preferences' });
    const now = Date.now();
    await requireAvailableAppearanceTheme(tx, userID, args.appearance_theme_id);
    const { id: createdPreferenceId, ...preferenceFields } = args;
    void createdPreferenceId;
    const existing = await tx.run(zql.user_preference.where('user_id', userID).one());

    if (existing) {
      await tx.mutate.user_preference.update({
        id: existing.id,
        ...preferenceFields,
        updated_at: now,
      });
      return;
    }

    try {
      await tx.mutate.user_preference.insert({
        ...args,
        app_tutorial_completed_at: null,
        user_id: userID,
        created_at: now,
        updated_at: now,
      });
    } catch (error: unknown) {
      // Handle parallel create calls racing on the unique user_id constraint.
      if (!isDuplicateUserPreferenceError(error)) throw error;

      const row = await tx.run(zql.user_preference.where('user_id', userID).one());

      if (!row) throw error;

      await tx.mutate.user_preference.update({
        id: row.id,
        ...preferenceFields,
        updated_at: now,
      });
    }
  }),

  update: defineMutator(updateUserPreferenceSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.user_preference.where('id', args.id).one());
      requireOwner(tx, ctx, row?.user_id, { action: 'update', resource: 'preferences' });
      await requireAvailableAppearanceTheme(tx, ctx.userID, args.appearance_theme_id);
    }

    const { id, ...fields } = args;
    await tx.mutate.user_preference.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),
};
