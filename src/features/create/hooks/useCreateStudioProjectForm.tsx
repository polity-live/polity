import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useZero } from '@rocicorp/zero/react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useStudioApi } from '@/zero/communication-studio/useStudioApi';
import { useStudioState } from '@/zero/communication-studio/useStudioState';
import { mutators } from '@/zero/mutators';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { BUILTIN_THEMES } from '@/features/shared/appearance-theme';
import {
  createThemeSnapshot,
  themeFromApiRow,
  type StudioThemeSnapshot,
} from '@/features/communication-studio/logic/theme';
import { templateNames } from '@/features/communication-studio/logic/templates';
import type { StudioDocument } from '@/features/communication-studio/logic/document';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import type { CreateFormConfig } from '../types/create-form.types';
import { createRouteSubmitTarget, createSuccessSubmitOutcome } from '../logic/createSubmitTargets';

const selectClass = 'w-full rounded-md border bg-background px-3 py-2 text-sm';
const kinds: StudioDocument['kind'][] = [
  'single',
  'event',
  'carousel',
  'story',
  'video',
  'campaign',
  'whiteboard',
];

export function useCreateStudioProjectForm(groupId: string | null): CreateFormConfig {
  const { t } = useTranslation();
  const tr = (key: string) => t(`features.studio.${key}`);
  const navigate = useNavigate();
  const zero = useZero();
  const { request } = useStudioApi();
  const { projects } = useStudioState(groupId);
  const createdId = useRef<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<StudioDocument['kind']>('single');
  const [mode, setMode] = useState<'template' | 'ai'>('template');
  const [template, setTemplate] = useState<string>('announcement');
  const [brief, setBrief] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [core, setCore] = useState(3);
  const [stories, setStories] = useState(2);
  const [themes, setThemes] = useState<StudioThemeSnapshot[]>(() =>
    BUILTIN_THEMES.map(theme => createThemeSnapshot(theme))
  );
  const [themeId, setThemeId] = useState(BUILTIN_THEMES[0].id);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    let active = true;
    void request<Record<string, unknown>[]>('themes', { groupId })
      .then(rows => {
        if (active)
          setThemes([
            ...BUILTIN_THEMES.map(theme => createThemeSnapshot(theme)),
            ...rows.map(themeFromApiRow),
          ]);
      })
      .catch(() => {
        /* Builtin themes remain available. */
      });
    return () => {
      active = false;
    };
  }, [groupId, request]);

  useEffect(() => {
    try {
      const incoming = JSON.parse(sessionStorage.getItem('studio:statement-return') || 'null');
      if (!incoming) return;
      setTitle(incoming.title || 'Neuer Beitrag');
      setBrief(incoming.text || '');
      setKind(incoming.isStory ? 'story' : 'single');
    } catch {
      /* Ignore invalid local drafts. */
    }
  }, []);

  const destination = (projectId: string) =>
    groupId
      ? createRouteSubmitTarget('studio', {
          to: '/group/$id/studio/$projectId',
          params: { id: groupId, projectId },
          label: t('pages.create.studioProject.openProject'),
        })
      : createRouteSubmitTarget('studio', {
          to: '/studio/$projectId',
          params: { projectId },
          label: t('pages.create.studioProject.openProject'),
        });

  const onSubmit: CreateFormConfig['onSubmit'] = async context => {
    setIsSubmitting(true);
    try {
      if (!createdId.current) {
        const result = await request<{ id: string }>('create', {
          groupId,
          title: title.trim(),
          kind,
          themeId,
          themeMode,
          template: template.startsWith('project:')
            ? { kind: 'project', id: template.slice('project:'.length) }
            : { kind: 'builtin', id: template },
          campaign: { weeks, core, stories },
        });
        createdId.current = result.id;
        context?.setRecoveryTarget(destination(result.id));
      }
      const projectId = createdId.current;
      if (mode === 'ai' && !localStorage.getItem(`project-chat:studio:${projectId}`)) {
        const conversationId = crypto.randomUUID();
        await serverConfirmed(
          zero.mutate(
            mutators.projectChat.create({
              id: conversationId,
              scope: { kind: 'studio', projectId },
              name: title.trim() || 'Briefing',
            })
          )
        );
        localStorage.setItem(`project-chat:studio:${projectId}`, conversationId);
        sessionStorage.setItem(`studio-brief:${projectId}`, brief.trim());
      }
      const target = destination(projectId);
      if (groupId) {
        await navigate({ to: '/group/$id/studio/$projectId', params: { id: groupId, projectId } });
      } else {
        await navigate({ to: '/studio/$projectId', params: { projectId } });
      }
      return createSuccessSubmitOutcome(target);
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (key: string, node: React.ReactNode) => ({ key, kind: 'custom' as const, node });
  const select = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: { value: string; label: string }[]
  ) => (
    <label className="block space-y-1 text-sm">
      <span>{tr(label)}</span>
      <select
        className={selectClass}
        value={value}
        onChange={event => onChange(event.target.value)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return {
    entityType: 'studio',
    title: 'pages.create.studioProject.title',
    isSubmitting,
    onSubmit,
    steps: [
      {
        label: 'pages.create.studioProject.details',
        isValid: () => title.trim().length > 0 && title.trim().length <= 200,
        fields: [
          {
            key: 'title',
            kind: 'text',
            label: tr('name'),
            required: true,
            value: title,
            onValueChange: setTitle,
            maxLength: 200,
          },
          field(
            'mode',
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t('pages.create.studioProject.startWith')}
              </legend>
              <div className="flex gap-3">
                {(['template', 'ai'] as const).map(value => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="studio-mode"
                      checked={mode === value}
                      onChange={() => setMode(value)}
                    />
                    {tr(value)}
                  </label>
                ))}
              </div>
            </fieldset>
          ),
          field(
            'kind',
            select(
              'templateName',
              kind,
              value => setKind(value as StudioDocument['kind']),
              kinds.map(value => ({ value, label: tr(value) }))
            )
          ),
          field(
            'template',
            select('template', template, setTemplate, [
              ...templateNames.map(value => ({ value, label: tr(value) })),
              ...projects
                .filter(project => project.is_template)
                .map(project => ({
                  value: `project:${project.id}`,
                  label: project.title,
                })),
            ])
          ),
        ],
      },
      {
        label: 'pages.create.studioProject.settings',
        isValid: () => mode !== 'ai' || brief.trim().length > 0,
        fields: [
          field(
            'theme',
            select(
              'theme',
              themeId,
              setThemeId,
              themes.map(theme => ({
                value: theme.themeId,
                label: theme.name,
              }))
            )
          ),
          field(
            'themeMode',
            select(
              'themeMode',
              themeMode,
              value => setThemeMode(value as 'light' | 'dark'),
              ['light', 'dark'].map(value => ({ value, label: tr(value) }))
            )
          ),
          ...(kind === 'campaign'
            ? [
                { key: 'weeks', label: tr('weeks'), value: weeks, set: setWeeks, min: 1, max: 12 },
                { key: 'core', label: tr('core'), value: core, set: setCore, min: 1, max: 3 },
                {
                  key: 'stories',
                  label: tr('stories'),
                  value: stories,
                  set: setStories,
                  min: 0,
                  max: 3,
                },
              ].map(item =>
                field(
                  item.key,
                  <label className="block space-y-1 text-sm">
                    <span>{item.label}</span>
                    <input
                      className={selectClass}
                      type="number"
                      min={item.min}
                      max={item.max}
                      value={item.value}
                      onChange={event =>
                        item.set(Math.max(item.min, Math.min(item.max, Number(event.target.value))))
                      }
                    />
                  </label>
                )
              )
            : []),
          ...(mode === 'ai'
            ? [
                {
                  key: 'brief',
                  kind: 'text' as const,
                  label: tr('brief'),
                  required: true,
                  multiline: true,
                  rows: 5,
                  value: brief,
                  onValueChange: setBrief,
                },
              ]
            : []),
        ],
      },
      {
        label: 'pages.create.common.review',
        isValid: () => title.trim().length > 0 && (mode !== 'ai' || brief.trim().length > 0),
        fields: [
          {
            key: 'summary',
            kind: 'customComponent',
            component: CreateSummaryStep,
            props: {
              entityType: 'studio',
              badge: t('pages.create.studioProject.title'),
              title: title.trim() || tr('newProject'),
              fields: [
                { label: t('pages.create.studioProject.startWith'), value: tr(mode) },
                { label: tr('templateName'), value: tr(kind) },
                {
                  label: tr('template'),
                  value: template.startsWith('project:')
                    ? (projects.find(project => `project:${project.id}` === template)?.title ??
                      template)
                    : tr(template),
                },
                {
                  label: tr('theme'),
                  value: themes.find(theme => theme.themeId === themeId)?.name ?? '',
                },
                { label: tr('themeMode'), value: tr(themeMode) },
                ...(kind === 'campaign'
                  ? [
                      { label: tr('weeks'), value: weeks },
                      { label: tr('core'), value: core },
                      { label: tr('stories'), value: stories },
                    ]
                  : []),
                ...(mode === 'ai' ? [{ label: tr('brief'), value: brief }] : []),
              ],
            },
          },
        ],
      },
    ],
  };
}
