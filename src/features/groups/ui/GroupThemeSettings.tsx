import { useMemo, useState } from 'react';
import { CheckCircle2, Copy, Palette, Send, Trash2 } from 'lucide-react';
import { useQuery, useZero } from '@rocicorp/zero/react';
import { queries } from '@/zero/queries';
import { mutators } from '@/zero/mutators';
import { onServerError } from '@/zero/mutate-with-server-check';
import {
  appearanceThemeDefinitionSchema,
  BUILTIN_THEMES,
  FONT_FAMILIES,
  fontIdSchema,
  validateThemeForPublishing,
  type AppearanceThemeDefinition,
  type FontId,
  type ThemeFonts,
  type ThemePalette,
} from '@/features/shared/appearance-theme';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const COLOR_FIELDS = [
  'background',
  'foreground',
  'card',
  'cardForeground',
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'muted',
  'mutedForeground',
  'accent',
  'accentForeground',
  'border',
  'input',
  'ring',
  'brand',
  'highlight',
  'success',
  'successForeground',
  'destructive',
  'destructiveForeground',
] as const satisfies readonly Exclude<keyof ThemePalette, 'charts'>[];

interface RevisionRow {
  id: string;
  version: number;
  status: string;
  light_palette: ThemePalette;
  dark_palette: ThemePalette;
  fonts: ThemeFonts;
}

interface ThemeRow {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  group_id: string;
  current_revision?: RevisionRow | null;
  revisions?: readonly RevisionRow[];
}

interface EditorState {
  themeId: string;
  name: string;
  description: string;
  light: ThemePalette;
  dark: ThemePalette;
  fonts: ThemeFonts;
  draftId: string;
  nextVersion: number;
}

function toEditorState(row: ThemeRow): EditorState | null {
  const revisions = row.revisions ?? [];
  const draft = revisions.find(revision => revision.status === 'draft');
  const source = draft ?? row.current_revision;
  if (!source) return null;
  return {
    themeId: row.id,
    name: row.name,
    description: row.description ?? '',
    light: source.light_palette,
    dark: source.dark_palette,
    fonts: source.fonts,
    draftId: draft?.id ?? crypto.randomUUID(),
    nextVersion: Math.max(0, ...revisions.map(revision => revision.version)) + 1,
  };
}

function ThemePreview({ state, mode }: { state: EditorState; mode: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const palette = state[mode];
  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{
        background: palette.background,
        color: palette.foreground,
        borderColor: palette.border,
        fontFamily: FONT_FAMILIES[state.fonts.sans],
      }}
    >
      <div
        className="flex items-center justify-between border-b p-3"
        style={{ borderColor: palette.border }}
      >
        <strong style={{ fontFamily: FONT_FAMILIES[state.fonts.display] }}>{state.name}</strong>
        <span className="text-xs uppercase opacity-60">
          {t(`features.groups.themes.preview${mode === 'light' ? 'Light' : 'Dark'}`)}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div
          className="rounded-md border p-3"
          style={{
            background: palette.card,
            color: palette.cardForeground,
            borderColor: palette.border,
          }}
        >
          <p className="font-semibold">{t('features.groups.themes.previewHeadline')}</p>
          <p className="mt-1 text-xs opacity-70">
            {t('features.groups.themes.previewDescription')}
          </p>
        </div>
        <div className="flex gap-2">
          <span
            className="rounded-md px-3 py-2 text-xs font-bold"
            style={{ background: palette.primary, color: palette.primaryForeground }}
          >
            {t('features.groups.themes.previewPrimary')}
          </span>
          <span
            className="rounded-md px-3 py-2 text-xs font-bold"
            style={{ background: palette.accent, color: palette.accentForeground }}
          >
            {t('features.groups.themes.previewAccent')}
          </span>
        </div>
      </div>
    </div>
  );
}

function PaletteEditor({
  title,
  palette,
  onChange,
}: {
  title: string;
  palette: ThemePalette;
  onChange: (palette: ThemePalette) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h4 className="font-semibold">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {COLOR_FIELDS.map(field => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={`${title}-${field}`} className="text-xs">
              {field}
            </Label>
            <div className="flex gap-2">
              <Input
                id={`${title}-${field}`}
                type="color"
                value={palette[field]}
                aria-label={t('features.groups.themes.colorLabel', { title, field })}
                onChange={event =>
                  onChange({ ...palette, [field]: event.target.value.toUpperCase() })
                }
                className="w-12 shrink-0 px-1"
              />
              <Input
                value={palette[field]}
                pattern="^#[0-9A-Fa-f]{6}$"
                onChange={event =>
                  onChange({ ...palette, [field]: event.target.value.toUpperCase() })
                }
                className="font-mono text-xs"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        {palette.charts.map((color, index) => (
          <div key={index} className="space-y-1.5">
            <Label htmlFor={`${title}-chart-${index}`} className="text-xs">
              {t('features.groups.themes.chartLabel', { number: index + 1 })}
            </Label>
            <Input
              id={`${title}-chart-${index}`}
              type="color"
              value={color}
              aria-label={t('features.groups.themes.chartColorLabel', {
                title,
                number: index + 1,
              })}
              onChange={event => {
                const charts = [...palette.charts] as ThemePalette['charts'];
                charts[index] = event.target.value.toUpperCase();
                onChange({ ...palette, charts });
              }}
              className="w-full px-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroupThemeSettings({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const zero = useZero();
  const [rows, result] = useQuery(queries.appearanceThemes.groupEditor({ groupId }));
  const themes = (Array.isArray(rows) ? rows : []) as unknown as ThemeRow[];
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saved, setSaved] = useState(false);

  const parsedTheme = useMemo(
    () =>
      editor
        ? appearanceThemeDefinitionSchema.safeParse({
            id: editor.themeId,
            slug: 'group-preview',
            name: editor.name,
            description: editor.description || undefined,
            kind: 'group',
            groupId,
            version: editor.nextVersion,
            light: editor.light,
            dark: editor.dark,
            fonts: editor.fonts,
          })
        : null,
    [editor, groupId]
  );
  const issues = useMemo(
    () => (parsedTheme?.success ? validateThemeForPublishing(parsedTheme.data) : []),
    [parsedTheme]
  );
  const hasInvalidValues = parsedTheme !== null && !parsedTheme.success;

  const createFromPreset = (preset: AppearanceThemeDefinition) => {
    const themeId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const state: EditorState = {
      themeId,
      name: `${preset.name} ${t('pages.group.themes.copySuffix')}`,
      description: '',
      light: structuredClone(preset.light),
      dark: structuredClone(preset.dark),
      fonts: { ...preset.fonts },
      draftId: revisionId,
      nextVersion: 1,
    };
    setEditor(state);
    const mutation = zero.mutate(
      mutators.appearanceThemes.createGroup({
        id: themeId,
        revision_id: revisionId,
        slug: `${preset.slug}-${themeId.slice(0, 8)}`,
        group_id: groupId,
        name: state.name,
        description: null,
        light_palette: state.light,
        dark_palette: state.dark,
        fonts: state.fonts,
      })
    );
    onServerError(mutation, message => console.error('Theme creation failed:', message));
  };

  const saveDraft = () => {
    if (!editor || !parsedTheme?.success) return null;
    const mutation = zero.mutate(
      mutators.appearanceThemes.updateDraft({
        id: editor.themeId,
        revision_id: editor.draftId,
        theme_id: editor.themeId,
        version: editor.nextVersion,
        name: editor.name,
        description: editor.description || null,
        light_palette: parsedTheme.data.light,
        dark_palette: parsedTheme.data.dark,
        fonts: parsedTheme.data.fonts,
      })
    );
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
    onServerError(mutation, message => console.error('Theme draft save failed:', message));
    return mutation;
  };

  const publish = () => {
    if (!editor || !parsedTheme?.success || issues.length > 0) return;
    const draftMutation = saveDraft();
    if (!draftMutation) return;
    const mutation = zero.mutate(
      mutators.appearanceThemes.publish({
        theme_id: editor.themeId,
        revision_id: editor.draftId,
      })
    );
    onServerError(mutation, message => console.error('Theme publication failed:', message));
    setEditor(null);
  };

  if (result.type === 'unknown') {
    return <p className="text-muted-foreground text-sm">{t('pages.group.themes.loading')}</p>;
  }

  if (editor) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{t('pages.group.themes.editorTitle')}</h3>
            <p className="text-muted-foreground text-sm">
              {t('pages.group.themes.editorDescription')}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setEditor(null)}>
            {t('pages.group.themes.back')}
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ThemePreview state={editor} mode="light" />
          <ThemePreview state={editor} mode="dark" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="theme-name">{t('pages.group.themes.name')}</Label>
            <Input
              id="theme-name"
              value={editor.name}
              maxLength={120}
              onChange={event => setEditor({ ...editor, name: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="theme-description">{t('pages.group.themes.description')}</Label>
            <Input
              id="theme-description"
              value={editor.description}
              maxLength={280}
              onChange={event => setEditor({ ...editor, description: event.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(['display', 'sans', 'mono'] as const).map(role => (
            <div key={role} className="space-y-1.5">
              <Label htmlFor={`theme-font-${role}`}>{t(`pages.group.themes.fonts.${role}`)}</Label>
              <select
                id={`theme-font-${role}`}
                value={editor.fonts[role]}
                onChange={event =>
                  setEditor({
                    ...editor,
                    fonts: {
                      ...editor.fonts,
                      [role]: event.target.value as FontId,
                    },
                  })
                }
                className="border-input bg-card h-[var(--field-height)] w-full rounded-md border px-3 text-sm"
              >
                {fontIdSchema.options.map(font => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <PaletteEditor
          title={t('pages.group.themes.light')}
          palette={editor.light}
          onChange={light => setEditor({ ...editor, light })}
        />
        <PaletteEditor
          title={t('pages.group.themes.dark')}
          palette={editor.dark}
          onChange={dark => setEditor({ ...editor, dark })}
        />

        {issues.length > 0 && (
          <div className="rounded-md border border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] p-3 text-sm text-[var(--badge-danger-fg)]">
            {t('pages.group.themes.contrastError', { count: issues.length })}
          </div>
        )}
        {hasInvalidValues && (
          <div className="rounded-md border border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] p-3 text-sm text-[var(--badge-danger-fg)]">
            {t('pages.group.themes.invalidValues')}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={saveDraft} disabled={hasInvalidValues}>
            {saved && <CheckCircle2 />}
            {saved ? t('pages.group.themes.saved') : t('pages.group.themes.saveDraft')}
          </Button>
          <Button
            type="button"
            onClick={publish}
            disabled={hasInvalidValues || issues.length > 0 || !editor.name.trim()}
          >
            <Send />
            {t('pages.group.themes.publish')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold">{t('pages.group.themes.title')}</h3>
        <p className="text-muted-foreground text-sm">{t('pages.group.themes.subtitle')}</p>
      </div>

      {themes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {themes.map(theme => {
            const state = toEditorState(theme);
            return (
              <div
                key={theme.id}
                className="bg-card flex items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{theme.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {theme.current_revision
                      ? t('pages.group.themes.published')
                      : t('pages.group.themes.draft')}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!state}
                    onClick={() => state && setEditor(state)}
                  >
                    <Palette />
                    {t('pages.group.themes.edit')}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title={t('pages.group.themes.delete')}
                    onClick={() => {
                      if (!window.confirm(t('pages.group.themes.deleteConfirm'))) return;
                      const mutation = zero.mutate(
                        mutators.appearanceThemes.delete({ id: theme.id })
                      );
                      onServerError(mutation, message =>
                        console.error('Theme deletion failed:', message)
                      );
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h4 className="mb-3 font-semibold">{t('pages.group.themes.createFrom')}</h4>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {BUILTIN_THEMES.map(theme => (
            <Button
              key={theme.id}
              type="button"
              variant="outline"
              onClick={() => createFromPreset(theme)}
              className={cn('h-auto justify-start p-3')}
            >
              <span className="flex gap-1">
                {[theme.light.primary, theme.light.accent, theme.dark.primary].map(color => (
                  <span
                    key={color}
                    className="size-5 rounded-full border"
                    style={{ background: color }}
                  />
                ))}
              </span>
              <Copy />
              {theme.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
