import { json, number, string, table } from '@rocicorp/zero';
import type { MutableJSONValue } from '../shared/helpers';

export const appearanceTheme = table('appearance_theme')
  .columns({
    id: string(),
    slug: string(),
    name: string(),
    description: string().optional(),
    kind: string(),
    group_id: string().optional(),
    created_by_id: string().optional(),
    current_revision_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const appearanceThemeRevision = table('appearance_theme_revision')
  .columns({
    id: string(),
    theme_id: string(),
    version: number(),
    status: string(),
    light_palette: json<MutableJSONValue>(),
    dark_palette: json<MutableJSONValue>(),
    fonts: json<MutableJSONValue>(),
    created_by_id: string().optional(),
    created_at: number(),
    updated_at: number(),
    published_at: number().optional(),
  })
  .primaryKey('id');
