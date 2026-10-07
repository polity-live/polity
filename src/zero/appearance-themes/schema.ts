import { z } from 'zod';
import {
  themeFontsSchema,
  themePaletteSchema,
  themeTextStyleSchema,
} from '@/features/shared/appearance-theme/contract';

const baseThemeInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(280).nullable().optional(),
  light_palette: themePaletteSchema,
  dark_palette: themePaletteSchema,
  fonts: themeFontsSchema,
  text_styles: z.array(themeTextStyleSchema).max(50).optional(),
});

export const createGroupAppearanceThemeSchema = baseThemeInputSchema.extend({
  id: z.string().uuid(),
  revision_id: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  group_id: z.string().uuid(),
});

export const createPersonalAppearanceThemeSchema = baseThemeInputSchema.extend({
  id: z.string().uuid(),
  revision_id: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const updateAppearanceThemeDraftSchema = baseThemeInputSchema.extend({
  id: z.string().uuid(),
  revision_id: z.string().uuid(),
  theme_id: z.string().uuid(),
  version: z.number().int().positive(),
});

export const publishAppearanceThemeSchema = z.object({
  theme_id: z.string().uuid(),
  revision_id: z.string().uuid(),
});

export const deleteAppearanceThemeSchema = z.object({
  id: z.string().uuid(),
});

export type CreateGroupAppearanceTheme = z.infer<typeof createGroupAppearanceThemeSchema>;
export type CreatePersonalAppearanceTheme = z.infer<typeof createPersonalAppearanceThemeSchema>;
