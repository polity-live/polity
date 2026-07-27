import { featureThemeClassName } from '@/features/shared/theme';
import { KeyRound, Loader2, Sparkles, Trash2, Wrench } from 'lucide-react';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { HashtagInput } from '@/features/shared/ui/hashtags';
import { DataTable } from '@/features/shared/ui/data-table';
import { FormFieldShell, PasswordField, TextField } from '@/features/shared/ui/form';
import { DangerConfirmDialog, ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { AiProvider } from '@/lib/ai/schemas';

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
function inputStateClass(value: string, error: string | null, hasBeenEvaluated: boolean): string {
  if (!hasBeenEvaluated) {
    return '';
  }

  if (error) {
    return featureThemeClassName('userAiSettingsTabDangerBorder');
  }

  if (value.trim()) {
    return featureThemeClassName('userAiSettingsTabSuccessBorder');
  }

  return '';
}
function parseAliases(value: string): string[] {
  return value
    .split(',')
    .map((alias: any) => alias.trim())
    .filter(Boolean);
}
export interface AiSettingsTabViewProps {
  t: any;
  ai: any;
  skillFieldEvaluated: any;
  builtInSlugSet: any;
  builtInOverridesBySlug: any;
  builtInToolOverridesByName: any;
  customSkills: any;
  isEditingBuiltIn: any;
  skillDialogTitle: any;
  skillDialogDescription: any;
  modelColumns: any;
  toolColumns: any;
  builtInSkillColumns: any;
  customSkillColumns: any;
  aiSettingsOverviewCard: any;
  availableModelsCard: any;
}

export function AiSettingsTabView({
  t,
  ai,
  skillFieldEvaluated,
  customSkills,
  isEditingBuiltIn,
  skillDialogTitle,
  skillDialogDescription,
  toolColumns,
  builtInSkillColumns,
  customSkillColumns,
  aiSettingsOverviewCard,
  availableModelsCard,
}: AiSettingsTabViewProps) {
  return (
    <div className="space-y-6">
      {aiSettingsOverviewCard}

      <Card data-tutorial-anchor="settings-ai-tools">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5" />
            {t('pages.user.ai.toolsTitle')}
          </CardTitle>
          <CardDescription>{t('pages.user.ai.toolsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={toolColumns}
            data={[...ai.builtInTools]}
            getRowId={tool => tool.name}
            enablePagination={false}
          />
        </CardContent>
      </Card>

      <Card data-tutorial-anchor="settings-ai-skills">
        <CardHeader>
          <CardTitle className="text-lg">{t('pages.user.ai.skillsBuiltIn')}</CardTitle>
          <CardDescription>{t('pages.user.ai.skillsBuiltInDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={builtInSkillColumns}
            data={[...ai.builtInSkills]}
            getRowId={skill => skill.slug}
            enablePagination={false}
          />
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
          <DataTable
            columns={customSkillColumns}
            data={customSkills}
            getRowId={(skill: any) => skill.id}
            enablePagination={false}
            emptyTitle={t('pages.user.ai.customSkills')}
            emptyDescription={t('pages.user.ai.noCustomSkills')}
          />
        </CardContent>
      </Card>

      <Card data-tutorial-anchor="settings-byoc">
        <CardHeader>
          <CardTitle className="text-lg">{t('pages.user.ai.credentialsTitle')}</CardTitle>
          <CardDescription>{t('pages.user.ai.credentialsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-3">
            {(Object.keys(PROVIDER_CONFIG) as AiProvider[]).map((provider: AiProvider) => {
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

                    <PasswordField
                      id={`ai-provider-${provider}`}
                      label={t('pages.user.ai.credentials.apiKey')}
                      description={config.note}
                      autoComplete="off"
                      value={ai.providerInputs[provider]}
                      onChange={event => ai.updateProviderInput(provider, event.target.value)}
                      placeholder={t('pages.user.ai.credentials.placeholder')}
                    />

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
        <ScrollableDialogContent>
          <DialogHeader>
            <DialogTitle>{skillDialogTitle}</DialogTitle>
            <DialogDescription>{skillDialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                id="ai-skill-name"
                label={t('pages.user.ai.skills.name')}
                value={ai.skillForm.name}
                onValueChange={value => {
                  ai.touchSkillField('name');
                  ai.updateSkillForm('name', value);
                }}
                onBlur={() => ai.touchSkillField('name')}
                error={ai.visibleSkillFormErrors.name}
                description={
                  ai.visibleSkillFormErrors.name
                    ? undefined
                    : skillFieldEvaluated.name
                      ? t('common.validation.good')
                      : t('pages.user.ai.skills.requiredHint')
                }
                className={inputStateClass(
                  ai.skillForm.name,
                  ai.visibleSkillFormErrors.name,
                  skillFieldEvaluated.name
                )}
              />

              <TextField
                id="ai-skill-slug"
                label={t('pages.user.ai.skills.slug')}
                value={ai.skillForm.slug}
                onValueChange={value => {
                  ai.touchSkillField('slug');
                  ai.updateSkillForm('slug', value);
                }}
                onBlur={() => ai.touchSkillField('slug')}
                disabled={isEditingBuiltIn}
                error={ai.visibleSkillFormErrors.slug}
                description={
                  ai.visibleSkillFormErrors.slug ? undefined : t('pages.user.ai.skills.slugHint')
                }
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
            </div>

            <FormFieldShell
              id="ai-skill-aliases"
              label={t('pages.user.ai.skills.aliases')}
              error={ai.visibleSkillFormErrors.aliases}
              description={
                ai.visibleSkillFormErrors.aliases ? undefined : t('pages.user.ai.skills.aliasHint')
              }
            >
              {({ id }) => (
                <HashtagInput
                  inputId={id}
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
              )}
            </FormFieldShell>

            <TextField
              id="ai-skill-prompt"
              label={t('pages.user.ai.skills.systemPrompt')}
              value={ai.skillForm.systemPrompt}
              onValueChange={value => {
                ai.touchSkillField('systemPrompt');
                ai.updateSkillForm('systemPrompt', value);
              }}
              onBlur={() => ai.touchSkillField('systemPrompt')}
              error={ai.visibleSkillFormErrors.systemPrompt}
              description={
                ai.visibleSkillFormErrors.systemPrompt
                  ? undefined
                  : skillFieldEvaluated.systemPrompt
                    ? t('pages.user.ai.skills.promptHint')
                    : t('pages.user.ai.skills.requiredHint')
              }
              multiline
              className={`min-h-[180px] ${inputStateClass(
                ai.skillForm.systemPrompt,
                ai.visibleSkillFormErrors.systemPrompt,
                skillFieldEvaluated.systemPrompt
              )}`}
            />
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
        </ScrollableDialogContent>
      </Dialog>

      <DangerConfirmDialog
        open={Boolean(ai.pendingSkillDeletion)}
        onOpenChange={open => {
          if (!open) {
            ai.cancelDeleteSkill();
          }
        }}
        title={t('pages.user.ai.skills.deleteTitle')}
        description={t('pages.user.ai.skills.deleteDescription').replace(
          '{{name}}',
          ai.pendingSkillDeletion?.name ?? ''
        )}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.actions.delete')}
        onConfirm={ai.confirmDeleteSkill}
      />
    </div>
  );
}
