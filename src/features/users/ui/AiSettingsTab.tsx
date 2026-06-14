import { KeyRound, Loader2, Pencil, ShieldCheck, Sparkles, Trash2, Wrench } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/shared/ui/ui/alert-dialog';
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
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
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
    title: translateText('generated.inline.0565_openrouter_12ecf701'),
    description: translateText(
      'generated.inline.0566_bring_your_own_openrouter_key_for_paid_models_3ec74496'
    ),
    note: translateText(
      'generated.inline.0567_server_side_app_key_unlocks_shared_free_model_6a9cf0d3'
    ),
  },
  openai: {
    title: translateText('generated.inline.0568_openai_a19ee5a9'),
    description: translateText(
      'generated.inline.0569_use_your_own_openai_key_for_gpt_and_reasoning_b159d4b7'
    ),
    note: translateText(
      'generated.inline.0570_stored_encrypted_on_the_server_and_never_sync_1676517b'
    ),
  },
  anthropic: {
    title: translateText('generated.inline.0571_anthropic_b780a23b'),
    description: translateText(
      'generated.inline.0572_use_your_own_anthropic_key_for_claude_models_8f668ee3'
    ),
    note: translateText(
      'generated.inline.0570_stored_encrypted_on_the_server_and_never_sync_1676517b'
    ),
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

function inputStateClass(value: string, error: string | null, hasBeenEvaluated: boolean): string {
  if (!hasBeenEvaluated) {
    return '';
  }

  if (error) {
    return 'border-red-500 focus-visible:ring-red-500';
  }

  if (value.trim()) {
    return 'border-emerald-500 focus-visible:ring-emerald-500';
  }

  return '';
}

function fieldHintClass(error: string | null, hasBeenEvaluated: boolean): string {
  if (error) {
    return 'text-xs text-red-500';
  }

  if (hasBeenEvaluated) {
    return 'text-xs text-emerald-600';
  }

  return 'text-muted-foreground text-xs';
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
  const aiSettingsOverviewCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ShieldCheck className="h-5 w-5" />
          {t('pages.user.ai.title')}
        </CardTitle>
        <CardDescription>{t('pages.user.ai.description')}</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
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
      <CardContent className="text-muted-foreground space-y-3 text-sm">
        {ai.models.length === 0 ? (
          <p>{t('pages.user.ai.noModels')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('pages.user.ai.models.model')}</TableHead>
                <TableHead>{t('pages.user.ai.models.provider')}</TableHead>
                <TableHead>{t('pages.user.ai.models.contextWindow')}</TableHead>
                <TableHead>{t('pages.user.ai.models.tags')}</TableHead>
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
                        {model.source === 'app'
                          ? translateText('generated.inline.0177_app_7d104347')
                          : translateText('generated.inline.0178_byok_15b99395')}
                      </Badge>
                      {model.free && (
                        <Badge className="border-0 bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-lime-500/20 text-[11px] text-emerald-800 dark:text-emerald-200">
                          {translateText('generated.inline.0179_free_4ff88aad')}
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
                          : t('pages.user.ai.models.mayFail')}
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
            {t('pages.user.ai.toolsTitle')}
          </CardTitle>
          <CardDescription>{t('pages.user.ai.toolsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('pages.user.ai.tools.name')}</TableHead>
                <TableHead>{t('pages.user.ai.tools.identifier')}</TableHead>
                <TableHead>{t('pages.user.ai.tools.type')}</TableHead>
                <TableHead>{t('pages.user.ai.tools.descriptionColumn')}</TableHead>
                <TableHead>{t('common.labels.enabled')}</TableHead>
                <TableHead>{t('common.labels.status')}</TableHead>
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
                        aria-label={t('pages.user.ai.tools.toggle')}
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
          <CardTitle className="text-lg">{t('pages.user.ai.skillsBuiltIn')}</CardTitle>
          <CardDescription>{t('pages.user.ai.skillsBuiltInDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('pages.user.ai.skills.name')}</TableHead>
                <TableHead>{t('pages.user.ai.skills.slug')}</TableHead>
                <TableHead>{t('pages.user.ai.skills.aliases')}</TableHead>
                <TableHead>{t('common.labels.status')}</TableHead>
                <TableHead>{t('common.labels.enabled')}</TableHead>
                <TableHead>{t('common.labels.status')}</TableHead>
                <TableHead className="w-[120px]">{t('common.actions.edit')}</TableHead>
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
                        aria-label={t('pages.user.ai.skills.toggle')}
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
                        {t('common.actions.edit')}
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
              <CardTitle className="text-lg">{t('pages.user.ai.customSkills')}</CardTitle>
              <CardDescription>{t('pages.user.ai.customSkillsDescription')}</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={ai.startCreateSkill}>
              <Sparkles className="mr-2 h-4 w-4" />
              {t('pages.user.ai.newSkill')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {customSkills.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
              {t('pages.user.ai.noCustomSkills')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('pages.user.ai.skills.name')}</TableHead>
                  <TableHead>{t('pages.user.ai.skills.slug')}</TableHead>
                  <TableHead>{t('pages.user.ai.skills.aliases')}</TableHead>
                  <TableHead>{t('common.labels.enabled')}</TableHead>
                  <TableHead className="w-[180px]">{t('common.actions.edit')}</TableHead>
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
                        aria-label={t('pages.user.ai.skills.toggle')}
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
                          {t('common.actions.edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => ai.requestDeleteSkill(skill.id)}
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
          <CardTitle className="text-lg">{t('pages.user.ai.credentialsTitle')}</CardTitle>
          <CardDescription>{t('pages.user.ai.credentialsDescription')}</CardDescription>
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
                          ? t('pages.user.ai.credentials.savedState')
                          : t('pages.user.ai.credentials.missingState')}
                      </div>
                      {summary.key_hint && (
                        <p className="text-muted-foreground mt-1">{summary.key_hint}</p>
                      )}
                      {summary.updated_at && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {t('pages.user.ai.credentials.updatedAt')}:{' '}
                          {formatTimestamp(summary.updated_at)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`ai-provider-${provider}`}>
                        {t('pages.user.ai.credentials.apiKey')}
                      </Label>
                      <Input
                        id={`ai-provider-${provider}`}
                        type="password"
                        autoComplete="off"
                        value={ai.providerInputs[provider]}
                        onChange={event => ai.updateProviderInput(provider, event.target.value)}
                        placeholder={t('pages.user.ai.credentials.placeholder')}
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
                          ? t('pages.user.ai.credentials.update')
                          : t('pages.user.ai.credentials.save')}
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
                <Label htmlFor="ai-skill-name">{t('pages.user.ai.skills.name')}</Label>
                <Input
                  id="ai-skill-name"
                  value={ai.skillForm.name}
                  onChange={event => {
                    ai.touchSkillField('name');
                    ai.updateSkillForm('name', event.target.value);
                  }}
                  onBlur={() => ai.touchSkillField('name')}
                  className={inputStateClass(
                    ai.skillForm.name,
                    ai.visibleSkillFormErrors.name,
                    skillFieldEvaluated.name
                  )}
                />
                <p
                  className={fieldHintClass(
                    ai.visibleSkillFormErrors.name,
                    skillFieldEvaluated.name
                  )}
                >
                  {ai.visibleSkillFormErrors.name ||
                    (skillFieldEvaluated.name
                      ? t('common.validation.good')
                      : t('pages.user.ai.skills.requiredHint'))}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-skill-slug">{t('pages.user.ai.skills.slug')}</Label>
                <Input
                  id="ai-skill-slug"
                  value={ai.skillForm.slug}
                  onChange={event => {
                    ai.touchSkillField('slug');
                    ai.updateSkillForm('slug', event.target.value);
                  }}
                  onBlur={() => ai.touchSkillField('slug')}
                  disabled={isEditingBuiltIn}
                  className={inputStateClass(
                    ai.skillForm.slug,
                    ai.visibleSkillFormErrors.slug,
                    skillFieldEvaluated.slug
                  )}
                  placeholder={
                    ai.skillForm.name
                      ? ai.skillForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                      : 'campaign-planner'
                  }
                />
                <p
                  className={fieldHintClass(
                    ai.visibleSkillFormErrors.slug,
                    skillFieldEvaluated.slug
                  )}
                >
                  {ai.visibleSkillFormErrors.slug || t('pages.user.ai.skills.slugHint')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-skill-aliases">{t('pages.user.ai.skills.aliases')}</Label>
              <HashtagInput
                inputId="ai-skill-aliases"
                value={parseAliases(ai.skillForm.aliases)}
                onChange={aliases => {
                  ai.touchSkillField('aliases');
                  ai.updateSkillForm('aliases', aliases.join(','));
                }}
                showLabel={false}
                inputClassName={inputStateClass(
                  ai.skillForm.aliases,
                  ai.visibleSkillFormErrors.aliases,
                  skillFieldEvaluated.aliases
                )}
                placeholder={t('pages.user.ai.skills.aliasesPlaceholder')}
              />
              <p
                className={fieldHintClass(
                  ai.visibleSkillFormErrors.aliases,
                  skillFieldEvaluated.aliases
                )}
              >
                {ai.visibleSkillFormErrors.aliases || t('pages.user.ai.skills.aliasHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-skill-prompt">{t('pages.user.ai.skills.systemPrompt')}</Label>
              <Textarea
                id="ai-skill-prompt"
                value={ai.skillForm.systemPrompt}
                onChange={event => {
                  ai.touchSkillField('systemPrompt');
                  ai.updateSkillForm('systemPrompt', event.target.value);
                }}
                onBlur={() => ai.touchSkillField('systemPrompt')}
                className={`min-h-[180px] ${inputStateClass(
                  ai.skillForm.systemPrompt,
                  ai.visibleSkillFormErrors.systemPrompt,
                  skillFieldEvaluated.systemPrompt
                )}`}
              />
              <p
                className={fieldHintClass(
                  ai.visibleSkillFormErrors.systemPrompt,
                  skillFieldEvaluated.systemPrompt
                )}
              >
                {ai.visibleSkillFormErrors.systemPrompt ||
                  (skillFieldEvaluated.systemPrompt
                    ? t('pages.user.ai.skills.promptHint')
                    : t('pages.user.ai.skills.requiredHint'))}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={ai.cancelSkillEdit}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={ai.saveSkill} disabled={!ai.isSkillFormValid}>
              {ai.editingSkillId || isEditingBuiltIn
                ? t('pages.user.ai.skills.update')
                : t('pages.user.ai.skills.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(ai.pendingSkillDeletion)}
        onOpenChange={open => {
          if (!open) {
            ai.cancelDeleteSkill();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.user.ai.skills.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pages.user.ai.skills.deleteDescription').replace(
                '{{name}}',
                ai.pendingSkillDeletion?.name ?? ''
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={ai.confirmDeleteSkill}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {t('common.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
