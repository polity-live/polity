import { KeyRound, Loader2, Pencil, ShieldCheck, Sparkles, Trash2, Wrench } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Input } from '@/features/shared/ui/ui/input';
import { HashtagInput } from '@/features/shared/ui/ui/hashtag-input';
import { Label } from '@/features/shared/ui/ui/label';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Switch } from '@/features/shared/ui/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { AiProvider } from '@/lib/ai/schemas';
import { useAiSettingsTab } from '../hooks/useAiSettingsTab';

const PROVIDER_CONFIG: Record<
  AiProvider,
  {
    title: string;
    description: string;
    note: string;
  }
> = {
  openrouter: {
    title: 'OpenRouter',
    description:
      'Bring your own OpenRouter key for paid models. Free app-level OpenRouter models remain available to all users when configured on the server.',
    note: 'Server-side app key unlocks shared free models. Personal keys unlock paid and account-specific models.',
  },
  openai: {
    title: 'OpenAI',
    description: 'Use your own OpenAI key for GPT and reasoning models.',
    note: 'Stored encrypted on the server and never synced back through Zero.',
  },
  anthropic: {
    title: 'Anthropic',
    description: 'Use your own Anthropic key for Claude models.',
    note: 'Stored encrypted on the server and never synced back through Zero.',
  },
};

function formatTimestamp(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString();
}

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

function inputStateClass(value: string, error: string | null): string {
  if (error) {
    return 'border-red-500 focus-visible:ring-red-500';
  }

  if (value.trim()) {
    return 'border-emerald-500 focus-visible:ring-emerald-500';
  }

  return '';
}

function renderAliasBadges(aliases: string[]) {
  if (aliases.length === 0) {
    return <span className="text-muted-foreground text-xs">none</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {aliases.map(alias => (
        <Badge
          key={alias}
          className="border-0 bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-blue-500/20 text-[11px] text-sky-800 dark:text-sky-200"
        >
          {alias}
        </Badge>
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

export function AiSettingsTab() {
  const { t } = useTranslation();
  const ai = useAiSettingsTab();
  const builtInSlugSet = new Set(ai.builtInSkills.map(skill => skill.slug));
  const builtInOverridesBySlug = new Map(ai.skills.map(skill => [skill.slug, skill]));
  const builtInToolOverridesByName = new Map(ai.tools.map(tool => [tool.tool_name, tool]));
  const customSkills = ai.skills.filter(skill => !builtInSlugSet.has(skill.slug));
  const isEditingBuiltIn = Boolean(ai.editingBuiltInSlug);
  const skillDialogTitle =
    ai.editingSkillId || isEditingBuiltIn
      ? t('pages.user.ai.editSkill', 'Edit skill')
      : t('pages.user.ai.createSkill', 'Create skill');
  const skillDialogDescription = isEditingBuiltIn
    ? t(
        'pages.user.ai.editBuiltInDescription',
        'You are overriding a built-in skill for your account. This override is stored as your personal skill configuration.'
      )
    : t(
        'pages.user.ai.skillFormHint',
        'Use clear instructions. This prompt is appended to the base Aria & Kai system prompt.'
      );
  const aiSettingsOverviewCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ShieldCheck className="h-5 w-5" />
          {t('pages.user.ai.title', 'AI settings')}
        </CardTitle>
        <CardDescription>
          {t(
            'pages.user.ai.description',
            'Provider keys are posted once to the server, encrypted at rest, and never exposed through Zero queries or synced back to the client.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        <p>
          {t(
            'pages.user.ai.freeModels',
            'All users can use free OpenRouter models when OPENROUTER_API_KEY is configured on the server. Paid provider access comes from your BYOK credentials below.'
          )}
        </p>
      </CardContent>
    </Card>
  );
  const availableModelsCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ShieldCheck className="h-5 w-5" />
          {t('pages.user.ai.availableModelsTitle', 'Available models')}
        </CardTitle>
        <CardDescription>
          {t(
            'pages.user.ai.availableModelsDescription',
            'These models are currently available to this account in Aria & Kai.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-3 text-sm">
        {ai.models.length === 0 ? (
          <p>{t('pages.user.ai.noModels', 'No AI models are currently available.')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('pages.user.ai.models.model', 'Model')}</TableHead>
                <TableHead>{t('pages.user.ai.models.provider', 'Provider')}</TableHead>
                <TableHead>{t('pages.user.ai.models.contextWindow', 'Context')}</TableHead>
                <TableHead>{t('pages.user.ai.models.tags', 'Tags')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ai.models.map(model => (
                <TableRow key={`${model.provider}:${model.id}`}>
                  <TableCell className="font-medium">{model.label}</TableCell>
                  <TableCell className="text-muted-foreground uppercase">
                    {model.provider}
                  </TableCell>
                  <TableCell>{formatContextWindow(model.context_window)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge className="border-0 bg-gradient-to-r from-indigo-500/20 via-blue-500/20 to-cyan-500/20 text-[11px] text-blue-800 dark:text-blue-200">
                        {model.source === 'app' ? 'app' : 'byok'}
                      </Badge>
                      {model.free && (
                        <Badge className="border-0 bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-lime-500/20 text-[11px] text-emerald-800 dark:text-emerald-200">
                          free
                        </Badge>
                      )}
                      <Badge
                        className={
                          isAlwaysAvailableModel(model)
                            ? 'border-0 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 text-[11px] text-emerald-800 dark:text-emerald-200'
                            : 'border-0 bg-gradient-to-r from-rose-500/20 via-red-500/20 to-orange-500/20 text-[11px] text-red-800 dark:text-red-200'
                        }
                      >
                        {isAlwaysAvailableModel(model)
                          ? t('pages.user.ai.models.stable', 'stable')
                          : t('pages.user.ai.models.mayFail', 'may fail')}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {aiSettingsOverviewCard}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5" />
            {t('pages.user.ai.toolsTitle', 'Available tools')}
          </CardTitle>
          <CardDescription>
            {t(
              'pages.user.ai.toolsDescription',
              'Tools are callable Polity APIs that Aria & Kai can execute and read results from. Skills are prompt instructions and are configured separately below.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('pages.user.ai.tools.name', 'Name')}</TableHead>
                <TableHead>{t('pages.user.ai.tools.identifier', 'Identifier')}</TableHead>
                <TableHead>{t('pages.user.ai.tools.type', 'Type')}</TableHead>
                <TableHead>{t('pages.user.ai.tools.descriptionColumn', 'Description')}</TableHead>
                <TableHead>{t('common.labels.enabled', 'Enabled')}</TableHead>
                <TableHead>{t('common.labels.status', 'Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ai.builtInTools.map(tool => {
                const override = builtInToolOverridesByName.get(tool.name);
                const isEnabled = override?.enabled ?? true;

                return (
                  <TableRow key={tool.name}>
                    <TableCell className="font-medium">{tool.label}</TableCell>
                    <TableCell>{tool.name}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          tool.kind === 'create'
                            ? 'border-0 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 text-[11px] text-amber-800 dark:text-amber-200'
                            : 'border-0 bg-gradient-to-r from-sky-500/20 via-cyan-500/20 to-blue-500/20 text-[11px] text-sky-800 dark:text-sky-200'
                        }
                      >
                        {tool.kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {tool.description}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={checked => ai.toggleBuiltInToolEnabled(tool.name, checked)}
                        aria-label={t('pages.user.ai.tools.toggle', 'Toggle tool')}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          override
                            ? 'border-0 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-pink-500/20 text-[11px] text-fuchsia-800 dark:text-fuchsia-200'
                            : 'border-0 bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-lime-500/20 text-[11px] text-emerald-800 dark:text-emerald-200'
                        }
                      >
                        {override
                          ? t('pages.user.ai.tools.overridden', 'overridden')
                          : t('pages.user.ai.tools.default', 'default')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('pages.user.ai.skillsBuiltIn', 'Built-in skills')}
          </CardTitle>
          <CardDescription>
            {t(
              'pages.user.ai.skillsBuiltInDescription',
              'These skills are available in the Aria & Kai chat via slash commands even without creating your own custom skill.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('pages.user.ai.skills.name', 'Name')}</TableHead>
                <TableHead>{t('pages.user.ai.skills.slug', 'Slug')}</TableHead>
                <TableHead>{t('pages.user.ai.skills.aliases', 'Aliases')}</TableHead>
                <TableHead>{t('common.labels.status', 'Status')}</TableHead>
                <TableHead>{t('common.labels.enabled', 'Enabled')}</TableHead>
                <TableHead>{t('common.labels.status', 'Status')}</TableHead>
                <TableHead className="w-[120px]">{t('common.actions.edit', 'Edit')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ai.builtInSkills.map(skill => {
                const override = builtInOverridesBySlug.get(skill.slug);
                const effectiveAliases = override ? parseAliases(override.aliases) : skill.aliases;
                const isEnabled = override?.enabled ?? true;

                return (
                  <TableRow key={skill.slug}>
                    <TableCell className="font-medium">{override?.name ?? skill.name}</TableCell>
                    <TableCell>/{skill.slug}</TableCell>
                    <TableCell>{renderAliasBadges(effectiveAliases)}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          isEnabled
                            ? 'border-0 bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-lime-500/20 text-[11px] text-emerald-800 dark:text-emerald-200'
                            : 'border-0 bg-gradient-to-r from-zinc-500/20 via-slate-500/20 to-stone-500/20 text-[11px] text-slate-800 dark:text-slate-200'
                        }
                      >
                        {isEnabled
                          ? t('common.status.enabled', 'enabled')
                          : t('common.status.disabled', 'disabled')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={checked =>
                          ai.toggleBuiltInSkillEnabled(skill.slug, checked)
                        }
                        aria-label={t('pages.user.ai.skills.toggle', 'Toggle skill')}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge className="border-0 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-pink-500/20 text-[11px] text-fuchsia-800 dark:text-fuchsia-200">
                        {override
                          ? t('pages.user.ai.skills.overridden', 'overridden')
                          : t('pages.user.ai.skills.default', 'default')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => ai.startEditBuiltInSkill(skill.slug)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        {t('common.actions.edit', 'Edit')}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">
                {t('pages.user.ai.customSkills', 'Custom skills')}
              </CardTitle>
              <CardDescription>
                {t(
                  'pages.user.ai.customSkillsDescription',
                  'Create reusable slash-command skills for Aria & Kai. Custom skills stay reactive through Zero and are available in chat immediately.'
                )}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={ai.startCreateSkill}>
              <Sparkles className="mr-2 h-4 w-4" />
              {t('pages.user.ai.newSkill', 'New skill')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {customSkills.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
              {t(
                'pages.user.ai.noCustomSkills',
                'No custom skills yet. Create one below and use it in chat with `/your-skill`.'
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('pages.user.ai.skills.name', 'Name')}</TableHead>
                  <TableHead>{t('pages.user.ai.skills.slug', 'Slug')}</TableHead>
                  <TableHead>{t('pages.user.ai.skills.aliases', 'Aliases')}</TableHead>
                  <TableHead>{t('common.labels.enabled', 'Enabled')}</TableHead>
                  <TableHead className="w-[180px]">{t('common.actions.edit', 'Edit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customSkills.map(skill => (
                  <TableRow key={skill.id}>
                    <TableCell className="font-medium">{skill.name}</TableCell>
                    <TableCell>/{skill.slug}</TableCell>
                    <TableCell>{renderAliasBadges(parseAliases(skill.aliases))}</TableCell>
                    <TableCell>
                      <Switch
                        checked={skill.enabled}
                        onCheckedChange={checked => ai.toggleCustomSkillEnabled(skill.id, checked)}
                        aria-label={t('pages.user.ai.skills.toggle', 'Toggle skill')}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => ai.startEditSkill(skill.id)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          {t('common.actions.edit', 'Edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => ai.deleteSkill(skill.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('pages.user.ai.credentialsTitle', 'Provider API keys')}
          </CardTitle>
          <CardDescription>
            {t(
              'pages.user.ai.credentialsDescription',
              'Stored encrypted on the server. Keys are never synced through Zero.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-3">
            {(Object.keys(PROVIDER_CONFIG) as AiProvider[]).map(provider => {
              const config = PROVIDER_CONFIG[provider];
              const summary = ai.credentialsByProvider[provider];
              const isSaving = ai.savingProvider === provider;
              const isDeleting = ai.deletingProvider === provider;

              return (
                <Card key={provider}>
                  <CardHeader>
                    <CardTitle className="text-base">{config.title}</CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/30 rounded-md border p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <KeyRound className="h-4 w-4" />
                        {summary.has_key
                          ? t('pages.user.ai.credentials.savedState', 'Saved on server')
                          : t('pages.user.ai.credentials.missingState', 'No key saved')}
                      </div>
                      {summary.key_hint && (
                        <p className="text-muted-foreground mt-1">{summary.key_hint}</p>
                      )}
                      {summary.updated_at && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {t('pages.user.ai.credentials.updatedAt', 'Updated')}:{' '}
                          {formatTimestamp(summary.updated_at)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`ai-provider-${provider}`}>
                        {t('pages.user.ai.credentials.apiKey', 'API key')}
                      </Label>
                      <Input
                        id={`ai-provider-${provider}`}
                        type="password"
                        autoComplete="off"
                        value={ai.providerInputs[provider]}
                        onChange={event => ai.updateProviderInput(provider, event.target.value)}
                        placeholder={t(
                          'pages.user.ai.credentials.placeholder',
                          'Paste a new API key to save or replace'
                        )}
                      />
                      <p className="text-muted-foreground text-xs">{config.note}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => {
                          void ai.saveCredential(provider);
                        }}
                        disabled={isSaving}
                        className="flex-1"
                      >
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {summary.has_key
                          ? t('pages.user.ai.credentials.update', 'Update key')
                          : t('pages.user.ai.credentials.save', 'Save key')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          void ai.deleteCredential(provider);
                        }}
                        disabled={!summary.has_key || isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {availableModelsCard}

      <Dialog
        open={ai.isSkillDialogOpen}
        onOpenChange={open => {
          if (open) {
            ai.setIsSkillDialogOpen(true);
            return;
          }

          ai.cancelSkillEdit();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{skillDialogTitle}</DialogTitle>
            <DialogDescription>{skillDialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ai-skill-name">{t('pages.user.ai.skills.name', 'Name')}</Label>
                <Input
                  id="ai-skill-name"
                  value={ai.skillForm.name}
                  onChange={event => ai.updateSkillForm('name', event.target.value)}
                  className={inputStateClass(ai.skillForm.name, ai.skillFormErrors.name)}
                />
                <p
                  className={`text-xs ${ai.skillFormErrors.name ? 'text-red-500' : 'text-emerald-600'}`}
                >
                  {ai.skillFormErrors.name || t('common.validation.good', 'Looks good.')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-skill-slug">{t('pages.user.ai.skills.slug', 'Slug')}</Label>
                <Input
                  id="ai-skill-slug"
                  value={ai.skillForm.slug}
                  onChange={event => ai.updateSkillForm('slug', event.target.value)}
                  disabled={isEditingBuiltIn}
                  className={inputStateClass(ai.skillForm.slug, ai.skillFormErrors.slug)}
                  placeholder={
                    ai.skillForm.name
                      ? ai.skillForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                      : 'campaign-planner'
                  }
                />
                <p
                  className={`text-xs ${ai.skillFormErrors.slug ? 'text-red-500' : 'text-emerald-600'}`}
                >
                  {ai.skillFormErrors.slug ||
                    t('pages.user.ai.skills.slugHint', 'Letters, numbers, hyphens.')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-skill-aliases">
                {t('pages.user.ai.skills.aliases', 'Aliases')}
              </Label>
              <HashtagInput
                inputId="ai-skill-aliases"
                value={parseAliases(ai.skillForm.aliases)}
                onChange={aliases => ai.updateSkillForm('aliases', aliases.join(','))}
                showLabel={false}
                inputClassName={inputStateClass(ai.skillForm.aliases, ai.skillFormErrors.aliases)}
                placeholder={t(
                  'pages.user.ai.skills.aliasesPlaceholder',
                  'Add an alias, e.g. campaign-strategy'
                )}
              />
              <p
                className={`text-xs ${ai.skillFormErrors.aliases ? 'text-red-500' : 'text-emerald-600'}`}
              >
                {ai.skillFormErrors.aliases ||
                  t(
                    'pages.user.ai.skills.aliasHint',
                    'Aliases are optional. Press Enter or Add after each one.'
                  )}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-skill-prompt">
                {t('pages.user.ai.skills.systemPrompt', 'System prompt')}
              </Label>
              <Textarea
                id="ai-skill-prompt"
                value={ai.skillForm.systemPrompt}
                onChange={event => ai.updateSkillForm('systemPrompt', event.target.value)}
                className={`min-h-[180px] ${inputStateClass(ai.skillForm.systemPrompt, ai.skillFormErrors.systemPrompt)}`}
              />
              <p
                className={`text-xs ${ai.skillFormErrors.systemPrompt ? 'text-red-500' : 'text-emerald-600'}`}
              >
                {ai.skillFormErrors.systemPrompt ||
                  t('pages.user.ai.skills.promptHint', 'Prompt is valid.')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={ai.cancelSkillEdit}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="button" onClick={ai.saveSkill} disabled={!ai.isSkillFormValid}>
              {ai.editingSkillId || isEditingBuiltIn
                ? t('pages.user.ai.skills.update', 'Update skill')
                : t('pages.user.ai.skills.create', 'Create skill')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
