'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import {
  FormControlInput,
  FormControlLabel,
  FormControlTextarea,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
  FileUploadTrigger,
} from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { type ComponentType } from 'react';
import {
  AtSign,
  Bot,
  Brain,
  LoaderCircle,
  Paperclip,
  Plus,
  Send,
  Slash,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { HashtagInput } from '@/features/shared/ui/hashtags';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';
import type { AiReasoningEffort } from '@/lib/ai/schemas';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { slugifySkillName } from '../logic/assistantComposer';
import { MESSAGE_ATTACHMENT_ACCEPT } from '../logic/uploadAttachmentCard';
const REASONING_OPTIONS: readonly {
  value: AiReasoningEffort;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  gradientClass: string;
}[] = [
  {
    value: 'low',
    label: translateText('generated.inline.0183_low_a124947c'),
    Icon: Sparkles,
    gradientClass: featureThemeClassName('messageAssistantMessageInputNeutralGradientSurface'),
  },
  {
    value: 'medium',
    label: translateText('generated.inline.0184_medium_d404968e'),
    Icon: Zap,
    gradientClass: featureThemeClassName('messageAssistantMessageInputWarningGradientSurface'),
  },
  {
    value: 'high',
    label: translateText('generated.inline.0185_high_b1a5954a'),
    Icon: Brain,
    gradientClass: featureThemeClassName('messageAssistantMessageInputAccentGradientSurface'),
  },
] as const;
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

function parseAliases(value: string): string[] {
  return value
    .split(',')
    .map((alias: any) => alias.trim())
    .filter(Boolean);
}

function buildModelKey(model: { provider: string; id: string }): string {
  return `${model.provider}:${model.id}`;
}
export interface AssistantMessageInputViewProps {
  assistantChat: any;
  t: any;
  textareaRef: any;
  messageText: any;
  setMessageText: any;
  caretPosition: any;
  setCaretPosition: any;
  suggestionAnchorPosition: any;
  setSuggestionAnchorPosition: any;
  textareaScrollVersion: any;
  setTextareaScrollVersion: any;
  createSkillOpen: any;
  setCreateSkillOpen: any;
  skillName: any;
  setSkillName: any;
  skillSlug: any;
  setSkillSlug: any;
  skillAliases: any;
  setSkillAliases: any;
  skillPrompt: any;
  setSkillPrompt: any;
  selectedSkillKeySet: any;
  selectedToolKeySet: any;
  searchTools: any;
  createTools: any;
  mentionQuery: any;
  skillCommand: any;
  toolCommand: any;
  selectedAttachmentKeys: any;
  attachmentTypeSuggestions: any;
  attachmentSuggestions: any;
  skillSuggestions: any;
  toolSuggestions: any;
  hasSuggestionPanel: any;
  suggestionAnchorIndex: any;
  visibleSelectedTools: any;
  hiddenSelectedToolCount: any;
  getToolGroupCheckedState: any;
  renderToolGroup: any;
  freeRouterLabel: any;
  freeRouterMessage: any;
  reliabilityMessage: any;
  freeRouterModelKey: any;
  getModelDisplayLabel: any;
  selectedModelHint: any;
  updateCaretPosition: any;
  moveCaret: any;
  applyMessageReplacement: any;
  handleAttachmentTypeSelect: any;
  handleAttachmentSelect: any;
  handleSkillSelect: any;
  handleToolSelect: any;
  resetSkillForm: any;
  handleCreateSkill: any;
  handleSubmit: any;
}

export function AssistantMessageInputView({
  assistantChat,
  t,
  textareaRef,
  messageText,
  setMessageText,
  setCaretPosition,
  suggestionAnchorPosition,
  setTextareaScrollVersion,
  createSkillOpen,
  setCreateSkillOpen,
  skillName,
  setSkillName,
  skillSlug,
  setSkillSlug,
  skillAliases,
  setSkillAliases,
  skillPrompt,
  setSkillPrompt,
  selectedSkillKeySet,
  searchTools,
  createTools,
  attachmentTypeSuggestions,
  attachmentSuggestions,
  skillSuggestions,
  toolSuggestions,
  hasSuggestionPanel,
  visibleSelectedTools,
  hiddenSelectedToolCount,
  renderToolGroup,
  freeRouterMessage,
  reliabilityMessage,
  freeRouterModelKey,
  getModelDisplayLabel,
  selectedModelHint,
  updateCaretPosition,
  handleAttachmentTypeSelect,
  handleAttachmentSelect,
  handleSkillSelect,
  handleToolSelect,
  handleCreateSkill,
  handleSubmit,
}: AssistantMessageInputViewProps) {
  return (
    <CardContent separator className="flex-shrink-0 p-4" data-swipe-lock>
      <div className="space-y-3">
        {assistantChat.selectedTools.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {visibleSelectedTools.map((tool: any) => (
              <BadgeControl key={tool.name} variant="secondary" size="xs" className="gap-1 pr-1">
                <Wrench className="h-3 w-3" />
                {tool.label}
                <span className="text-muted-foreground">{tool.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full"
                  onClick={() => assistantChat.setToolSelection(tool.name, false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </BadgeControl>
            ))}
            {hiddenSelectedToolCount > 0 && (
              <BadgeControl variant="outline" size="xs" className="gap-1">
                <Wrench className="h-3 w-3" />+{hiddenSelectedToolCount}{' '}
                {t('features.messages.ai.moreTools')}
              </BadgeControl>
            )}
          </div>
        )}

        {assistantChat.selectedSkills.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {assistantChat.selectedSkills.map((skill: any) => (
              <BadgeControl key={skill.slug} variant="secondary" size="xs" className="gap-1 pr-1">
                <Sparkles className="h-3 w-3" />
                {skill.name}
                <span className="text-muted-foreground">/{skill.slug}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full"
                  onClick={() => assistantChat.setSkillSelection(skill.slug, false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </BadgeControl>
            ))}
          </div>
        )}

        {assistantChat.selectedAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {assistantChat.selectedAttachments.map((attachment: any) => (
              <BadgeControl
                key={`${attachment.entityType}:${attachment.entityId}`}
                variant="outline"
                className="gap-1 pr-1 text-xs"
              >
                <AtSign className="h-3 w-3" />
                {attachment.title}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full"
                  onClick={() =>
                    assistantChat.removeAttachment(attachment.entityType, attachment.entityId)
                  }
                >
                  <X className="h-3 w-3" />
                </Button>
              </BadgeControl>
            ))}
          </div>
        )}

        {assistantChat.isUploadingAttachments && assistantChat.uploadingAttachmentName && (
          <BadgeControl variant="secondary" size="xs" className="gap-1">
            <LoaderCircle className="h-3 w-3 animate-spin" />
            {t('features.messages.compose.uploading')}:{assistantChat.uploadingAttachmentName}
          </BadgeControl>
        )}

        <div className="relative">
          <FormControlTextarea
            ref={textareaRef}
            placeholder={t('features.messages.ai.placeholder')}
            value={messageText}
            onChange={event => {
              setMessageText(event.target.value);
              setCaretPosition(event.target.selectionStart ?? event.target.value.length);
            }}
            onClick={updateCaretPosition}
            onKeyUp={updateCaretPosition}
            onSelect={updateCaretPosition}
            onScroll={() => setTextareaScrollVersion((currentValue: any) => currentValue + 1)}
            className="min-h-[110px] resize-y"
            onKeyDown={async event => {
              if (event.key === 'Escape') {
                setCaretPosition(textareaRef.current?.selectionStart ?? 0);
                return;
              }

              if (event.key !== 'Enter' || event.shiftKey) {
                return;
              }

              event.preventDefault();

              if (skillSuggestions.length > 0) {
                handleSkillSelect(skillSuggestions[0].slug);
                return;
              }

              if (toolSuggestions.length > 0) {
                handleToolSelect(toolSuggestions[0].name);
                return;
              }

              if (attachmentSuggestions.length > 0) {
                handleAttachmentSelect(attachmentSuggestions[0]);
                return;
              }

              if (attachmentTypeSuggestions.length > 0) {
                handleAttachmentTypeSelect(attachmentTypeSuggestions[0].entityType);
                return;
              }

              await handleSubmit();
            }}
          />

          {hasSuggestionPanel && suggestionAnchorPosition && (
            <Card
              className="absolute z-30 border shadow-lg"
              style={{
                left: suggestionAnchorPosition.left,
                top: suggestionAnchorPosition.top,
                width: suggestionAnchorPosition.width,
                transform: 'translateY(calc(-100% - 8px))',
              }}
            >
              <CardContent className="p-2">
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {toolSuggestions.length > 0 && (
                    <>
                      <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                        {t('features.messages.ai.tools')}
                      </p>
                      {toolSuggestions.map((tool: any) => (
                        <Button
                          key={tool.name}
                          type="button"
                          variant="ghost"
                          onClick={() => handleToolSelect(tool.name)}
                          className="h-auto w-full items-start justify-start gap-3 px-2 py-2 text-left whitespace-normal"
                        >
                          <Wrench className="text-muted-foreground mt-0.5 h-4 w-4" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{tool.label}</span>
                            <span className="text-muted-foreground block text-xs">
                              #{tool.name}
                            </span>
                            <span className="text-muted-foreground block text-xs">
                              {tool.description}
                            </span>
                          </span>
                          <BadgeControl variant="outline" size="tiny" textTransform="uppercase">
                            {tool.kind}
                          </BadgeControl>
                        </Button>
                      ))}
                    </>
                  )}

                  {skillSuggestions.length > 0 && (
                    <>
                      <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                        {t('features.messages.ai.skills')}
                      </p>
                      {skillSuggestions.map((skill: any) => (
                        <Button
                          key={skill.slug}
                          type="button"
                          variant="ghost"
                          onClick={() => handleSkillSelect(skill.slug)}
                          className="h-auto w-full items-start justify-start gap-3 px-2 py-2 text-left whitespace-normal"
                        >
                          <Slash className="text-muted-foreground mt-0.5 h-4 w-4" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{skill.name}</span>
                            <span className="text-muted-foreground block text-xs">
                              /{skill.slug}
                            </span>
                          </span>
                          {skill.isBuiltIn && (
                            <BadgeControl variant="secondary" size="tiny" textTransform="uppercase">
                              {translateText('generated.inline.0751_built_in_20f409cc')}
                            </BadgeControl>
                          )}
                        </Button>
                      ))}
                    </>
                  )}

                  {attachmentTypeSuggestions.length > 0 && (
                    <>
                      <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                        {t('features.messages.ai.attachTypes')}
                      </p>
                      {attachmentTypeSuggestions.map((option: any) => (
                        <Button
                          key={option.entityType}
                          type="button"
                          variant="ghost"
                          onClick={() => handleAttachmentTypeSelect(option.entityType)}
                          className="h-auto w-full justify-start gap-3 px-2 py-2 text-left whitespace-normal"
                        >
                          <AtSign className="text-muted-foreground h-4 w-4" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{option.label}</span>
                            <span className="text-muted-foreground block text-xs">
                              {option.token}
                            </span>
                          </span>
                        </Button>
                      ))}
                    </>
                  )}

                  {attachmentSuggestions.length > 0 && (
                    <>
                      <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                        {t('features.messages.ai.attachments')}
                      </p>
                      {attachmentSuggestions.map((option: any) => (
                        <Button
                          key={option.key}
                          type="button"
                          variant="ghost"
                          onClick={() => handleAttachmentSelect(option)}
                          className="h-auto w-full items-start justify-start gap-3 px-2 py-2 text-left whitespace-normal"
                        >
                          <Bot className="text-muted-foreground mt-0.5 h-4 w-4" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {option.label}
                            </span>
                            {option.subtitle && (
                              <span className="text-muted-foreground block truncate text-xs">
                                {option.subtitle}
                              </span>
                            )}
                          </span>
                          <BadgeControl variant="outline" size="tiny" textTransform="uppercase">
                            {option.entityType}
                          </BadgeControl>
                        </Button>
                      ))}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[240px] flex-1">
            <div className="flex items-center gap-1">
              <FormControlSelect
                value={assistantChat.selectedModelKey}
                onValueChange={assistantChat.setSelectedModelKey}
              >
                <FormControlSelectTrigger className="h-8 gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                    <span
                      className={`min-w-0 flex-1 truncate text-left ${assistantChat.selectedModel ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      {assistantChat.selectedModel
                        ? getModelDisplayLabel(assistantChat.selectedModel)
                        : t('features.messages.ai.modelPlaceholder')}
                    </span>
                    {assistantChat.selectedModel && (
                      <span className="flex flex-shrink-0 items-center gap-1.5">
                        {assistantChat.selectedModel.free && (
                          <BadgeControl tone="gradientSuccess" size="tiny">
                            {translateText('generated.inline.0752_free_75f52718')}
                          </BadgeControl>
                        )}
                        {assistantChat.selectedModel.source === 'byok' && (
                          <BadgeControl tone="gradientNeutral" size="tiny">
                            {translateText('generated.inline.0113_byok_36068183')}
                          </BadgeControl>
                        )}
                        <BadgeControl tone="gradientInfo" size="tiny">
                          {translateText('generated.inline.0114_ctx_4024700f')}
                          {formatContextWindow(assistantChat.selectedModel.context_window)}
                        </BadgeControl>
                        {selectedModelHint && (
                          <span
                            className={selectedModelHint.className}
                            title={selectedModelHint.message}
                            aria-label={selectedModelHint.message}
                          >
                            ?
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </FormControlSelectTrigger>
                <FormControlSelectContent>
                  {assistantChat.models.map((model: any) => {
                    const modelKey = buildModelKey(model);
                    const isFreeRouterModel = freeRouterModelKey === modelKey;
                    const displayLabel = getModelDisplayLabel(model);
                    const modelHint = isFreeRouterModel ? freeRouterMessage : reliabilityMessage;
                    const modelHintClass = isFreeRouterModel
                      ? featureThemeClassName('messageAssistantMessageInputSuccessRoundIconAlpha')
                      : featureThemeClassName('messageAssistantMessageInputWarningRoundIconAlpha');

                    return (
                      <FormControlSelectItem
                        key={modelKey}
                        value={modelKey}
                        textValue={displayLabel}
                        className="py-2"
                      >
                        <div className="flex w-full min-w-0 items-center justify-between gap-2">
                          <span className="truncate font-medium">{displayLabel}</span>
                          <span className="flex flex-shrink-0 items-center gap-1.5">
                            {model.free && (
                              <BadgeControl tone="gradientSuccess" size="tiny">
                                {translateText('generated.inline.0752_free_75f52718')}
                              </BadgeControl>
                            )}
                            {model.source === 'byok' && (
                              <BadgeControl tone="gradientNeutral" size="tiny">
                                {translateText('generated.inline.0113_byok_36068183')}
                              </BadgeControl>
                            )}
                            <BadgeControl tone="gradientInfo" size="tiny">
                              {translateText('generated.inline.0114_ctx_4024700f')}
                              {formatContextWindow(model.context_window)}
                            </BadgeControl>
                            <span
                              className={modelHintClass}
                              title={modelHint}
                              aria-label={modelHint}
                            >
                              ?
                            </span>
                          </span>
                        </div>
                      </FormControlSelectItem>
                    );
                  })}
                </FormControlSelectContent>
              </FormControlSelect>
            </div>
          </div>

          <div className="w-[120px]">
            <FormControlSelect
              value={assistantChat.reasoningEffort}
              onValueChange={value => assistantChat.setReasoningEffort(value as AiReasoningEffort)}
              disabled={!assistantChat.selectedModel?.supports_reasoning_effort}
            >
              <FormControlSelectTrigger className="h-8">
                <FormControlSelectValue placeholder={t('features.messages.ai.reasoning')} />
              </FormControlSelectTrigger>
              <FormControlSelectContent>
                <div className="px-3 py-2">
                  <div className={featureThemeClassName('messageAssistantMessageInputNeutralText')}>
                    {t('features.messages.ai.reasoningDropdownTitle')}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t('features.messages.ai.reasoningDropdownDescription')}
                  </div>
                </div>
                <div
                  className={featureThemeClassName('messageAssistantMessageInputNeutralBorder')}
                />
                {REASONING_OPTIONS.map((option: any) => (
                  <FormControlSelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${option.gradientClass}`}
                      >
                        <option.Icon className="h-3 w-3" />
                      </span>
                      <span className="text-sm font-medium">{option.label}</span>
                    </div>
                  </FormControlSelectItem>
                ))}
              </FormControlSelectContent>
            </FormControlSelect>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 px-2">
                <Wrench className="mr-1 h-3.5 w-3.5" />
                {t('features.messages.ai.toolSelector')}
                {assistantChat.selectedTools.length > 0
                  ? ` (${assistantChat.selectedTools.length})`
                  : ''}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96">
              <DropdownMenuLabel>
                {t('features.messages.ai.toolSelectorDescription')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {assistantChat.availableTools.length > 0 ? (
                <>
                  {renderToolGroup(
                    t('features.messages.ai.searchToolGroup'),
                    'search',
                    searchTools
                  )}
                  {searchTools.length > 0 && createTools.length > 0 && <DropdownMenuSeparator />}
                  {renderToolGroup(
                    t('features.messages.ai.createToolGroup'),
                    'create',
                    createTools
                  )}
                </>
              ) : (
                <div className="text-muted-foreground px-2 py-2 text-sm">
                  {t('features.messages.ai.noToolsAvailable')}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 px-2">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                {t('features.messages.ai.skillSelector')}
                {assistantChat.selectedSkills.length > 0
                  ? ` (${assistantChat.selectedSkills.length})`
                  : ''}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>
                {t('features.messages.ai.skillSelectorDescription')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {assistantChat.availableSkills.length > 0 ? (
                assistantChat.availableSkills.map((skill: any) => (
                  <DropdownMenuCheckboxItem
                    key={skill.slug}
                    checked={selectedSkillKeySet.has(skill.slug)}
                    onCheckedChange={checked =>
                      assistantChat.setSkillSelection(skill.slug, checked === true)
                    }
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{skill.name}</div>
                      <div className="text-muted-foreground truncate text-xs">/{skill.slug}</div>
                    </div>
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <div className="text-muted-foreground px-2 py-2 text-sm">
                  {t('features.messages.ai.noSkillsAvailable')}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <FileUploadTrigger
            variant="outline"
            size="icon"
            disabled={assistantChat.isUploadingAttachments}
            title={t('features.messages.compose.uploadFiles')}
            aria-label={t('features.messages.compose.uploadFiles')}
            inputProps={{
              multiple: true,
              accept: MESSAGE_ATTACHMENT_ACCEPT,
            }}
            onFilesSelected={files => {
              void assistantChat.addUploadedFiles(Array.from(files));
            }}
          >
            {assistantChat.isUploadingAttachments ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </FileUploadTrigger>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateSkillOpen(true)}
            className="h-8 px-2"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('features.messages.ai.createSkill')}
          </Button>

          <Button
            type="button"
            size="icon"
            className="sm:ml-auto"
            disabled={
              !messageText.trim() ||
              assistantChat.isSending ||
              assistantChat.isUploadingAttachments ||
              !assistantChat.selectedModel
            }
            title={t('common.send')}
            aria-label={t('common.send')}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {assistantChat.isSending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            {assistantChat.isCatalogLoading
              ? t('features.messages.ai.loadingModels')
              : assistantChat.models.length > 0
                ? t('features.messages.ai.helperText')
                : t('features.messages.ai.noModels')}
          </p>
          <p className="flex items-center gap-1.5">
            {assistantChat.isThinking ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {t('features.messages.ai.disclaimer')}
          </p>
        </div>
      </div>

      <Dialog open={createSkillOpen} onOpenChange={setCreateSkillOpen}>
        <ScrollableDialogContent>
          <DialogHeader>
            <DialogTitle>{t('features.messages.ai.createSkill')}</DialogTitle>
            <DialogDescription>
              {t('features.messages.ai.createSkillDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <FormControlLabel>{t('pages.user.ai.skills.name')}</FormControlLabel>
              <FormControlInput
                value={skillName}
                onChange={event => setSkillName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <FormControlLabel>{t('pages.user.ai.skills.slug')}</FormControlLabel>
              <FormControlInput
                value={skillSlug}
                onChange={event => setSkillSlug(event.target.value)}
                placeholder={slugifySkillName(skillName) || 'campaign-planner'}
              />
            </div>

            <div className="space-y-2">
              <FormControlLabel>{t('pages.user.ai.skills.aliases')}</FormControlLabel>
              <HashtagInput
                value={parseAliases(skillAliases)}
                onChange={aliases => setSkillAliases(aliases.join(','))}
                showLabel={false}
                placeholder={t('pages.user.ai.skills.aliasesPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <FormControlLabel>{t('pages.user.ai.skills.systemPrompt')}</FormControlLabel>
              <FormControlTextarea
                value={skillPrompt}
                onChange={event => setSkillPrompt(event.target.value)}
                className="min-h-[160px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateSkillOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleCreateSkill}>
              {t('common.create')}
            </Button>
          </DialogFooter>
        </ScrollableDialogContent>
      </Dialog>
    </CardContent>
  );
}
