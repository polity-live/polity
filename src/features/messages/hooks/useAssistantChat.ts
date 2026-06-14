import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DEFAULT_AI_SKILLS } from '@/features/assistant/logic/defaultAiSkills';
import { buildAiModelKey, getPreferredDefaultAiModelKey } from '@/lib/ai/models';
import { DEFAULT_AI_TOOLS, type AiToolName } from '@/lib/ai/defaultAiTools';
import type { AiChatAttachment, AiProvider, AiReasoningEffort } from '@/lib/ai/schemas';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { useAiActions } from '@/zero/ai/useAiActions';
import { useAiState } from '@/zero/ai/useAiState';
import type { Conversation } from '../types/message.types';
import { slugifySkillName } from '../logic/assistantComposer';
import { buildAssistantErrorContextJson } from '../logic/contextAttachments';
import { useMessageMutations } from './useMessageMutations';
import { useMessageAttachments } from './useMessageAttachments';

export interface AiCatalogModel {
  provider: AiProvider;
  id: string;
  label: string;
  source: 'app' | 'byok';
  free: boolean;
  supports_reasoning_effort: boolean;
  context_window: number | null;
}

interface AiCatalogResponse {
  models: AiCatalogModel[];
}

export interface AssistantSkillOption {
  slug: string;
  name: string;
  aliases: string[];
  isBuiltIn: boolean;
  systemPrompt: string;
  enabled: boolean;
}

export interface AssistantToolOption {
  name: AiToolName;
  label: string;
  kind: 'search' | 'create';
  description: string;
  enabled: boolean;
}

export interface CreateAssistantSkillInput {
  name: string;
  slug?: string;
  aliases?: string;
  systemPrompt: string;
}

interface SendAssistantMessageOptions {
  onUserMessageSent?: () => void;
}

interface AssistantChatStreamEvent {
  type:
    | 'compression-start'
    | 'text-delta'
    | 'tool-call-delta'
    | 'tool-call'
    | 'tool-result'
    | 'error';
  text?: string;
  toolName?: string | null;
  args?: Record<string, unknown> | null;
  message?: string;
}

interface ActiveToolCallState {
  label: string | null;
  preview: string | null;
}

function parseStoredSkillAliases(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map(alias => alias.trim())
    .filter(Boolean);
}

function sameToolNames(left: readonly AiToolName[], right: readonly AiToolName[]): boolean {
  return left.length === right.length && left.every((toolName, index) => toolName === right[index]);
}

function parseAssistantChatStreamEvent(rawLine: string): AssistantChatStreamEvent | null {
  try {
    const parsed = JSON.parse(rawLine) as Record<string, unknown>;
    const type = parsed.type;

    if (
      type !== 'compression-start' &&
      type !== 'text-delta' &&
      type !== 'tool-call-delta' &&
      type !== 'tool-call' &&
      type !== 'tool-result' &&
      type !== 'error'
    ) {
      return null;
    }

    return {
      type,
      text: typeof parsed.text === 'string' ? parsed.text : undefined,
      toolName: typeof parsed.toolName === 'string' ? parsed.toolName : null,
      args:
        parsed.args && typeof parsed.args === 'object' && !Array.isArray(parsed.args)
          ? (parsed.args as Record<string, unknown>)
          : null,
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
    };
  } catch {
    return null;
  }
}

function formatToolCallValue(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    const preview = value
      .slice(0, 3)
      .map(item => formatToolCallValue(item))
      .join(', ');
    return `[${preview}${value.length > 3 ? ', ...' : ''}]`;
  }

  if (typeof value === 'object') {
    return '{...}';
  }

  return 'unknown';
}

function buildToolCallPreview(
  toolName: string | null,
  args?: Record<string, unknown> | null
): string | null {
  if (!toolName) {
    return null;
  }

  if (!args || Object.keys(args).length === 0) {
    return `${toolName}()`;
  }

  const serializedArgs = Object.entries(args)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${formatToolCallValue(value)}`)
    .join(', ');

  const hasMoreArgs = Object.keys(args).length > 4;
  return `${toolName}(${serializedArgs}${hasMoreArgs ? ', ...' : ''})`;
}

export function useAssistantChat(conversation: Conversation, currentUserId?: string) {
  const { session } = useAuth();
  const { t } = useTranslation();
  const { skills, tools } = useAiState();
  const aiActions = useAiActions();
  const mutations = useMessageMutations();
  const attachmentComposer = useMessageAttachments(conversation.id);

  const [models, setModels] = useState<AiCatalogModel[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<AiReasoningEffort>('medium');
  const [selectedSkillSlugs, setSelectedSkillSlugs] = useState<string[]>([]);
  const [selectedToolNames, setSelectedToolNames] = useState<AiToolName[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [awaitingPersistenceText, setAwaitingPersistenceText] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isToolCalling, setIsToolCalling] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [activeToolCall, setActiveToolCall] = useState<ActiveToolCallState | null>(null);
  const [hasManualToolSelection, setHasManualToolSelection] = useState(false);

  const availableSkills = useMemo<AssistantSkillOption[]>(() => {
    const mergedSkills = new Map<string, AssistantSkillOption>();
    const builtInSkillSlugs = new Set(DEFAULT_AI_SKILLS.map(skill => skill.slug));

    for (const skill of DEFAULT_AI_SKILLS) {
      mergedSkills.set(skill.slug, {
        slug: skill.slug,
        name: skill.name,
        aliases: [...skill.aliases],
        isBuiltIn: true,
        systemPrompt: skill.systemPrompt,
        enabled: true,
      });
    }

    for (const skill of skills) {
      const isBuiltIn = builtInSkillSlugs.has(skill.slug);
      mergedSkills.set(skill.slug, {
        slug: skill.slug,
        name: skill.name,
        aliases: parseStoredSkillAliases(skill.aliases),
        isBuiltIn,
        systemPrompt: skill.system_prompt,
        enabled: skill.enabled,
      });
    }

    return [...mergedSkills.values()]
      .filter(skill => skill.enabled)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [skills]);

  const selectedSkills = useMemo(
    () =>
      selectedSkillSlugs
        .map(skillSlug => availableSkills.find(skill => skill.slug === skillSlug) ?? null)
        .filter((skill): skill is AssistantSkillOption => skill !== null),
    [availableSkills, selectedSkillSlugs]
  );

  const availableTools = useMemo<AssistantToolOption[]>(() => {
    const overrideMap = new Map(tools.map(tool => [tool.tool_name, tool]));

    return DEFAULT_AI_TOOLS.map(tool => ({
      name: tool.name,
      label: tool.label,
      kind: tool.kind,
      description: tool.description,
      enabled: overrideMap.get(tool.name)?.enabled ?? true,
    })).sort((left, right) => left.label.localeCompare(right.label));
  }, [tools]);

  const selectedTools = useMemo(
    () =>
      selectedToolNames
        .map(toolName => availableTools.find(tool => tool.name === toolName) ?? null)
        .filter((tool): tool is AssistantToolOption => tool !== null),
    [availableTools, selectedToolNames]
  );

  const selectedModel = useMemo(
    () => models.find(model => buildAiModelKey(model) === selectedModelKey) ?? null,
    [models, selectedModelKey]
  );

  const preferredDefaultModelKey = useMemo(() => getPreferredDefaultAiModelKey(models), [models]);

  const refreshCatalog = useCallback(async () => {
    if (!session?.access_token) {
      setModels([]);
      return;
    }

    setIsCatalogLoading(true);

    try {
      const response = await fetch('/api/ai/catalog', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as AiCatalogResponse;
      setModels(payload.models ?? []);
    } catch (error) {
      console.error('Failed to load AI catalog:', error);
      toast.error(translateText('generated.inline.0734_failed_to_load_ai_models_9302850d'));
      setModels([]);
    } finally {
      setIsCatalogLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (models.length === 0) {
      setSelectedModelKey('');
      return;
    }

    const selectionStillExists = models.some(model => buildAiModelKey(model) === selectedModelKey);

    if (!selectionStillExists && preferredDefaultModelKey) {
      setSelectedModelKey(preferredDefaultModelKey);
    }
  }, [models, preferredDefaultModelKey, selectedModelKey]);

  useEffect(() => {
    setSelectedSkillSlugs(currentSkillSlugs =>
      currentSkillSlugs.filter(skillSlug => availableSkills.some(skill => skill.slug === skillSlug))
    );
  }, [availableSkills]);

  useEffect(() => {
    setSelectedToolNames(currentToolNames =>
      currentToolNames.filter(toolName => availableTools.some(tool => tool.name === toolName))
    );
  }, [availableTools]);

  useEffect(() => {
    if (hasManualToolSelection) {
      return;
    }

    const nextToolNames = availableTools.filter(tool => tool.enabled).map(tool => tool.name);
    setSelectedToolNames(currentToolNames =>
      sameToolNames(currentToolNames, nextToolNames) ? currentToolNames : nextToolNames
    );
  }, [availableTools, hasManualToolSelection]);

  useEffect(() => {
    setStreamingText('');
    setAwaitingPersistenceText(null);
    setStreamError(null);
    setIsCompressing(false);
    setIsThinking(false);
    setIsToolCalling(false);
    setActiveToolName(null);
    setActiveToolCall(null);
    setIsSending(false);
    setHasManualToolSelection(false);
  }, [conversation.id]);

  useEffect(() => {
    if (!awaitingPersistenceText) {
      return;
    }

    const lastAssistantMessage = [...conversation.messages]
      .reverse()
      .find(message => message.sender?.id !== currentUserId);

    if (lastAssistantMessage?.content?.trim() === awaitingPersistenceText.trim()) {
      setStreamingText('');
      setAwaitingPersistenceText(null);
    }
  }, [awaitingPersistenceText, conversation.messages, currentUserId]);

  const setSkillSelection = useCallback((skillSlug: string, enabled: boolean) => {
    setSelectedSkillSlugs(currentSkillSlugs => {
      const hasSkill = currentSkillSlugs.includes(skillSlug);
      if (enabled) {
        return hasSkill ? currentSkillSlugs : [...currentSkillSlugs, skillSlug];
      }

      return hasSkill
        ? currentSkillSlugs.filter(currentSkillSlug => currentSkillSlug !== skillSlug)
        : currentSkillSlugs;
    });
  }, []);

  const toggleSelectedSkillSlug = useCallback((skillSlug: string) => {
    setSelectedSkillSlugs(currentSkillSlugs =>
      currentSkillSlugs.includes(skillSlug)
        ? currentSkillSlugs.filter(currentSkillSlug => currentSkillSlug !== skillSlug)
        : [...currentSkillSlugs, skillSlug]
    );
  }, []);

  const setToolSelection = useCallback((toolName: AiToolName, enabled: boolean) => {
    setHasManualToolSelection(true);
    setSelectedToolNames(currentToolNames => {
      const hasTool = currentToolNames.includes(toolName);
      if (enabled) {
        return hasTool ? currentToolNames : [...currentToolNames, toolName];
      }

      return hasTool
        ? currentToolNames.filter(currentToolName => currentToolName !== toolName)
        : currentToolNames;
    });
  }, []);

  const toggleSelectedToolName = useCallback((toolName: AiToolName) => {
    setHasManualToolSelection(true);
    setSelectedToolNames(currentToolNames =>
      currentToolNames.includes(toolName)
        ? currentToolNames.filter(currentToolName => currentToolName !== toolName)
        : [...currentToolNames, toolName]
    );
  }, []);

  const setToolGroupSelection = useCallback(
    (kind: AssistantToolOption['kind'], enabled: boolean) => {
      setHasManualToolSelection(true);

      const toolNamesForKind = availableTools
        .filter(tool => tool.kind === kind)
        .map(tool => tool.name);

      setSelectedToolNames(currentToolNames => {
        const nextSelectedToolNameSet = new Set(currentToolNames);

        for (const toolName of toolNamesForKind) {
          if (enabled) {
            nextSelectedToolNameSet.add(toolName);
          } else {
            nextSelectedToolNameSet.delete(toolName);
          }
        }

        const nextToolNames = availableTools
          .map(tool => tool.name)
          .filter(toolName => nextSelectedToolNameSet.has(toolName));

        return sameToolNames(currentToolNames, nextToolNames) ? currentToolNames : nextToolNames;
      });
    },
    [availableTools]
  );

  const createSkill = useCallback(
    (input: CreateAssistantSkillInput): string => {
      const slug = input.slug?.trim() || slugifySkillName(input.name);
      aiActions.createSkill({
        slug,
        name: input.name.trim(),
        aliases: input.aliases?.trim(),
        system_prompt: input.systemPrompt.trim(),
      });
      return slug;
    },
    [aiActions]
  );

  const sendAssistantMessage = useCallback(
    async (content: string, options?: SendAssistantMessageOptions): Promise<boolean> => {
      if (!currentUserId) {
        toast.error(t('features.messages.ai.authRequired'));
        return false;
      }

      if (!session?.access_token) {
        toast.error(t('features.messages.ai.sessionMissing'));
        return false;
      }

      if (!selectedModel) {
        toast.error(t('features.messages.ai.modelRequired'));
        return false;
      }

      setIsSending(true);
      setIsThinking(true);
      setIsCompressing(false);
      setIsToolCalling(false);
      setActiveToolName(null);
      setActiveToolCall(null);
      setStreamingText('');
      setAwaitingPersistenceText(null);
      setStreamError(null);

      const attachmentsForRequest: AiChatAttachment[] = [...attachmentComposer.selectedAttachments];

      for (const selectedSkill of selectedSkills) {
        attachmentsForRequest.push({
          entityType: 'skill',
          entityId: selectedSkill.slug,
          title: selectedSkill.name,
          subtitle: selectedSkill.slug,
          prompt_context: selectedSkill.systemPrompt,
        });
      }

      const contextJson = JSON.stringify(attachmentsForRequest);

      try {
        const userMessageResult = await mutations.sendMessage(
          conversation.id,
          currentUserId,
          content,
          undefined,
          { contextJson }
        );

        if (!userMessageResult.success) {
          return false;
        }

        options?.onUserMessageSent?.();

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            content,
            model: {
              provider: selectedModel.provider,
              id: selectedModel.id,
            },
            reasoningEffort,
            skillSlugs: selectedSkills.map(skill => skill.slug),
            toolNames: selectedToolNames,
            attachments: attachmentsForRequest,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error((await response.text()) || 'AI chat request failed');
        }

        attachmentComposer.clearAttachments();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let finalText = '';
        let streamBuffer = '';
        let streamErrorMessage: string | null = null;

        const resolveToolLabel = (toolName?: string | null): string | null => {
          if (!toolName) {
            return null;
          }

          return availableTools.find(tool => tool.name === toolName)?.label ?? toolName;
        };

        const handleStreamLine = (rawLine: string) => {
          if (!rawLine) {
            return;
          }

          const streamEvent = parseAssistantChatStreamEvent(rawLine);
          if (!streamEvent) {
            return;
          }

          switch (streamEvent.type) {
            case 'compression-start': {
              setIsCompressing(true);
              setIsThinking(false);
              setIsToolCalling(false);
              setActiveToolName(null);
              setActiveToolCall(null);
              break;
            }
            case 'text-delta': {
              if (!streamEvent.text) {
                return;
              }

              finalText += streamEvent.text;
              setStreamingText(currentText => currentText + streamEvent.text);
              setIsCompressing(false);
              setIsThinking(false);
              setIsToolCalling(false);
              setActiveToolName(null);
              setActiveToolCall(null);
              break;
            }
            case 'tool-call-delta': {
              setIsCompressing(false);
              setIsThinking(false);
              setIsToolCalling(true);
              break;
            }
            case 'tool-call': {
              const label = resolveToolLabel(streamEvent.toolName);
              setIsCompressing(false);
              setIsThinking(false);
              setIsToolCalling(true);
              setActiveToolName(label);
              setActiveToolCall({
                label,
                preview: buildToolCallPreview(streamEvent.toolName ?? null, streamEvent.args),
              });
              break;
            }
            case 'tool-result': {
              setIsCompressing(false);
              setIsThinking(true);
              setIsToolCalling(false);
              setActiveToolName(null);
              setActiveToolCall(null);
              break;
            }
            case 'error': {
              streamErrorMessage = streamEvent.message ?? t('features.messages.ai.sendFailed');
              setIsCompressing(false);
              setIsThinking(false);
              setIsToolCalling(false);
              setActiveToolName(null);
              setActiveToolCall(null);
              throw new Error(streamErrorMessage);
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) {
            continue;
          }

          streamBuffer += chunk;
          let newlineIndex = streamBuffer.indexOf('\n');
          while (newlineIndex !== -1) {
            const line = streamBuffer.slice(0, newlineIndex).trim();
            streamBuffer = streamBuffer.slice(newlineIndex + 1);
            handleStreamLine(line);
            newlineIndex = streamBuffer.indexOf('\n');
          }
        }

        const trailingChunk = decoder.decode();
        if (trailingChunk) {
          streamBuffer += trailingChunk;
        }

        if (streamBuffer.trim()) {
          handleStreamLine(streamBuffer.trim());
        }

        if (finalText.trim()) {
          setAwaitingPersistenceText(finalText.trim());
        } else {
          setStreamingText('');
        }

        setStreamError(null);

        return true;
      } catch (error) {
        console.error('Failed to stream Aria & Kai response:', error);
        const errorMessage =
          error instanceof Error && error.message.trim()
            ? error.message
            : t('features.messages.ai.sendFailed');
        setStreamingText('');
        setAwaitingPersistenceText(null);
        setIsCompressing(false);
        setIsToolCalling(false);
        setActiveToolName(null);
        setActiveToolCall(null);

        const persistedError = await mutations.sendAssistantMessage(conversation.id, errorMessage, {
          contextJson: buildAssistantErrorContextJson(),
        });

        setStreamError(persistedError.success ? null : errorMessage);
        toast.error(errorMessage);
        return false;
      } finally {
        setIsSending(false);
        setIsCompressing(false);
        setIsThinking(false);
        setIsToolCalling(false);
        setActiveToolName(null);
        setActiveToolCall(null);
      }
    },
    [
      availableTools,
      attachmentComposer,
      conversation.id,
      currentUserId,
      mutations,
      reasoningEffort,
      selectedModel,
      selectedSkills,
      selectedToolNames,
      session?.access_token,
      t,
    ]
  );

  return {
    models,
    isCatalogLoading,
    refreshCatalog,
    selectedModel,
    selectedModelKey,
    setSelectedModelKey,
    reasoningEffort,
    setReasoningEffort,
    availableTools,
    selectedTools,
    selectedToolNames,
    setToolSelection,
    setToolGroupSelection,
    toggleSelectedToolName,
    availableSkills,
    selectedSkills,
    selectedSkillSlugs,
    setSkillSelection,
    toggleSelectedSkillSlug,
    selectedAttachments: attachmentComposer.selectedAttachments,
    attachmentOptions: attachmentComposer.attachmentOptions,
    resolveAttachmentCardData: attachmentComposer.resolveAttachmentCardData,
    addAttachment: attachmentComposer.addAttachment,
    removeAttachment: attachmentComposer.removeAttachment,
    clearAttachments: attachmentComposer.clearAttachments,
    addUploadedFiles: attachmentComposer.addUploadedFiles,
    isUploadingAttachments: attachmentComposer.isUploadingAttachments,
    uploadingAttachmentName: attachmentComposer.uploadingAttachmentName,
    createSkill,
    sendAssistantMessage,
    streamingText,
    streamError,
    isSending,
    isCompressing,
    isThinking,
    isToolCalling,
    activeToolName,
    activeToolCall,
  };
}
