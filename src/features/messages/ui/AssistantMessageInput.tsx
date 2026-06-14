'use client';

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
} from 'react';
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
import { toast } from 'sonner';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { HashtagInput } from '@/features/shared/ui/ui/hashtag-input';
import { Input } from '@/features/shared/ui/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import type { AiReasoningEffort } from '@/lib/ai/schemas';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import {
  ASSISTANT_ATTACHMENT_TYPE_OPTIONS,
  getSuggestionAnchorPosition,
  parseActiveMentionQuery,
  parseActiveSkillCommand,
  parseActiveToolCommand,
  replaceTextRange,
  slugifySkillName,
  type SuggestionAnchorPosition,
} from '../logic/assistantComposer';
import type { useAssistantChat } from '../hooks/useAssistantChat';
import { MESSAGE_ATTACHMENT_ACCEPT } from '../logic/uploadAttachmentCard';

interface AssistantMessageInputProps {
  assistantChat: ReturnType<typeof useAssistantChat>;
}

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
    gradientClass:
      'bg-gradient-to-br from-slate-200/80 via-slate-200/60 to-slate-100/40 text-slate-700 dark:bg-slate-700/20 dark:text-slate-200',
  },
  {
    value: 'medium',
    label: translateText('generated.inline.0184_medium_d404968e'),
    Icon: Zap,
    gradientClass:
      'bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-yellow-400/20 text-amber-700 dark:text-amber-200',
  },
  {
    value: 'high',
    label: translateText('generated.inline.0185_high_b1a5954a'),
    Icon: Brain,
    gradientClass:
      'bg-gradient-to-br from-fuchsia-500/20 via-purple-500/20 to-indigo-500/20 text-fuchsia-700 dark:text-fuchsia-200',
  },
] as const;

const MAX_VISIBLE_TOOL_BADGES = 4;

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
    .map(alias => alias.trim())
    .filter(Boolean);
}

function buildModelKey(model: { provider: string; id: string }): string {
  return `${model.provider}:${model.id}`;
}

export function AssistantMessageInput({ assistantChat }: AssistantMessageInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messageText, setMessageText] = useState('');
  const [caretPosition, setCaretPosition] = useState(0);
  const [suggestionAnchorPosition, setSuggestionAnchorPosition] =
    useState<SuggestionAnchorPosition | null>(null);
  const [textareaScrollVersion, setTextareaScrollVersion] = useState(0);
  const [createSkillOpen, setCreateSkillOpen] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillSlug, setSkillSlug] = useState('');
  const [skillAliases, setSkillAliases] = useState('');
  const [skillPrompt, setSkillPrompt] = useState('');

  const selectedSkillKeySet = useMemo(
    () => new Set(assistantChat.selectedSkillSlugs),
    [assistantChat.selectedSkillSlugs]
  );

  const selectedToolKeySet = useMemo(
    () => new Set(assistantChat.selectedToolNames),
    [assistantChat.selectedToolNames]
  );

  const searchTools = useMemo(
    () => assistantChat.availableTools.filter(tool => tool.kind === 'search'),
    [assistantChat.availableTools]
  );

  const createTools = useMemo(
    () => assistantChat.availableTools.filter(tool => tool.kind === 'create'),
    [assistantChat.availableTools]
  );

  const mentionQuery = useMemo(
    () => parseActiveMentionQuery(messageText, caretPosition),
    [messageText, caretPosition]
  );

  const skillCommand = useMemo(
    () => parseActiveSkillCommand(messageText, caretPosition),
    [messageText, caretPosition]
  );

  const toolCommand = useMemo(
    () => parseActiveToolCommand(messageText, caretPosition),
    [messageText, caretPosition]
  );

  const selectedAttachmentKeys = useMemo(
    () =>
      new Set(
        assistantChat.selectedAttachments.map(
          attachment => `${attachment.entityType}:${attachment.entityId}`
        )
      ),
    [assistantChat.selectedAttachments]
  );

  const attachmentTypeSuggestions = useMemo(() => {
    if (!mentionQuery) {
      return [];
    }

    const typedType = mentionQuery.raw.slice(1).split('@')[0].trim().toLowerCase();

    return ASSISTANT_ATTACHMENT_TYPE_OPTIONS.filter(
      option =>
        !mentionQuery.entityType &&
        (typedType.length === 0 ||
          option.entityType.includes(typedType) ||
          option.label.toLowerCase().includes(typedType))
    );
  }, [mentionQuery]);

  const attachmentSuggestions = useMemo(() => {
    if (!mentionQuery) {
      return [];
    }

    return assistantChat.attachmentOptions
      .filter(option => {
        if (selectedAttachmentKeys.has(option.key)) {
          return false;
        }

        if (mentionQuery.entityType && option.entityType !== mentionQuery.entityType) {
          return false;
        }

        if (!mentionQuery.searchText) {
          return Boolean(mentionQuery.entityType);
        }

        return option.searchText.includes(mentionQuery.searchText);
      })
      .slice(0, 8);
  }, [assistantChat.attachmentOptions, mentionQuery, selectedAttachmentKeys]);

  const skillSuggestions = useMemo(() => {
    if (!skillCommand) {
      return [];
    }

    return assistantChat.availableSkills
      .filter(skill => {
        if (!skillCommand.searchText) {
          return true;
        }

        return [skill.name, skill.slug, ...skill.aliases]
          .join(' ')
          .toLowerCase()
          .includes(skillCommand.searchText);
      })
      .slice(0, 8);
  }, [assistantChat.availableSkills, skillCommand]);

  const toolSuggestions = useMemo(() => {
    if (!toolCommand) {
      return [];
    }

    return assistantChat.availableTools
      .filter(tool => {
        if (selectedToolKeySet.has(tool.name)) {
          return false;
        }

        if (!toolCommand.searchText) {
          return true;
        }

        return [tool.label, tool.name, tool.description]
          .join(' ')
          .toLowerCase()
          .includes(toolCommand.searchText);
      })
      .slice(0, 8);
  }, [assistantChat.availableTools, selectedToolKeySet, toolCommand]);

  const hasSuggestionPanel =
    toolSuggestions.length > 0 ||
    skillSuggestions.length > 0 ||
    attachmentSuggestions.length > 0 ||
    attachmentTypeSuggestions.length > 0;

  const suggestionAnchorIndex =
    mentionQuery?.start ?? skillCommand?.start ?? toolCommand?.start ?? null;

  const visibleSelectedTools = assistantChat.selectedTools.slice(0, MAX_VISIBLE_TOOL_BADGES);
  const hiddenSelectedToolCount = Math.max(
    assistantChat.selectedTools.length - visibleSelectedTools.length,
    0
  );

  const getToolGroupCheckedState = (
    tools: readonly (typeof assistantChat.availableTools)[number][]
  ) => {
    if (tools.length === 0) {
      return false;
    }

    const selectedCount = tools.filter(tool => selectedToolKeySet.has(tool.name)).length;
    if (selectedCount === 0) {
      return false;
    }

    if (selectedCount === tools.length) {
      return true;
    }

    return 'indeterminate' as const;
  };

  const renderToolGroup = (
    label: string,
    kind: 'search' | 'create',
    tools: readonly (typeof assistantChat.availableTools)[number][]
  ) => {
    if (tools.length === 0) {
      return null;
    }

    const checkedState = getToolGroupCheckedState(tools);

    return (
      <div className="space-y-1" key={kind}>
        <div className="text-muted-foreground px-2 pt-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </div>
        <DropdownMenuCheckboxItem
          checked={checkedState}
          onSelect={event => event.preventDefault()}
          onCheckedChange={checked => assistantChat.setToolGroupSelection(kind, checked === true)}
        >
          <div className="flex w-full min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {kind === 'search'
                  ? t('features.messages.ai.allSearchTools')
                  : t('features.messages.ai.allCreateTools')}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                {kind === 'search'
                  ? t('features.messages.ai.searchToolsDescription')
                  : t('features.messages.ai.createToolsDescription')}
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase">
              {tools.length}
            </Badge>
          </div>
        </DropdownMenuCheckboxItem>
        {tools.map(tool => (
          <DropdownMenuCheckboxItem
            key={tool.name}
            checked={selectedToolKeySet.has(tool.name)}
            onSelect={event => event.preventDefault()}
            onCheckedChange={checked => assistantChat.setToolSelection(tool.name, checked === true)}
            className="pl-8"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{tool.label}</div>
              <div className="text-muted-foreground truncate text-xs">
                {tool.name} · {tool.description}
              </div>
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </div>
    );
  };

  const freeRouterLabel = t('features.messages.ai.freeRouterModel');
  const freeRouterMessage = t('features.messages.ai.modelReliability.freeRouter');
  const reliabilityMessage = t('features.messages.ai.modelReliability.warning');

  const freeRouterModelKey = useMemo(() => {
    const labeledModel = assistantChat.models.find(
      candidate => candidate.label.trim().toLowerCase() === freeRouterLabel.trim().toLowerCase()
    );

    if (labeledModel) {
      return buildModelKey(labeledModel);
    }

    const fallbackModel = assistantChat.models.find(
      candidate =>
        candidate.provider === 'openrouter' && candidate.source === 'app' && candidate.free
    );

    return fallbackModel ? buildModelKey(fallbackModel) : null;
  }, [assistantChat.models, freeRouterLabel]);

  const getModelDisplayLabel = (model: (typeof assistantChat.models)[number]) => {
    const modelKey = `${model.provider}:${model.id}`;
    if (freeRouterModelKey && modelKey === freeRouterModelKey) {
      return freeRouterLabel;
    }

    return model.label;
  };

  const selectedModelHint = useMemo(() => {
    if (!assistantChat.selectedModel) {
      return null;
    }

    const isFreeRouterModel = buildModelKey(assistantChat.selectedModel) === freeRouterModelKey;

    return {
      className: isFreeRouterModel
        ? 'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold leading-none text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
        : 'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold leading-none text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
      message: isFreeRouterModel ? freeRouterMessage : reliabilityMessage,
    };
  }, [assistantChat.selectedModel, freeRouterModelKey, freeRouterMessage, reliabilityMessage]);

  useLayoutEffect(() => {
    if (!hasSuggestionPanel || suggestionAnchorIndex === null || !textareaRef.current) {
      setSuggestionAnchorPosition(null);
      return;
    }

    const updateSuggestionAnchor = () => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setSuggestionAnchorPosition(null);
        return;
      }

      setSuggestionAnchorPosition(
        getSuggestionAnchorPosition(textarea, messageText, suggestionAnchorIndex)
      );
    };

    updateSuggestionAnchor();
    window.addEventListener('resize', updateSuggestionAnchor);

    return () => {
      window.removeEventListener('resize', updateSuggestionAnchor);
    };
  }, [hasSuggestionPanel, messageText, suggestionAnchorIndex, textareaScrollVersion]);

  const updateCaretPosition = () => {
    const nextCaretPosition = textareaRef.current?.selectionStart ?? 0;
    setCaretPosition(nextCaretPosition);
  };

  const moveCaret = (nextPosition: number) => {
    requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }

      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextPosition, nextPosition);
      setCaretPosition(nextPosition);
    });
  };

  const applyMessageReplacement = (
    start: number,
    end: number,
    nextValue: string,
    nextCaret: number
  ) => {
    setMessageText(currentValue => replaceTextRange(currentValue, start, end, nextValue));
    moveCaret(nextCaret);
  };

  const handleAttachmentTypeSelect = (
    entityType: (typeof ASSISTANT_ATTACHMENT_TYPE_OPTIONS)[number]['entityType']
  ) => {
    if (!mentionQuery) {
      return;
    }

    const replacement = `@${entityType}@`;
    applyMessageReplacement(
      mentionQuery.start,
      mentionQuery.end,
      replacement,
      mentionQuery.start + replacement.length
    );
  };

  const handleAttachmentSelect = (option: (typeof assistantChat.attachmentOptions)[number]) => {
    if (!mentionQuery) {
      return;
    }

    assistantChat.addAttachment(option);

    const replacement =
      messageText.slice(mentionQuery.end).startsWith(' ') || mentionQuery.start === 0 ? '' : ' ';
    applyMessageReplacement(
      mentionQuery.start,
      mentionQuery.end,
      replacement,
      mentionQuery.start + replacement.length
    );
  };

  const handleSkillSelect = (slug: string) => {
    if (!skillCommand) {
      return;
    }

    assistantChat.toggleSelectedSkillSlug(slug);
    applyMessageReplacement(skillCommand.start, skillCommand.end, '', skillCommand.start);
  };

  const handleToolSelect = (toolName: (typeof assistantChat.availableTools)[number]['name']) => {
    if (!toolCommand) {
      return;
    }

    assistantChat.setToolSelection(toolName, true);
    applyMessageReplacement(toolCommand.start, toolCommand.end, '', toolCommand.start);
  };

  const resetSkillForm = () => {
    setSkillName('');
    setSkillSlug('');
    setSkillAliases('');
    setSkillPrompt('');
  };

  const handleCreateSkill = () => {
    const trimmedName = skillName.trim();
    const trimmedPrompt = skillPrompt.trim();
    const normalizedSlug = (skillSlug.trim() || slugifySkillName(trimmedName)).trim();

    if (!trimmedName || !trimmedPrompt || !normalizedSlug) {
      toast.error(t('pages.user.ai.skills.validation'));
      return;
    }

    const slugTaken = assistantChat.availableSkills.some(skill => skill.slug === normalizedSlug);
    if (slugTaken) {
      toast.error(t('pages.user.ai.skills.slugExists'));
      return;
    }

    const createdSlug = assistantChat.createSkill({
      name: trimmedName,
      slug: normalizedSlug,
      aliases: skillAliases,
      systemPrompt: trimmedPrompt,
    });

    assistantChat.setSkillSelection(createdSlug, true);
    setCreateSkillOpen(false);
    resetSkillForm();
  };

  const handleSubmit = async () => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || assistantChat.isSending || assistantChat.isUploadingAttachments) {
      return;
    }

    await assistantChat.sendAssistantMessage(trimmedMessage, {
      onUserMessageSent: () => {
        setMessageText('');
        setCaretPosition(0);
      },
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    await assistantChat.addUploadedFiles(files);
  };

  return (
    <CardContent className="flex-shrink-0 border-t p-4">
      <div className="space-y-3">
        {assistantChat.selectedTools.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {visibleSelectedTools.map(tool => (
              <Badge key={tool.name} variant="secondary" className="gap-1 pr-1 text-xs">
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
              </Badge>
            ))}
            {hiddenSelectedToolCount > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Wrench className="h-3 w-3" />+{hiddenSelectedToolCount}{' '}
                {t('features.messages.ai.moreTools')}
              </Badge>
            )}
          </div>
        )}

        {assistantChat.selectedSkills.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {assistantChat.selectedSkills.map(skill => (
              <Badge key={skill.slug} variant="secondary" className="gap-1 pr-1 text-xs">
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
              </Badge>
            ))}
          </div>
        )}

        {assistantChat.selectedAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {assistantChat.selectedAttachments.map(attachment => (
              <Badge
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
              </Badge>
            ))}
          </div>
        )}

        {assistantChat.isUploadingAttachments && assistantChat.uploadingAttachmentName && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <LoaderCircle className="h-3 w-3 animate-spin" />
            {t('features.messages.compose.uploading')}:{assistantChat.uploadingAttachmentName}
          </Badge>
        )}

        <div className="relative">
          <Textarea
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
            onScroll={() => setTextareaScrollVersion(currentValue => currentValue + 1)}
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
                      {toolSuggestions.map(tool => (
                        <button
                          key={tool.name}
                          type="button"
                          onClick={() => handleToolSelect(tool.name)}
                          className="hover:bg-muted flex w-full items-start gap-3 rounded-md px-2 py-2 text-left"
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
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {tool.kind}
                          </Badge>
                        </button>
                      ))}
                    </>
                  )}

                  {skillSuggestions.length > 0 && (
                    <>
                      <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                        {t('features.messages.ai.skills')}
                      </p>
                      {skillSuggestions.map(skill => (
                        <button
                          key={skill.slug}
                          type="button"
                          onClick={() => handleSkillSelect(skill.slug)}
                          className="hover:bg-muted flex w-full items-start gap-3 rounded-md px-2 py-2 text-left"
                        >
                          <Slash className="text-muted-foreground mt-0.5 h-4 w-4" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{skill.name}</span>
                            <span className="text-muted-foreground block text-xs">
                              /{skill.slug}
                            </span>
                          </span>
                          {skill.isBuiltIn && (
                            <Badge variant="secondary" className="text-[10px] uppercase">
                              {translateText('generated.inline.0751_built_in_20f409cc')}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </>
                  )}

                  {attachmentTypeSuggestions.length > 0 && (
                    <>
                      <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                        {t('features.messages.ai.attachTypes')}
                      </p>
                      {attachmentTypeSuggestions.map(option => (
                        <button
                          key={option.entityType}
                          type="button"
                          onClick={() => handleAttachmentTypeSelect(option.entityType)}
                          className="hover:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-left"
                        >
                          <AtSign className="text-muted-foreground h-4 w-4" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{option.label}</span>
                            <span className="text-muted-foreground block text-xs">
                              {option.token}
                            </span>
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {attachmentSuggestions.length > 0 && (
                    <>
                      <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                        {t('features.messages.ai.attachments')}
                      </p>
                      {attachmentSuggestions.map(option => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => handleAttachmentSelect(option)}
                          className="hover:bg-muted flex w-full items-start gap-3 rounded-md px-2 py-2 text-left"
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
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {option.entityType}
                          </Badge>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={MESSAGE_ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={event => {
              void handleFileChange(event);
            }}
          />

          <div className="min-w-[240px] flex-1">
            <div className="flex items-center gap-1">
              <Select
                value={assistantChat.selectedModelKey}
                onValueChange={assistantChat.setSelectedModelKey}
              >
                <SelectTrigger className="h-8 gap-2">
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
                          <Badge className="border-0 bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-lime-500/20 text-[10px] text-emerald-800 dark:text-emerald-200">
                            {translateText('generated.inline.0752_free_75f52718')}
                          </Badge>
                        )}
                        {assistantChat.selectedModel.source === 'byok' && (
                          <Badge className="border-0 bg-gradient-to-r from-slate-500/20 via-zinc-500/20 to-stone-500/20 text-[10px] text-slate-800 dark:text-slate-200">
                            {translateText('generated.inline.0113_byok_36068183')}
                          </Badge>
                        )}
                        <Badge className="border-0 bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-blue-500/20 text-[10px] text-sky-800 dark:text-sky-200">
                          {translateText('generated.inline.0114_ctx_4024700f')}
                          {formatContextWindow(assistantChat.selectedModel.context_window)}
                        </Badge>
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
                </SelectTrigger>
                <SelectContent>
                  {assistantChat.models.map(model => {
                    const modelKey = buildModelKey(model);
                    const isFreeRouterModel = freeRouterModelKey === modelKey;
                    const displayLabel = getModelDisplayLabel(model);
                    const modelHint = isFreeRouterModel ? freeRouterMessage : reliabilityMessage;
                    const modelHintClass = isFreeRouterModel
                      ? 'inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold leading-none text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : 'inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold leading-none text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';

                    return (
                      <SelectItem
                        key={modelKey}
                        value={modelKey}
                        textValue={displayLabel}
                        className="py-2"
                      >
                        <div className="flex w-full min-w-0 items-center justify-between gap-2">
                          <span className="truncate font-medium">{displayLabel}</span>
                          <span className="flex flex-shrink-0 items-center gap-1.5">
                            {model.free && (
                              <Badge className="border-0 bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-lime-500/20 text-[10px] text-emerald-800 dark:text-emerald-200">
                                {translateText('generated.inline.0752_free_75f52718')}
                              </Badge>
                            )}
                            {model.source === 'byok' && (
                              <Badge className="border-0 bg-gradient-to-r from-slate-500/20 via-zinc-500/20 to-stone-500/20 text-[10px] text-slate-800 dark:text-slate-200">
                                {translateText('generated.inline.0113_byok_36068183')}
                              </Badge>
                            )}
                            <Badge className="border-0 bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-blue-500/20 text-[10px] text-sky-800 dark:text-sky-200">
                              {translateText('generated.inline.0114_ctx_4024700f')}
                              {formatContextWindow(model.context_window)}
                            </Badge>
                            <span
                              className={modelHintClass}
                              title={modelHint}
                              aria-label={modelHint}
                            >
                              ?
                            </span>
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="w-[120px]">
            <Select
              value={assistantChat.reasoningEffort}
              onValueChange={value => assistantChat.setReasoningEffort(value as AiReasoningEffort)}
              disabled={!assistantChat.selectedModel?.supports_reasoning_effort}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder={t('features.messages.ai.reasoning')} />
              </SelectTrigger>
              <SelectContent>
                <div className="px-3 py-2">
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                    {t('features.messages.ai.reasoningDropdownTitle')}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t('features.messages.ai.reasoningDropdownDescription')}
                  </div>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700" />
                {REASONING_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${option.gradientClass}`}
                      >
                        <option.Icon className="h-3 w-3" />
                      </span>
                      <span className="text-sm font-medium">{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                assistantChat.availableSkills.map(skill => (
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

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={assistantChat.isUploadingAttachments}
            title={t('features.messages.compose.uploadFiles')}
            aria-label={t('features.messages.compose.uploadFiles')}
          >
            {assistantChat.isUploadingAttachments ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('features.messages.ai.createSkill')}</DialogTitle>
            <DialogDescription>
              {t('features.messages.ai.createSkillDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('pages.user.ai.skills.name')}</label>
              <Input value={skillName} onChange={event => setSkillName(event.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('pages.user.ai.skills.slug')}</label>
              <Input
                value={skillSlug}
                onChange={event => setSkillSlug(event.target.value)}
                placeholder={slugifySkillName(skillName) || 'campaign-planner'}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('pages.user.ai.skills.aliases')}</label>
              <HashtagInput
                value={parseAliases(skillAliases)}
                onChange={aliases => setSkillAliases(aliases.join(','))}
                showLabel={false}
                placeholder={t('pages.user.ai.skills.aliasesPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('pages.user.ai.skills.systemPrompt')}
              </label>
              <Textarea
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
        </DialogContent>
      </Dialog>
    </CardContent>
  );
}
