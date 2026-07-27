-- =============================================================================
-- Built-in appearance themes
-- =============================================================================

DO $production_seed$
BEGIN

INSERT INTO public.appearance_theme (
  id,
  slug,
  name,
  description,
  kind,
  group_id,
  created_by_id,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'polity',
    'Polity',
    'The default civic Polity design.',
    'builtin',
    NULL,
    NULL,
    TIMESTAMPTZ '2026-07-26 00:00:00+00',
    TIMESTAMPTZ '2026-07-26 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'spd',
    'SPD',
    'Inspired by the colors of the SPD.',
    'builtin',
    NULL,
    NULL,
    TIMESTAMPTZ '2026-07-26 00:00:00+00',
    TIMESTAMPTZ '2026-07-26 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'cdu',
    'CDU',
    'Inspired by the colors of the CDU.',
    'builtin',
    NULL,
    NULL,
    TIMESTAMPTZ '2026-07-26 00:00:00+00',
    TIMESTAMPTZ '2026-07-26 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'fdp',
    'FDP',
    'Inspired by the colors of the FDP.',
    'builtin',
    NULL,
    NULL,
    TIMESTAMPTZ '2026-07-26 00:00:00+00',
    TIMESTAMPTZ '2026-07-26 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'gruene',
    'Die Grünen',
    'Inspired by the colors of Bündnis 90/Die Grünen.',
    'builtin',
    NULL,
    NULL,
    TIMESTAMPTZ '2026-07-26 00:00:00+00',
    TIMESTAMPTZ '2026-07-26 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000006',
    'linke',
    'Die Linke',
    'Inspired by the colors of Die Linke.',
    'builtin',
    NULL,
    NULL,
    TIMESTAMPTZ '2026-07-26 00:00:00+00',
    TIMESTAMPTZ '2026-07-26 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000007',
    'volt',
    'Volt',
    'Inspired by the colors of Volt.',
    'builtin',
    NULL,
    NULL,
    TIMESTAMPTZ '2026-07-26 00:00:00+00',
    TIMESTAMPTZ '2026-07-26 00:00:00+00'
  )
ON CONFLICT (id) DO UPDATE
SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  kind = EXCLUDED.kind,
  group_id = EXCLUDED.group_id,
  created_by_id = EXCLUDED.created_by_id,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

WITH palette_base AS (
  SELECT
    '{
      "background": "#F7F5EF",
      "foreground": "#17201C",
      "card": "#FFFCF6",
      "cardForeground": "#17201C",
      "primary": "#12362D",
      "primaryForeground": "#FFFCF6",
      "secondary": "#EEEAE1",
      "secondaryForeground": "#17201C",
      "muted": "#EEEAE1",
      "mutedForeground": "#545E58",
      "accent": "#F5ECD8",
      "accentForeground": "#6C4A16",
      "border": "#D9D2C3",
      "input": "#D8D0C0",
      "ring": "#8A6425",
      "brand": "#12362D",
      "highlight": "#8A6425",
      "success": "#315C37",
      "successForeground": "#FFFFFF",
      "destructive": "#9A3D34",
      "destructiveForeground": "#FFFFFF",
      "charts": ["#2F6F8F", "#4F7D5A", "#9F7500", "#7B4E83", "#B86446"]
    }'::jsonb AS light_palette,
    '{
      "background": "#07110E",
      "foreground": "#F4EFE4",
      "card": "#101A16",
      "cardForeground": "#F4EFE4",
      "primary": "#F4EFE4",
      "primaryForeground": "#07110E",
      "secondary": "#18231F",
      "secondaryForeground": "#F4EFE4",
      "muted": "#18231F",
      "mutedForeground": "#B8C1BA",
      "accent": "#251F13",
      "accentForeground": "#F2D39B",
      "border": "#2B3731",
      "input": "#2B3731",
      "ring": "#C99B4D",
      "brand": "#F4EFE4",
      "highlight": "#C99B4D",
      "success": "#A8C99E",
      "successForeground": "#07110E",
      "destructive": "#D59088",
      "destructiveForeground": "#190B09",
      "charts": ["#72B6D1", "#8DB893", "#E3B94F", "#BB8EC2", "#DB9175"]
    }'::jsonb AS dark_palette
),
seeded_revision (
  id,
  theme_id,
  light_overrides,
  dark_overrides,
  fonts
) AS (
  VALUES
    (
      '10000000-0000-4000-8000-000000000001'::uuid,
      '00000000-0000-4000-8000-000000000001'::uuid,
      '{}'::jsonb,
      '{}'::jsonb,
      '{"display":"newsreader","sans":"manrope","mono":"jetbrains-mono"}'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000002'::uuid,
      '00000000-0000-4000-8000-000000000002'::uuid,
      '{
        "background": "#FFF5F5",
        "foreground": "#2B1115",
        "card": "#FFFFFF",
        "cardForeground": "#2B1115",
        "primary": "#B8183B",
        "primaryForeground": "#FFFFFF",
        "secondary": "#F7E3E6",
        "secondaryForeground": "#2B1115",
        "muted": "#F7E3E6",
        "mutedForeground": "#6B4C52",
        "brand": "#B8183B",
        "ring": "#B8183B",
        "accent": "#DCEFF1",
        "accentForeground": "#005D69",
        "border": "#E6BEC5",
        "input": "#E6BEC5",
        "highlight": "#005D69",
        "charts": ["#E3000F", "#B8183B", "#005D69", "#0B90E5", "#046285"]
      }'::jsonb,
      '{
        "background": "#17090C",
        "foreground": "#FFF2F3",
        "card": "#241014",
        "cardForeground": "#FFF2F3",
        "primary": "#E3000F",
        "primaryForeground": "#FFFFFF",
        "secondary": "#32171D",
        "secondaryForeground": "#FFF2F3",
        "muted": "#32171D",
        "mutedForeground": "#D8AEB5",
        "brand": "#E3000F",
        "ring": "#FF7A83",
        "accent": "#10292C",
        "accentForeground": "#84D0D8",
        "border": "#53303A",
        "input": "#53303A",
        "highlight": "#FF7A83",
        "charts": ["#E3000F", "#B8183B", "#005D69", "#0B90E5", "#046285"]
      }'::jsonb,
      '{"display":"open-sans","sans":"open-sans","mono":"jetbrains-mono"}'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000003'::uuid,
      '00000000-0000-4000-8000-000000000003'::uuid,
      '{
        "background": "#F3F8F9",
        "foreground": "#182734",
        "card": "#FFFFFF",
        "cardForeground": "#182734",
        "primary": "#2D3C4B",
        "primaryForeground": "#FFFFFF",
        "secondary": "#E1EEF0",
        "secondaryForeground": "#182734",
        "muted": "#E1EEF0",
        "mutedForeground": "#53656E",
        "brand": "#2D3C4B",
        "ring": "#2D3C4B",
        "accent": "#DDF2F4",
        "accentForeground": "#2D3C4B",
        "border": "#BFD8DC",
        "input": "#BFD8DC",
        "highlight": "#2D3C4B",
        "charts": ["#52B7C1", "#2D3C4B", "#FFA600", "#BF111B", "#737986"]
      }'::jsonb,
      '{
        "background": "#091318",
        "foreground": "#EDF8FA",
        "card": "#101F26",
        "cardForeground": "#EDF8FA",
        "primary": "#A7D5DC",
        "primaryForeground": "#17202A",
        "secondary": "#183039",
        "secondaryForeground": "#EDF8FA",
        "muted": "#183039",
        "mutedForeground": "#A8C4C9",
        "brand": "#A7D5DC",
        "ring": "#FFA600",
        "accent": "#302612",
        "accentForeground": "#FFC04D",
        "border": "#29464E",
        "input": "#29464E",
        "highlight": "#FFA600",
        "charts": ["#52B7C1", "#2D3C4B", "#FFA600", "#BF111B", "#737986"]
      }'::jsonb,
      '{"display":"inter","sans":"ibm-plex-serif","mono":"jetbrains-mono"}'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000004'::uuid,
      '00000000-0000-4000-8000-000000000004'::uuid,
      '{
        "background": "#F4F7FC",
        "foreground": "#0B203C",
        "card": "#FFFFFF",
        "cardForeground": "#0B203C",
        "primary": "#032D67",
        "primaryForeground": "#FFFFFF",
        "secondary": "#E3EAF5",
        "secondaryForeground": "#0B203C",
        "muted": "#E3EAF5",
        "mutedForeground": "#50617A",
        "brand": "#032D67",
        "ring": "#032D67",
        "accent": "#FFF3A3",
        "accentForeground": "#032D67",
        "border": "#C2CEE0",
        "input": "#C2CEE0",
        "highlight": "#032D67",
        "charts": ["#032D67", "#FFE000", "#00A7E7", "#315E91", "#D4B900"]
      }'::jsonb,
      '{
        "background": "#071224",
        "foreground": "#F4F8FF",
        "card": "#0D1C33",
        "cardForeground": "#F4F8FF",
        "primary": "#FFE000",
        "primaryForeground": "#032D67",
        "secondary": "#152945",
        "secondaryForeground": "#F4F8FF",
        "muted": "#152945",
        "mutedForeground": "#ACC0D0",
        "brand": "#FFE000",
        "ring": "#00A7E7",
        "accent": "#29260B",
        "accentForeground": "#FFE000",
        "border": "#294665",
        "input": "#294665",
        "highlight": "#00A7E7",
        "charts": ["#032D67", "#FFE000", "#00A7E7", "#315E91", "#D4B900"]
      }'::jsonb,
      '{"display":"public-sans","sans":"public-sans","mono":"jetbrains-mono"}'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000005'::uuid,
      '00000000-0000-4000-8000-000000000005'::uuid,
      '{
        "background": "#F4F8F2",
        "foreground": "#112319",
        "card": "#FCFFF9",
        "cardForeground": "#112319",
        "primary": "#005437",
        "primaryForeground": "#FFFFFF",
        "secondary": "#E3EDDE",
        "secondaryForeground": "#112319",
        "muted": "#E3EDDE",
        "mutedForeground": "#536258",
        "brand": "#005437",
        "ring": "#005437",
        "accent": "#F5EFB7",
        "accentForeground": "#0A321E",
        "border": "#C5D5BC",
        "input": "#C5D5BC",
        "highlight": "#0A321E",
        "charts": ["#005437", "#D9B500", "#4B8F3A", "#8BBE5A", "#0A321E"]
      }'::jsonb,
      '{
        "background": "#07140D",
        "foreground": "#F1F8EE",
        "card": "#0D2015",
        "cardForeground": "#F1F8EE",
        "primary": "#B7D889",
        "primaryForeground": "#0A321E",
        "secondary": "#183021",
        "secondaryForeground": "#F1F8EE",
        "muted": "#183021",
        "mutedForeground": "#AFC2B3",
        "brand": "#B7D889",
        "ring": "#D9B500",
        "accent": "#302B0C",
        "accentForeground": "#E8CC34",
        "border": "#2C4936",
        "input": "#2C4936",
        "highlight": "#D9B500",
        "charts": ["#005437", "#D9B500", "#4B8F3A", "#8BBE5A", "#0A321E"]
      }'::jsonb,
      '{"display":"pt-sans","sans":"pt-sans","mono":"jetbrains-mono"}'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000006'::uuid,
      '00000000-0000-4000-8000-000000000006'::uuid,
      '{
        "background": "#FFF5F8",
        "foreground": "#2B101C",
        "card": "#FFFFFF",
        "cardForeground": "#2B101C",
        "primary": "#A80000",
        "primaryForeground": "#FFFFFF",
        "secondary": "#F2E1E8",
        "secondaryForeground": "#2B101C",
        "muted": "#F2E1E8",
        "mutedForeground": "#6E4B59",
        "brand": "#A80000",
        "ring": "#A80000",
        "accent": "#F2DDE8",
        "accentForeground": "#6F003C",
        "border": "#DFBCCB",
        "input": "#DFBCCB",
        "highlight": "#6F003C",
        "charts": ["#FF0000", "#6F003C", "#00B19C", "#8100A1", "#2E4FC4"]
      }'::jsonb,
      '{
        "background": "#190810",
        "foreground": "#FFF2F7",
        "card": "#27101A",
        "cardForeground": "#FFF2F7",
        "primary": "#FF5C5C",
        "primaryForeground": "#220000",
        "secondary": "#361824",
        "secondaryForeground": "#FFF2F7",
        "muted": "#361824",
        "mutedForeground": "#D5ADBE",
        "brand": "#FF5C5C",
        "ring": "#00B19C",
        "accent": "#0C2B28",
        "accentForeground": "#54DAC8",
        "border": "#533041",
        "input": "#533041",
        "highlight": "#00B19C",
        "charts": ["#FF0000", "#6F003C", "#00B19C", "#8100A1", "#2E4FC4"]
      }'::jsonb,
      '{"display":"work-sans","sans":"inter","mono":"jetbrains-mono"}'::jsonb
    ),
    (
      '10000000-0000-4000-8000-000000000007'::uuid,
      '00000000-0000-4000-8000-000000000007'::uuid,
      '{
        "background": "#F8F5FC",
        "foreground": "#241532",
        "card": "#FFFFFF",
        "cardForeground": "#241532",
        "primary": "#502379",
        "primaryForeground": "#FFFFFF",
        "secondary": "#EDE4F5",
        "secondaryForeground": "#241532",
        "muted": "#EDE4F5",
        "mutedForeground": "#665474",
        "brand": "#502379",
        "ring": "#502379",
        "accent": "#FEE8A6",
        "accentForeground": "#502379",
        "border": "#D5C3E2",
        "input": "#D5C3E2",
        "highlight": "#502379",
        "charts": ["#502379", "#FDC220", "#82D0F4", "#1BBE6F", "#E63E12"]
      }'::jsonb,
      '{
        "background": "#130A1C",
        "foreground": "#FAF2FF",
        "card": "#20102D",
        "cardForeground": "#FAF2FF",
        "primary": "#C69BEA",
        "primaryForeground": "#261038",
        "secondary": "#311B41",
        "secondaryForeground": "#FAF2FF",
        "muted": "#311B41",
        "mutedForeground": "#C8B2D7",
        "brand": "#C69BEA",
        "ring": "#FDC220",
        "accent": "#31270B",
        "accentForeground": "#FDC220",
        "border": "#4B315C",
        "input": "#4B315C",
        "highlight": "#FDC220",
        "charts": ["#502379", "#FDC220", "#82D0F4", "#1BBE6F", "#E63E12"]
      }'::jsonb,
      '{"display":"ubuntu","sans":"ubuntu","mono":"jetbrains-mono"}'::jsonb
    )
)
INSERT INTO public.appearance_theme_revision (
  id,
  theme_id,
  version,
  status,
  light_palette,
  dark_palette,
  fonts,
  created_by_id,
  created_at,
  updated_at,
  published_at
)
SELECT
  seeded_revision.id,
  seeded_revision.theme_id,
  1,
  'published',
  palette_base.light_palette || seeded_revision.light_overrides,
  palette_base.dark_palette || seeded_revision.dark_overrides,
  seeded_revision.fonts,
  NULL,
  TIMESTAMPTZ '2026-07-26 00:00:00+00',
  TIMESTAMPTZ '2026-07-26 00:00:00+00',
  TIMESTAMPTZ '2026-07-26 00:00:00+00'
FROM seeded_revision
CROSS JOIN palette_base
ON CONFLICT (id) DO UPDATE
SET
  theme_id = EXCLUDED.theme_id,
  version = EXCLUDED.version,
  status = EXCLUDED.status,
  light_palette = EXCLUDED.light_palette,
  dark_palette = EXCLUDED.dark_palette,
  fonts = EXCLUDED.fonts,
  created_by_id = EXCLUDED.created_by_id,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at,
  published_at = EXCLUDED.published_at;

UPDATE public.appearance_theme AS theme
SET
  current_revision_id = seeded.revision_id,
  updated_at = TIMESTAMPTZ '2026-07-26 00:00:00+00'
FROM (
  VALUES
    (
      '00000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      '00000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-4000-8000-000000000002'::uuid
    ),
    (
      '00000000-0000-4000-8000-000000000003'::uuid,
      '10000000-0000-4000-8000-000000000003'::uuid
    ),
    (
      '00000000-0000-4000-8000-000000000004'::uuid,
      '10000000-0000-4000-8000-000000000004'::uuid
    ),
    (
      '00000000-0000-4000-8000-000000000005'::uuid,
      '10000000-0000-4000-8000-000000000005'::uuid
    ),
    (
      '00000000-0000-4000-8000-000000000006'::uuid,
      '10000000-0000-4000-8000-000000000006'::uuid
    ),
    (
      '00000000-0000-4000-8000-000000000007'::uuid,
      '10000000-0000-4000-8000-000000000007'::uuid
    )
) AS seeded(theme_id, revision_id)
WHERE theme.id = seeded.theme_id;

-- =============================================================================
-- Seed the Aria & Kai system assistant user
-- This is a well-known bot user used for onboarding and in-app tutorials.
-- =============================================================================

INSERT INTO public."user" (
  id,
  email,
  handle,
  first_name,
  last_name,
  bio,
  avatar,
  visibility,
  subscriber_count,
  amendment_count,
  group_count,
  created_at,
  updated_at
) VALUES (
  'a12a0000-0000-4000-a000-000000000001',
  'aria-kai-assistants@polity.com',
  'aria-kai',
  'Assistent Aria',
  '& Kai',
  'Assistent Aria & Kai helps you navigate Polity.',
  '/avatars/aria-kai-avatar-256.webp',
  'public',
  0,
  0,
  0,
  now(),
  now()
) ON CONFLICT (id) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    bio = EXCLUDED.bio,
    avatar = EXCLUDED.avatar;

INSERT INTO public.notification_setting (user_id)
VALUES ('a12a0000-0000-4000-a000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_preference (user_id)
VALUES ('a12a0000-0000-4000-a000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

END
$production_seed$;
