'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { DropdownMenuCheckboxItem } from '@/features/shared/ui/ui/dropdown-menu';
import { useTranslation } from '@/features/shared/hooks/use-translation';
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

interface AssistantMessageInputProps {
  assistantChat: ReturnType<typeof useAssistantChat>;
}
const MAX_VISIBLE_TOOL_BADGES = 4;
function buildModelKey(model: { provider: string; id: string }): string {
  return `${model.provider}:${model.id}`;
}
import { AssistantMessageInputView } from './AssistantMessageInputView';
export function AssistantMessageInput({ assistantChat }: AssistantMessageInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
        <div className={featureThemeClassName('messageAssistantMessageInputThemedText')}>
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
            <BadgeControl variant="outline" size="tiny" textTransform="uppercase">
              {tools.length}
            </BadgeControl>
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
        ? featureThemeClassName('messageAssistantMessageInputSuccessRoundIcon')
        : featureThemeClassName('messageAssistantMessageInputWarningRoundIcon'),
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
  return (
    <AssistantMessageInputView
      assistantChat={assistantChat}
      t={t}
      textareaRef={textareaRef}
      messageText={messageText}
      setMessageText={setMessageText}
      caretPosition={caretPosition}
      setCaretPosition={setCaretPosition}
      suggestionAnchorPosition={suggestionAnchorPosition}
      setSuggestionAnchorPosition={setSuggestionAnchorPosition}
      textareaScrollVersion={textareaScrollVersion}
      setTextareaScrollVersion={setTextareaScrollVersion}
      createSkillOpen={createSkillOpen}
      setCreateSkillOpen={setCreateSkillOpen}
      skillName={skillName}
      setSkillName={setSkillName}
      skillSlug={skillSlug}
      setSkillSlug={setSkillSlug}
      skillAliases={skillAliases}
      setSkillAliases={setSkillAliases}
      skillPrompt={skillPrompt}
      setSkillPrompt={setSkillPrompt}
      selectedSkillKeySet={selectedSkillKeySet}
      selectedToolKeySet={selectedToolKeySet}
      searchTools={searchTools}
      createTools={createTools}
      mentionQuery={mentionQuery}
      skillCommand={skillCommand}
      toolCommand={toolCommand}
      selectedAttachmentKeys={selectedAttachmentKeys}
      attachmentTypeSuggestions={attachmentTypeSuggestions}
      attachmentSuggestions={attachmentSuggestions}
      skillSuggestions={skillSuggestions}
      toolSuggestions={toolSuggestions}
      hasSuggestionPanel={hasSuggestionPanel}
      suggestionAnchorIndex={suggestionAnchorIndex}
      visibleSelectedTools={visibleSelectedTools}
      hiddenSelectedToolCount={hiddenSelectedToolCount}
      getToolGroupCheckedState={getToolGroupCheckedState}
      renderToolGroup={renderToolGroup}
      freeRouterLabel={freeRouterLabel}
      freeRouterMessage={freeRouterMessage}
      reliabilityMessage={reliabilityMessage}
      freeRouterModelKey={freeRouterModelKey}
      getModelDisplayLabel={getModelDisplayLabel}
      selectedModelHint={selectedModelHint}
      updateCaretPosition={updateCaretPosition}
      moveCaret={moveCaret}
      applyMessageReplacement={applyMessageReplacement}
      handleAttachmentTypeSelect={handleAttachmentTypeSelect}
      handleAttachmentSelect={handleAttachmentSelect}
      handleSkillSelect={handleSkillSelect}
      handleToolSelect={handleToolSelect}
      resetSkillForm={resetSkillForm}
      handleCreateSkill={handleCreateSkill}
      handleSubmit={handleSubmit}
    />
  );
}
