import { z } from 'zod';

export const workspaceFavoriteSchema = z
  .object({
    kind: z.enum(['group', 'amendment', 'event', 'view']),
    href: z
      .string()
      .max(2048)
      .refine(
        href =>
          /^\/(?:group|amendment|event)\/[^/?#]+$/.test(href) ||
          /^\/(?:search|todos|home|calendar|notifications)(?:\?[^#]*)?$/.test(href),
        'Unsupported favorite destination'
      ),
    title: z.string().trim().min(1).max(240),
  })
  .refine(
    favorite =>
      favorite.kind === 'view'
        ? /^\/(?:search|todos|home|calendar|notifications)(?:\?|$)/.test(favorite.href)
        : favorite.href.startsWith(`/${favorite.kind}/`),
    'Favorite type must match its destination'
  );

export const collectionAreaSchema = z.enum([
  'profile.all',
  'profile.amendments',
  'profile.groups',
  'profile.blogs',
  'profile.statements',
  'group.amendments',
  'group.related',
  'group.content',
  'group.documents',
  'group.events',
  'directory.group',
  'directory.event',
  'directory.amendment',
  'directory.blog',
  'agenda',
  'agenda.speakers',
  'changeRequests',
  'calendar',
  'network.events',
]);
export type CollectionArea = z.infer<typeof collectionAreaSchema>;
export type CollectionView = 'cards' | 'compact';

export const workspaceDisplaySchema = z.object({
  collectionViews: z.partialRecord(collectionAreaSchema, z.enum(['cards', 'compact'])).optional(),
  timelineMapVisible: z.boolean().optional(),
  searchView: z.enum(['list', 'compact', 'spatial']).optional(),
  todoView: z.enum(['list', 'kanban']).optional(),
});

export const workspacePreferencesSchema = z.object({
  favorites: z.array(workspaceFavoriteSchema).max(200).default([]),
  display: workspaceDisplaySchema.default({}),
});

export const setWorkspaceFavoriteSchema = z.object({
  id: z.string().uuid(),
  favorite: workspaceFavoriteSchema,
  active: z.boolean(),
});

export const setWorkspaceDisplaySchema = z.object({
  id: z.string().uuid(),
  display: workspaceDisplaySchema,
});

export type WorkspaceFavorite = z.infer<typeof workspaceFavoriteSchema>;
export type WorkspaceDisplay = z.infer<typeof workspaceDisplaySchema>;
export type WorkspacePreferences = z.infer<typeof workspacePreferencesSchema>;

export function readWorkspacePreferences(value: unknown): WorkspacePreferences {
  const result = workspacePreferencesSchema.safeParse(value);
  return result.success ? result.data : { favorites: [], display: {} };
}

export function changeWorkspaceFavorite(
  preferences: WorkspacePreferences,
  favorite: WorkspaceFavorite,
  active: boolean
): WorkspacePreferences {
  const remaining = preferences.favorites.filter(item => item.href !== favorite.href);
  if (active && remaining.length >= 200) throw new Error('Favorite limit reached');
  return { ...preferences, favorites: active ? [...remaining, favorite] : remaining };
}
