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
  FileUploadTrigger,
} from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { type ComponentType } from 'react';
import {
  AtSign,
  Bot,
  Brain,
  Check,
  LoaderCircle,
  Paperclip,
  Plus,
  Send,
  Settings2,
  Slash,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { TooltipHint } from '@/features/shared/ui/ui/tooltip';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { ChatComposer, chatComposerTextareaClassName } from './ChatComposer';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/features/shared/ui/ui/drawer';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { HashtagInput } from '@/features/shared/ui/hashtags';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/features/shared/ui/ui/command';
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
  assistantSettingsOpen: boolean;
  setAssistantSettingsOpen: (open: boolean) => void;
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
  updateTools: any;
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
  assistantSettingsOpen,
  setAssistantSettingsOpen,
  skillName,
  setSkillName,
  skillSlug,
  setSkillSlug,
  skillAliases,
  setSkillAliases,
  skillPrompt,
  setSkillPrompt,
  selectedSkillKeySet,
  selectedToolKeySet,
  searchTools,
  createTools,
  updateTools,
  attachmentTypeSuggestions,
  attachmentSuggestions,
  skillSuggestions,
  toolSuggestions,
  hasSuggestionPanel,
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
    <>
      <ChatComposer
        value={messageText}
        textareaRef={textareaRef}
        onSubmit={event => {
          event.preventDefault();
          void handleSubmit();
        }}
        minTextareaHeight={72}
      >
        <div className="space-y-2">
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
                    className="h-5 w-5 rounded-md"
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
                    className="h-5 w-5 rounded-md"
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
              className={chatComposerTextareaClassName}
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
                              <BadgeControl
                                variant="secondary"
                                size="tiny"
                                textTransform="uppercase"
                              >
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
            <div className="min-w-0 flex-[1_1_180px]">
              <div className="flex items-center gap-1">
                <FormControlSelect
                  value={assistantChat.selectedModelKey}
                  onValueChange={assistantChat.setSelectedModelKey}
                >
                  <FormControlSelectTrigger className="bg-muted/60 h-8 gap-2 rounded-md border-0 shadow-none">
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
                            <TooltipHint content={selectedModelHint.message} variant="rich">
                              <span
                                className={selectedModelHint.className}
                                aria-label={selectedModelHint.message}
                                tabIndex={0}
                              >
                                ?
                              </span>
                            </TooltipHint>
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
                        : featureThemeClassName(
                            'messageAssistantMessageInputWarningRoundIconAlpha'
                          );

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
                              <TooltipHint content={modelHint} variant="rich">
                                <span
                                  className={modelHintClass}
                                  aria-label={modelHint}
                                  tabIndex={0}
                                >
                                  ?
                                </span>
                              </TooltipHint>
                            </span>
                          </div>
                        </FormControlSelectItem>
                      );
                    })}
                  </FormControlSelectContent>
                </FormControlSelect>
              </div>
            </div>

            <div className="w-8 flex-shrink-0">
              <FormControlSelect
                value={assistantChat.reasoningEffort}
                onValueChange={value =>
                  assistantChat.setReasoningEffort(value as AiReasoningEffort)
                }
                disabled={!assistantChat.selectedModel?.supports_reasoning_effort}
              >
                <TooltipHint content={t('features.messages.ai.reasoning')}>
                  <span
                    className="inline-flex"
                    tabIndex={assistantChat.selectedModel?.supports_reasoning_effort ? -1 : 0}
                  >
                    <FormControlSelectTrigger
                      className="hover:bg-muted/60 h-8 w-8 justify-center rounded-md border-0 bg-transparent px-0 shadow-none [&>svg:last-child]:hidden"
                      aria-label={t('features.messages.ai.reasoning')}
                    >
                      {(() => {
                        const selectedOption =
                          REASONING_OPTIONS.find(
                            option => option.value === assistantChat.reasoningEffort
                          ) ?? REASONING_OPTIONS[1];
                        return (
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-md ${selectedOption.gradientClass}`}
                          >
                            <selectedOption.Icon className="h-3 w-3 flex-shrink-0" />
                          </div>
                        );
                      })()}
                    </FormControlSelectTrigger>
                  </span>
                </TooltipHint>
                <FormControlSelectContent>
                  <div className="px-3 py-2">
                    <div
                      className={featureThemeClassName('messageAssistantMessageInputNeutralText')}
                    >
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
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${option.gradientClass}`}
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

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="hidden h-8 px-2 sm:inline-flex"
                >
                  <Settings2 className="mr-1 h-3.5 w-3.5" />
                  {t('features.messages.ai.settings')}
                  <BadgeControl variant="outline" size="tiny" className="ml-1">
                    {assistantChat.selectedTools.length}
                  </BadgeControl>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0">
                <Command>
                  <CommandInput placeholder={t('features.messages.ai.searchSettings')} />
                  <CommandList className="max-h-[60vh]">
                    <CommandEmpty>{t('features.messages.ai.noSettingsFound')}</CommandEmpty>
                    <CommandGroup heading={t('features.messages.ai.searchToolGroup')}>
                      {searchTools.map((tool: any) => {
                        const selected = selectedToolKeySet.has(tool.name);
                        return (
                          <CommandItem
                            key={tool.name}
                            value={`${tool.label} ${tool.name} ${tool.description}`}
                            onSelect={() => assistantChat.setToolSelection(tool.name, !selected)}
                          >
                            <Check className={selected ? 'opacity-100' : 'opacity-0'} />
                            <span className="min-w-0 flex-1 truncate">{tool.label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                    <CommandGroup heading={t('features.messages.ai.createToolGroup')}>
                      {createTools.map((tool: any) => {
                        const selected = selectedToolKeySet.has(tool.name);
                        return (
                          <CommandItem
                            key={tool.name}
                            value={`${tool.label} ${tool.name} ${tool.description}`}
                            onSelect={() => assistantChat.setToolSelection(tool.name, !selected)}
                          >
                            <Check className={selected ? 'opacity-100' : 'opacity-0'} />
                            <span className="min-w-0 flex-1 truncate">{tool.label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                    <CommandGroup heading={t('features.messages.ai.updateToolGroup')}>
                      {updateTools.map((tool: any) => {
                        const selected = selectedToolKeySet.has(tool.name);
                        return (
                          <CommandItem
                            key={tool.name}
                            value={`${tool.label} ${tool.name} ${tool.description}`}
                            onSelect={() => assistantChat.setToolSelection(tool.name, !selected)}
                          >
                            <Check className={selected ? 'opacity-100' : 'opacity-0'} />
                            <span className="min-w-0 flex-1 truncate">{tool.label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup heading={t('features.messages.ai.skillSelector')}>
                      {assistantChat.availableSkills.map((skill: any) => {
                        const selected = selectedSkillKeySet.has(skill.slug);
                        return (
                          <CommandItem
                            key={skill.slug}
                            value={`${skill.name} ${skill.slug} ${skill.aliases.join(' ')}`}
                            onSelect={() => assistantChat.setSkillSelection(skill.slug, !selected)}
                          >
                            <Check className={selected ? 'opacity-100' : 'opacity-0'} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{skill.name}</span>
                              <span className="text-muted-foreground block truncate text-xs">
                                /{skill.slug}
                              </span>
                            </span>
                          </CommandItem>
                        );
                      })}
                      <CommandItem value="create-skill" onSelect={() => setCreateSkillOpen(true)}>
                        <Plus />
                        {t('features.messages.ai.createSkill')}
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md sm:hidden"
              onClick={() => setAssistantSettingsOpen(true)}
              title={t('features.messages.ai.settings')}
            >
              <Settings2 className="h-4 w-4" />
            </Button>

            <FileUploadTrigger
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md"
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
              size="icon"
              className="ml-auto h-8 w-8 rounded-md"
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
        </div>
      </ChatComposer>

      <Drawer open={assistantSettingsOpen} onOpenChange={setAssistantSettingsOpen}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle>{t('features.messages.ai.settings')}</DrawerTitle>
            <DrawerDescription>
              {t('features.messages.ai.toolSelectorDescription')}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-5 overflow-y-auto px-4 pb-6">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t('features.messages.ai.toolSelector')}</h3>
              {[searchTools, createTools, updateTools].map((tools, index) => (
                <div key={index} className="space-y-1">
                  <h4 className="text-muted-foreground px-2 text-xs font-medium">
                    {index === 0
                      ? t('features.messages.ai.searchToolGroup')
                      : index === 1
                        ? t('features.messages.ai.createToolGroup')
                        : t('features.messages.ai.updateToolGroup')}
                  </h4>
                  <div className="grid gap-1">
                    {tools.map((tool: any) => {
                      const selected = selectedToolKeySet.has(tool.name);
                      return (
                        <Button
                          key={tool.name}
                          type="button"
                          variant="ghost"
                          className="h-auto justify-start gap-3 px-2 py-2 text-left"
                          onClick={() => assistantChat.setToolSelection(tool.name, !selected)}
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded border">
                            {selected ? <Check className="h-3.5 w-3.5" /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{tool.label}</span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {tool.description}
                            </span>
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t('features.messages.ai.skillSelector')}</h3>
              <div className="grid gap-1">
                {assistantChat.availableSkills.map((skill: any) => {
                  const selected = selectedSkillKeySet.has(skill.slug);
                  return (
                    <Button
                      key={skill.slug}
                      type="button"
                      variant="ghost"
                      className="h-auto justify-start gap-3 px-2 py-2 text-left"
                      onClick={() => assistantChat.setSkillSelection(skill.slug, !selected)}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded border">
                        {selected ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{skill.name}</span>
                        <span className="text-muted-foreground block text-xs">/{skill.slug}</span>
                      </span>
                    </Button>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setAssistantSettingsOpen(false);
                  setCreateSkillOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('features.messages.ai.createSkill')}
              </Button>
            </section>
          </div>
        </DrawerContent>
      </Drawer>

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
    </>
  );
}
