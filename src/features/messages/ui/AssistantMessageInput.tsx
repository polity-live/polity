'use client';

import {
  contextReferenceKey,
  type ProjectContextReference,
} from '@/features/project-chat/logic/context-references';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { featureThemeClassName } from '@/features/shared/theme';
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
import type { AssistantChatController } from '../hooks/useAssistantChat';
import { buildAiModelKey as buildModelKey, aiSourceTranslationKey } from '@/lib/ai/models';

interface AssistantMessageInputProps {
  assistantChat: AssistantChatController;
  compact?: boolean;
}
import { AssistantMessageInputView } from './AssistantMessageInputView';
import {
  reportAppTutorialAction,
  requestAppTutorialSpotlightTarget,
} from '@/features/app-tutorial/events';
import { matchesAppTutorialExpectedInput } from '@/features/app-tutorial/catalog';
export function AssistantMessageInput({
  assistantChat,
  compact = false,
}: AssistantMessageInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftKey = assistantChat.projectDraftKey;
  const readDraft = () => {
    try {
      return draftKey ? (sessionStorage.getItem(draftKey) ?? '') : '';
    } catch {
      return '';
    }
  };
  const [messageText, updateMessageText] = useState(readDraft);
  const setMessageText = (value: SetStateAction<string>) => {
    updateMessageText(current => {
      const next = typeof value === 'function' ? value(current) : value;
      try {
        if (draftKey) {
          if (next) sessionStorage.setItem(draftKey, next);
          else sessionStorage.removeItem(draftKey);
        }
      } catch {
        /* The mounted composer still retains the draft. */
      }
      return next;
    });
  };
  useLayoutEffect(() => {
    updateMessageText(readDraft());
  }, [draftKey]);
  const [caretPosition, setCaretPosition] = useState(0);
  const [suggestionAnchorPosition, setSuggestionAnchorPosition] =
    useState<SuggestionAnchorPosition | null>(null);
  const [textareaScrollVersion, setTextareaScrollVersion] = useState(0);
  const [createSkillOpen, setCreateSkillOpen] = useState(false);
  const [assistantSettingsOpen, setAssistantSettingsOpen] = useState(false);
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

  const updateTools = useMemo(
    () => assistantChat.availableTools.filter(tool => tool.kind === 'update'),
    [assistantChat.availableTools]
  );

  const projectTools = useMemo(
    () => assistantChat.availableTools.filter(tool => tool.kind === 'project'),
    [assistantChat.availableTools]
  );

  const mentionQuery = useMemo(
    () => parseActiveMentionQuery(messageText, caretPosition),
    [messageText, caretPosition]
  );
  useEffect(() => {
    assistantChat.setAttachmentSearchEnabled?.(Boolean(mentionQuery));
    return () => assistantChat.setAttachmentSearchEnabled?.(false);
  }, [assistantChat.setAttachmentSearchEnabled, Boolean(mentionQuery)]);

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

  const projectOptions = useMemo(
    () =>
      (assistantChat.projectContextOptions ?? [])
        .filter(ref => ref.kind === 'frame' || ref.kind === 'element')
        .map(ref => ({
          key: contextReferenceKey(ref),
          entityType: ref.kind as 'frame' | 'element',
          label: ref.label,
          subtitle: ref.parentId
            ? assistantChat.projectContextOptions.find(frame => frame.id === ref.parentId)?.label
            : t('features.projectChat.context.frame'),
          searchText: ref.label.toLowerCase(),
          reference: ref,
        })),
    [assistantChat.projectContextOptions, t]
  );
  const attachmentTypeSuggestions = useMemo(() => {
    if (!mentionQuery) {
      return [];
    }

    const typedType = mentionQuery.raw.slice(1).split('@')[0].trim().toLowerCase();

    return [
      ...ASSISTANT_ATTACHMENT_TYPE_OPTIONS,
      ...(projectOptions.length
        ? [
            {
              entityType: 'frame' as const,
              token: '@frame@',
              label: t('features.projectChat.context.frames'),
            },
            {
              entityType: 'element' as const,
              token: '@element@',
              label: t('features.projectChat.context.elements'),
            },
          ]
        : []),
    ].filter(
      option =>
        !mentionQuery.entityType &&
        (typedType.length === 0 ||
          option.entityType.includes(typedType) ||
          option.label.toLowerCase().includes(typedType))
    );
  }, [mentionQuery, projectOptions, t]);

  const attachmentSuggestions = useMemo(() => {
    if (!mentionQuery) {
      return [];
    }

    return [...assistantChat.attachmentOptions, ...projectOptions]
      .filter(option => {
        if (
          selectedAttachmentKeys.has(option.key) ||
          ('reference' in option &&
            (assistantChat.projectContextReferences ?? []).some(
              ref => ref.origin === 'manual' && contextReferenceKey(ref) === option.key
            ))
        ) {
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
  }, [
    assistantChat.attachmentOptions,
    projectOptions,
    assistantChat.projectContextReferences,
    mentionQuery,
    selectedAttachmentKeys,
  ]);

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

  const freeRouterLabel = t('features.messages.ai.freeRouterModel');
  const freeRouterMessage = t('features.messages.ai.modelReliability.freeRouter');
  const reliabilityMessage = t('features.messages.ai.modelReliability.warning');

  const freeRouterModelKey = useMemo(() => {
    const labeledModel = assistantChat.models.find(
      candidate =>
        candidate.source === 'app' &&
        candidate.label.trim().toLowerCase() === freeRouterLabel.trim().toLowerCase()
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
    const modelKey = buildModelKey(model);
    if (freeRouterModelKey && modelKey === freeRouterModelKey) {
      return `${freeRouterLabel} · ${t(aiSourceTranslationKey(model.source))}`;
    }

    return model.supports_tools === false
      ? `${model.label} · ${t(aiSourceTranslationKey(model.source))} · ${t('features.studio.modelNoTools')}`
      : `${model.label} · ${t(aiSourceTranslationKey(model.source))}`;
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
    entityType:
      (typeof ASSISTANT_ATTACHMENT_TYPE_OPTIONS)[number]['entityType'] | 'frame' | 'element'
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

  const handleAttachmentSelect = (
    option:
      (typeof assistantChat.attachmentOptions)[number] | { reference: ProjectContextReference }
  ) => {
    if (!mentionQuery) {
      return;
    }

    if ('reference' in option) assistantChat.addProjectContext?.(option.reference);
    else assistantChat.addAttachment(option);

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

    const isTutorialTodoRequest =
      assistantChat.isTutorialConversation &&
      matchesAppTutorialExpectedInput(trimmedMessage, 'assistantTodo');
    if (isTutorialTodoRequest) {
      requestAppTutorialSpotlightTarget('tutorial-assistant-chat');
    }

    let userMessageWasSent = false;
    await assistantChat.sendAssistantMessage(trimmedMessage, {
      onUserMessageSent: () => {
        userMessageWasSent = true;
        setMessageText('');
        setCaretPosition(0);
      },
    });
    if (userMessageWasSent && isTutorialTodoRequest) {
      reportAppTutorialAction({
        type: 'input',
        value: trimmedMessage,
      });
    } else if (isTutorialTodoRequest) {
      requestAppTutorialSpotlightTarget('message-composer');
    }
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
      assistantSettingsOpen={assistantSettingsOpen}
      setAssistantSettingsOpen={setAssistantSettingsOpen}
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
      updateTools={updateTools}
      projectTools={projectTools}
      compact={compact}
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
