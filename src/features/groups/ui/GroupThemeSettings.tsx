import { useMemo, useState } from 'react';
import { CheckCircle2, Copy, Palette, Plus, Send, Trash2 } from 'lucide-react';
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
  type ThemePaletteRole,
  type ThemeTextStyle,
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
  text_styles?: ThemeTextStyle[];
}

interface ThemeRow {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  group_id?: string | null;
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
  textStyles: ThemeTextStyle[];
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
    textStyles: structuredClone(source.text_styles ?? []),
    draftId: draft?.id ?? crypto.randomUUID(),
    nextVersion: Math.max(0, ...revisions.map(revision => revision.version)) + 1,
  };
}

function isSuccessfulThemeParse(
  parsedTheme: ReturnType<typeof appearanceThemeDefinitionSchema.safeParse> | null
) {
  return Boolean(parsedTheme?.success);
}

function canPublishParsedTheme(
  parsedTheme: ReturnType<typeof appearanceThemeDefinitionSchema.safeParse> | null,
  issues: readonly unknown[]
) {
  return isSuccessfulThemeParse(parsedTheme) && issues.length === 0;
}

export const groupThemeSettingsInternals = {
  toEditorState,
  isSuccessfulThemeParse,
  canPublishParsedTheme,
};

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

export function GroupThemeSettings({ groupId = null }: { groupId?: string | null }) {
  const { t } = useTranslation();
  const zero = useZero();
  const [groupRows, groupResult] = useQuery(
    groupId ? queries.appearanceThemes.groupEditor({ groupId }) : undefined
  );
  const [personalRows, personalResult] = useQuery(
    groupId ? undefined : queries.appearanceThemes.personalEditor({})
  );
  const rows = groupId ? groupRows : personalRows;
  const result = groupId ? groupResult : personalResult;
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
            kind: groupId ? 'group' : 'personal',
            groupId,
            version: editor.nextVersion,
            light: editor.light,
            dark: editor.dark,
            fonts: editor.fonts,
            textStyles: editor.textStyles,
            ownerId: null,
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
      textStyles: structuredClone(preset.textStyles),
      draftId: revisionId,
      nextVersion: 1,
    };
    setEditor(state);
    const common = {
      id: themeId,
      revision_id: revisionId,
      slug: `${preset.slug}-${themeId.slice(0, 8)}`,
      name: state.name,
      description: null,
      light_palette: state.light,
      dark_palette: state.dark,
      fonts: state.fonts,
      text_styles: state.textStyles,
    };
    const mutation = groupId
      ? zero.mutate(mutators.appearanceThemes.createGroup({ ...common, group_id: groupId }))
      : zero.mutate(mutators.appearanceThemes.createPersonal(common));
    onServerError(mutation, message => console.error('Theme creation failed:', message));
  };

  const saveDraft = () => {
    if (!editor || !isSuccessfulThemeParse(parsedTheme)) return null;
    const currentEditor = editor;
    const parsed = parsedTheme as Extract<NonNullable<typeof parsedTheme>, { success: true }>;
    const mutation = zero.mutate(
      mutators.appearanceThemes.updateDraft({
        id: currentEditor.themeId,
        revision_id: currentEditor.draftId,
        theme_id: currentEditor.themeId,
        version: currentEditor.nextVersion,
        name: currentEditor.name,
        description: currentEditor.description || null,
        light_palette: parsed.data.light,
        dark_palette: parsed.data.dark,
        fonts: parsed.data.fonts,
        text_styles: parsed.data.textStyles,
      })
    );
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
    onServerError(mutation, message => console.error('Theme draft save failed:', message));
    return mutation;
  };

  const publish = () => {
    if (!editor || !canPublishParsedTheme(parsedTheme, issues)) return;
    const currentEditor = editor;
    const draftMutation = saveDraft();
    if (!draftMutation) return;
    const mutation = zero.mutate(
      mutators.appearanceThemes.publish({
        theme_id: currentEditor.themeId,
        revision_id: currentEditor.draftId,
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
          <Button
            data-action-id="groups.themes.editor.back"
            type="button"
            variant="outline"
            onClick={() => setEditor(null)}
          >
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
                data-action-id="groups.themes.font.select"
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

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-semibold">{t('pages.group.themes.textStyles.title')}</h4>
              <p className="text-muted-foreground text-sm">
                {t('pages.group.themes.textStyles.description')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={editor.textStyles.length >= 50}
              onClick={() =>
                setEditor({
                  ...editor,
                  textStyles: [
                    ...editor.textStyles,
                    {
                      id: crypto.randomUUID(),
                      name: t('pages.group.themes.textStyles.defaultName', {
                        number: editor.textStyles.length + 1,
                      }),
                      font: editor.fonts.sans,
                      size: 28,
                      color: 'foreground',
                      bold: false,
                      italic: false,
                      underline: false,
                      lineHeight: 1.2,
                      letterSpacing: 0,
                      align: 'left',
                    },
                  ],
                })
              }
            >
              <Plus />
              {t('pages.group.themes.textStyles.add')}
            </Button>
          </div>
          {editor.textStyles.map((style, index) => {
            const update = (patch: Partial<ThemeTextStyle>) => {
              const textStyles = [...editor.textStyles];
              textStyles[index] = { ...style, ...patch };
              setEditor({ ...editor, textStyles });
            };
            return (
              <div key={style.id} className="bg-card space-y-3 rounded-lg border p-3">
                <div className="flex gap-2">
                  <Input
                    aria-label={t('pages.group.themes.textStyles.name')}
                    value={style.name}
                    maxLength={80}
                    onChange={event => update({ name: event.currentTarget.value })}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('pages.group.themes.textStyles.delete')}
                    onClick={() =>
                      setEditor({
                        ...editor,
                        textStyles: editor.textStyles.filter(item => item.id !== style.id),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="space-y-1 text-xs">
                    <span>{t('pages.group.themes.textStyles.font')}</span>
                    <select
                      className="border-input bg-card h-9 w-full rounded-md border px-2"
                      value={style.font}
                      onChange={event => update({ font: event.currentTarget.value as FontId })}
                    >
                      {fontIdSchema.options.map(font => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs">
                    <span>{t('pages.group.themes.textStyles.color')}</span>
                    <select
                      className="border-input bg-card h-9 w-full rounded-md border px-2"
                      value={style.color}
                      onChange={event =>
                        update({ color: event.currentTarget.value as ThemePaletteRole })
                      }
                    >
                      {[...COLOR_FIELDS, 'chart1', 'chart2', 'chart3', 'chart4', 'chart5'].map(
                        role => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs">
                    <span>{t('pages.group.themes.textStyles.size')}</span>
                    <Input
                      type="number"
                      min={8}
                      max={300}
                      value={style.size}
                      onChange={event => update({ size: event.currentTarget.valueAsNumber })}
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span>{t('pages.group.themes.textStyles.lineHeight')}</span>
                    <Input
                      type="number"
                      min={0.5}
                      max={4}
                      step={0.05}
                      value={style.lineHeight}
                      onChange={event => update({ lineHeight: event.currentTarget.valueAsNumber })}
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span>{t('pages.group.themes.textStyles.letterSpacing')}</span>
                    <Input
                      type="number"
                      min={-20}
                      max={100}
                      step={0.1}
                      value={style.letterSpacing}
                      onChange={event =>
                        update({ letterSpacing: event.currentTarget.valueAsNumber })
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span>{t('pages.group.themes.textStyles.alignment')}</span>
                    <select
                      className="border-input bg-card h-9 w-full rounded-md border px-2"
                      value={style.align}
                      onChange={event =>
                        update({ align: event.currentTarget.value as ThemeTextStyle['align'] })
                      }
                    >
                      {['left', 'center', 'right', 'justify'].map(align => (
                        <option key={align} value={align}>
                          {align}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {(['bold', 'italic', 'underline'] as const).map(mark => (
                    <label key={mark} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={style[mark]}
                        onChange={event => update({ [mark]: event.currentTarget.checked })}
                      />
                      {t(`pages.group.themes.textStyles.marks.${mark}`)}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

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
          <Button
            data-action-id="groups.themes.draft.save"
            type="button"
            variant="outline"
            onClick={saveDraft}
            disabled={hasInvalidValues}
          >
            {saved && <CheckCircle2 />}
            {saved ? t('pages.group.themes.saved') : t('pages.group.themes.saveDraft')}
          </Button>
          <Button
            data-action-id="groups.themes.draft.publish"
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
                    data-action-id="groups.themes.existing.edit"
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
                    data-action-id="groups.themes.existing.delete"
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
              data-action-id="groups.themes.preset.create"
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
