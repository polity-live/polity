import { Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { InlineSwitch } from '@/features/shared/ui/form';
import { StatusBadge } from '@/features/shared/ui/status';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import type { AiProvider } from '@/lib/ai/schemas';
import { useAiSettingsTab } from '../hooks/useAiSettingsTab';
function formatContextWindow(value: number | null | undefined): string {
  if (!value || value <= 0) {
    return 'n/a';
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }

  return `${value}`;
}

function isAlwaysAvailableModel(model: {
  provider: AiProvider;
  source: 'app' | 'byok';
  free: boolean;
}): boolean {
  return model.provider === 'openrouter' && model.source === 'app' && model.free;
}
function renderAliasBadges(aliases: string[]) {
  if (aliases.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">
        {translateText('generated.inline.0176_none_71f8e797')}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {aliases.map(alias => (
        <StatusBadge key={alias} status="alias" tone="info">
          {alias}
        </StatusBadge>
      ))}
    </div>
  );
}

function parseAliases(value: string): string[] {
  return value
    .split(',')
    .map(alias => alias.trim())
    .filter(Boolean);
}
import { AiSettingsTabView } from './AiSettingsTabView';
export function AiSettingsTab() {
  const { t } = useTranslation();
  const ai = useAiSettingsTab();
  const skillFieldEvaluated = {
    name: ai.hasAttemptedSkillSubmit || ai.skillFormTouched.name,
    slug: ai.hasAttemptedSkillSubmit || ai.skillFormTouched.slug,
    aliases: ai.hasAttemptedSkillSubmit || ai.skillFormTouched.aliases,
    systemPrompt: ai.hasAttemptedSkillSubmit || ai.skillFormTouched.systemPrompt,
  };
  const builtInSlugSet = new Set(ai.builtInSkills.map(skill => skill.slug));
  const builtInOverridesBySlug = new Map(ai.skills.map(skill => [skill.slug, skill]));
  const builtInToolOverridesByName = new Map(ai.tools.map(tool => [tool.tool_name, tool]));
  const customSkills = ai.skills.filter(skill => !builtInSlugSet.has(skill.slug));
  const isEditingBuiltIn = Boolean(ai.editingBuiltInSlug);
  const skillDialogTitle =
    ai.editingSkillId || isEditingBuiltIn
      ? t('pages.user.ai.editSkill')
      : t('pages.user.ai.createSkill');
  const skillDialogDescription = isEditingBuiltIn
    ? t('pages.user.ai.editBuiltInDescription')
    : t('pages.user.ai.skillFormHint');

  type AiModelRow = (typeof ai.models)[number];
  type BuiltInToolRow = (typeof ai.builtInTools)[number];
  type BuiltInSkillRow = (typeof ai.builtInSkills)[number];
  type CustomSkillRow = (typeof customSkills)[number];

  const modelColumns: ColumnDef<AiModelRow>[] = [
    {
      accessorKey: 'label',
      header: t('pages.user.ai.models.model'),
      cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
    },
    {
      accessorKey: 'provider',
      header: t('pages.user.ai.models.provider'),
      cell: ({ row }) => (
        <span className="text-muted-foreground uppercase">{row.original.provider}</span>
      ),
    },
    {
      accessorKey: 'context_window',
      header: t('pages.user.ai.models.contextWindow'),
      cell: ({ row }) => formatContextWindow(row.original.context_window),
    },
    {
      id: 'tags',
      header: t('pages.user.ai.models.tags'),
      cell: ({ row }) => {
        const model = row.original;

        return (
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={model.source} tone={model.source === 'app' ? 'info' : 'accent'}>
              {model.source === 'app'
                ? translateText('generated.inline.0177_app_7d104347')
                : translateText('generated.inline.0178_byok_15b99395')}
            </StatusBadge>
            {model.free ? (
              <StatusBadge status="free" tone="success">
                {translateText('generated.inline.0179_free_4ff88aad')}
              </StatusBadge>
            ) : null}
            <StatusBadge
              status={isAlwaysAvailableModel(model) ? 'stable' : 'may-fail'}
              tone={isAlwaysAvailableModel(model) ? 'success' : 'destructive'}
            >
              {isAlwaysAvailableModel(model)
                ? t('pages.user.ai.models.stable', 'stable')
                : t('pages.user.ai.models.mayFail')}
            </StatusBadge>
          </div>
        );
      },
    },
  ];

  const toolColumns: ColumnDef<BuiltInToolRow>[] = [
    {
      accessorKey: 'label',
      header: t('pages.user.ai.tools.name'),
      cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
    },
    {
      accessorKey: 'name',
      header: t('pages.user.ai.tools.identifier'),
    },
    {
      accessorKey: 'kind',
      header: t('pages.user.ai.tools.type'),
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.kind}
          tone={
            row.original.kind === 'create'
              ? 'warning'
              : row.original.kind === 'update'
                ? 'accent'
                : 'info'
          }
        >
          {row.original.kind}
        </StatusBadge>
      ),
    },
    {
      accessorKey: 'description',
      header: t('pages.user.ai.tools.descriptionColumn'),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.description}</span>
      ),
    },
    {
      id: 'enabled',
      header: t('common.labels.enabled'),
      cell: ({ row }) => {
        const tool = row.original;
        const override = builtInToolOverridesByName.get(tool.name);
        const isEnabled = override?.enabled ?? true;

        return (
          <InlineSwitch
            checked={isEnabled}
            onCheckedChange={checked => ai.toggleBuiltInToolEnabled(tool.name, checked)}
            aria-label={t('pages.user.ai.tools.toggle')}
            data-action-id="users.ai.built-in-tool.toggle"
          />
        );
      },
    },
    {
      id: 'status',
      header: t('common.labels.status'),
      cell: ({ row }) => {
        const override = builtInToolOverridesByName.get(row.original.name);

        return (
          <StatusBadge
            status={override ? 'overridden' : 'default'}
            tone={override ? 'accent' : 'success'}
          >
            {override
              ? t('pages.user.ai.tools.overridden', 'overridden')
              : t('pages.user.ai.tools.default', 'default')}
          </StatusBadge>
        );
      },
    },
  ];

  const builtInSkillColumns: ColumnDef<BuiltInSkillRow>[] = [
    {
      id: 'name',
      header: t('pages.user.ai.skills.name'),
      cell: ({ row }) => {
        const override = builtInOverridesBySlug.get(row.original.slug);

        return <span className="font-medium">{override?.name ?? row.original.name}</span>;
      },
    },
    {
      accessorKey: 'slug',
      header: t('pages.user.ai.skills.slug'),
      cell: ({ row }) => <>/{row.original.slug}</>,
    },
    {
      id: 'aliases',
      header: t('pages.user.ai.skills.aliases'),
      cell: ({ row }) => {
        const override = builtInOverridesBySlug.get(row.original.slug);
        const effectiveAliases = override
          ? parseAliases(override.aliases ?? '')
          : [...row.original.aliases];

        return renderAliasBadges(effectiveAliases);
      },
    },
    {
      id: 'enabled-status',
      header: t('common.labels.status'),
      cell: ({ row }) => {
        const override = builtInOverridesBySlug.get(row.original.slug);
        const isEnabled = override?.enabled ?? true;

        return (
          <StatusBadge
            status={isEnabled ? 'enabled' : 'disabled'}
            tone={isEnabled ? 'success' : 'neutral'}
          >
            {isEnabled
              ? t('common.status.enabled', 'enabled')
              : t('common.status.disabled', 'disabled')}
          </StatusBadge>
        );
      },
    },
    {
      id: 'enabled',
      header: t('common.labels.enabled'),
      cell: ({ row }) => {
        const override = builtInOverridesBySlug.get(row.original.slug);
        const isEnabled = override?.enabled ?? true;

        return (
          <InlineSwitch
            checked={isEnabled}
            onCheckedChange={checked => ai.toggleBuiltInSkillEnabled(row.original.slug, checked)}
            aria-label={t('pages.user.ai.skills.toggle')}
            data-action-id="users.ai.built-in-skill.toggle"
          />
        );
      },
    },
    {
      id: 'override-status',
      header: t('common.labels.status'),
      cell: ({ row }) => {
        const override = builtInOverridesBySlug.get(row.original.slug);

        return (
          <StatusBadge
            status={override ? 'overridden' : 'default'}
            tone={override ? 'accent' : 'success'}
          >
            {override
              ? t('pages.user.ai.skills.overridden', 'overridden')
              : t('pages.user.ai.skills.default', 'default')}
          </StatusBadge>
        );
      },
    },
    {
      id: 'actions',
      header: t('common.actions.edit'),
      meta: {
        cellClassName: 'w-[120px]',
      },
      cell: ({ row }) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => ai.startEditBuiltInSkill(row.original.slug)}
          data-action-id="users.ai.built-in-skill.edit"
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          {t('common.actions.edit')}
        </Button>
      ),
    },
  ];

  const customSkillColumns: ColumnDef<CustomSkillRow>[] = [
    {
      accessorKey: 'name',
      header: t('pages.user.ai.skills.name'),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'slug',
      header: t('pages.user.ai.skills.slug'),
      cell: ({ row }) => <>/{row.original.slug}</>,
    },
    {
      accessorKey: 'aliases',
      header: t('pages.user.ai.skills.aliases'),
      cell: ({ row }) => renderAliasBadges(parseAliases(row.original.aliases ?? '')),
    },
    {
      accessorKey: 'enabled',
      header: t('common.labels.enabled'),
      cell: ({ row }) => (
        <InlineSwitch
          checked={row.original.enabled}
          onCheckedChange={checked => ai.toggleCustomSkillEnabled(row.original.id, checked)}
          aria-label={t('pages.user.ai.skills.toggle')}
          data-action-id="users.ai.custom-skill.toggle"
        />
      ),
    },
    {
      id: 'actions',
      header: t('common.actions.edit'),
      meta: {
        cellClassName: 'w-[180px]',
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ai.startEditSkill(row.original.id)}
            data-action-id="users.ai.custom-skill.edit"
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {t('common.actions.edit')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ai.requestDeleteSkill(row.original.id)}
            aria-label={t('common.actions.delete')}
            data-action-id="users.ai.custom-skill.delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const aiSettingsOverviewCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ShieldCheck className="h-5 w-5" />
          {t('pages.user.ai.title')}
        </CardTitle>
        <CardDescription>{t('pages.user.ai.description')}</CardDescription>
      </CardHeader>
      <CardContent tone="muted" className="text-sm">
        <p>{t('pages.user.ai.freeModels')}</p>
      </CardContent>
    </Card>
  );
  const availableModelsCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ShieldCheck className="h-5 w-5" />
          {t('pages.user.ai.availableModelsTitle')}
        </CardTitle>
        <CardDescription>{t('pages.user.ai.availableModelsDescription')}</CardDescription>
      </CardHeader>
      <CardContent tone="muted" className="space-y-3 text-sm">
        <DataTable
          columns={modelColumns}
          data={ai.models}
          getRowId={model => `${model.provider}:${model.id}`}
          enablePagination={false}
          emptyTitle={t('pages.user.ai.availableModelsTitle')}
          emptyDescription={t('pages.user.ai.noModels')}
        />
      </CardContent>
    </Card>
  );
  return (
    <AiSettingsTabView
      t={t}
      ai={ai}
      skillFieldEvaluated={skillFieldEvaluated}
      builtInSlugSet={builtInSlugSet}
      builtInOverridesBySlug={builtInOverridesBySlug}
      builtInToolOverridesByName={builtInToolOverridesByName}
      customSkills={customSkills}
      isEditingBuiltIn={isEditingBuiltIn}
      skillDialogTitle={skillDialogTitle}
      skillDialogDescription={skillDialogDescription}
      modelColumns={modelColumns}
      toolColumns={toolColumns}
      builtInSkillColumns={builtInSkillColumns}
      customSkillColumns={customSkillColumns}
      aiSettingsOverviewCard={aiSettingsOverviewCard}
      availableModelsCard={availableModelsCard}
    />
  );
}
