import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { DEFAULT_AI_SKILLS } from '@/features/assistant/logic/defaultAiSkills';
import {
  buildAiModelKey,
  getPreferredDefaultAiModelKey,
  toAiModelDescriptor,
} from '@/lib/ai/models';
import { DEFAULT_AI_TOOLS, type AiToolName } from '@/lib/ai/defaultAiTools';
import type {
  AiChatAttachment,
  AiCredentialSource,
  AiModelDescriptor,
  AiProvider,
  AiReasoningEffort,
} from '@/lib/ai/schemas';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { useAiActions } from '@/zero/ai/useAiActions';
import { useAiState } from '@/zero/ai/useAiState';
import type { Conversation } from '../types/message.types';
import { slugifySkillName } from '../logic/assistantComposer';
import {
  AssistantChatStreamDecoder,
  buildToolCallPreview,
  readAiChatErrorResponse,
  type AssistantChatStreamEvent,
} from '../logic/assistantStream';
import { useMessageMutations } from './useMessageMutations';
import { useMessageAttachments } from './useMessageAttachments';
import { localizeAppError } from '@/features/shared/errors/app-error';
import type { ProjectContextReference } from '@/features/project-chat/logic/context-references';
import type { EditorContext } from '@/features/project-chat/logic/contracts';

export interface AiCatalogModel {
  supports_tools?: boolean;
  provider: AiProvider;
  id: string;
  label: string;
  source: AiCredentialSource;
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
  name: string;
  label: string;
  kind: 'search' | 'create' | 'update' | 'project';
  description: string;
  enabled: boolean;
  alwaysActive: boolean;
}

export interface CreateAssistantSkillInput {
  name: string;
  slug?: string;
  aliases?: string;
  systemPrompt: string;
}

interface SendAssistantMessageOptions {
  onUserMessageSent?: () => void;
  skipUserMessagePersistence?: boolean;
  requestOverride?: AssistantChatRequestPayload;
}

interface AssistantChatRequestPayload {
  conversationId: string;
  content: string;
  model: AiModelDescriptor;
  reasoningEffort: AiReasoningEffort;
  skillSlugs: string[];
  toolNames: AiToolName[];
  attachments: AiChatAttachment[];
  timeZone: string;
  requestId?: string;
  originMessageId?: string;
  editorContext?: EditorContext;
}

export interface ProjectAssistantChatOptions {
  beforeSend: () => Promise<EditorContext | undefined>;
  contextReferences?: readonly ProjectContextReference[];
  contextOptions?: readonly ProjectContextReference[];
  addContextReference?: (ref: ProjectContextReference) => void;
  removeContextReference?: (ref: ProjectContextReference) => void;
  onSent?: () => void;
  resumeRequestId?: string | null;
  externallyBusy?: boolean;
  projectTools?: readonly AssistantToolOption[];
  onCancel?: () => Promise<void>;
}

export interface UseAssistantChatOptions {
  project?: ProjectAssistantChatOptions;
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

function sameToolNames(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((toolName, index) => toolName === right[index]);
}

const personalToolNames = new Set<string>(DEFAULT_AI_TOOLS.map(tool => tool.name));

export function useAssistantChat(
  conversation: Conversation,
  currentUserId?: string,
  controllerOptions: UseAssistantChatOptions = {}
) {
  const isTutorialConversation = Boolean(conversation.tutorial_run_id);
  const { session } = useAuth();
  const { t } = useTranslation();
  const { skills, tools } = useAiState();
  const aiActions = useAiActions();
  const mutations = useMessageMutations();
  const attachmentComposer = useMessageAttachments(conversation.id);

  const [models, setModels] = useState<AiCatalogModel[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState('');
  const modelSelectionInitialized = useRef(false);
  const [reasoningEffort, setReasoningEffort] = useState<AiReasoningEffort>('medium');
  const [selectedSkillSlugs, setSelectedSkillSlugs] = useState<string[]>([]);
  const [selectedToolNames, setSelectedToolNames] = useState<string[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [awaitingPersistenceText, setAwaitingPersistenceText] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const [lastFailedRequest, setLastFailedRequest] = useState<AssistantChatRequestPayload | null>(
    null
  );
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isToolCalling, setIsToolCalling] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [activeToolCall, setActiveToolCall] = useState<ActiveToolCallState | null>(null);
  const [hasManualToolSelection, setHasManualToolSelection] = useState(false);
  const abortController = useRef<AbortController | null>(null);

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

    return [
      ...DEFAULT_AI_TOOLS.map(tool => ({
        name: tool.name,
        label: tool.label,
        kind: tool.kind,
        description: tool.description,
        enabled: tool.name === 'read_polity_docs' || (overrideMap.get(tool.name)?.enabled ?? true),
        alwaysActive: !controllerOptions.project && tool.name === 'read_polity_docs',
      })),
      ...(controllerOptions.project?.projectTools ?? []),
    ].sort((left, right) => left.label.localeCompare(right.label));
  }, [controllerOptions.project?.projectTools, tools]);

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
    // Losing access requires a conscious choice; never silently change payer.
    if (!modelSelectionInitialized.current && !selectedModelKey && preferredDefaultModelKey) {
      modelSelectionInitialized.current = true;
      setSelectedModelKey(preferredDefaultModelKey);
    }
  }, [models, preferredDefaultModelKey, selectedModelKey]);

  useEffect(() => {
    setSelectedSkillSlugs(currentSkillSlugs => {
      const next = currentSkillSlugs.filter(skillSlug =>
        availableSkills.some(skill => skill.slug === skillSlug)
      );
      return sameToolNames(currentSkillSlugs, next) ? currentSkillSlugs : next;
    });
  }, [availableSkills]);

  useEffect(() => {
    setSelectedToolNames(currentToolNames => {
      const next = currentToolNames.filter(toolName =>
        availableTools.some(tool => tool.name === toolName)
      );
      return sameToolNames(currentToolNames, next) ? currentToolNames : next;
    });
  }, [availableTools]);

  useEffect(() => {
    if (hasManualToolSelection) {
      return;
    }

    const nextToolNames = availableTools
      .filter(tool => tool.enabled && (!controllerOptions.project || tool.kind === 'project'))
      .map(tool => tool.name);
    setSelectedToolNames(currentToolNames =>
      sameToolNames(currentToolNames, nextToolNames) ? currentToolNames : nextToolNames
    );
  }, [availableTools, hasManualToolSelection, Boolean(controllerOptions.project)]);

  useEffect(() => {
    setStreamingText('');
    setAwaitingPersistenceText(null);
    setActiveTraceId(null);
    setStreamError(null);
    setLastFailedRequest(null);
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

  const setToolSelection = useCallback(
    (toolName: string, enabled: boolean) => {
      if (availableTools.find(tool => tool.name === toolName)?.alwaysActive) return;
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
    },
    [availableTools]
  );

  const toggleSelectedToolName = useCallback(
    (toolName: string) => {
      if (availableTools.find(tool => tool.name === toolName)?.alwaysActive) return;
      setHasManualToolSelection(true);
      setSelectedToolNames(currentToolNames =>
        currentToolNames.includes(toolName)
          ? currentToolNames.filter(currentToolName => currentToolName !== toolName)
          : [...currentToolNames, toolName]
      );
    },
    [availableTools]
  );

  const setToolGroupSelection = useCallback(
    (kind: AssistantToolOption['kind'], enabled: boolean) => {
      setHasManualToolSelection(true);

      const toolNamesForKind = availableTools
        .filter(tool => tool.kind === kind)
        .map(tool => tool.name);

      setSelectedToolNames(currentToolNames => {
        const nextSelectedToolNameSet = new Set(currentToolNames);

        for (const toolName of toolNamesForKind) {
          if (availableTools.find(tool => tool.name === toolName)?.alwaysActive) {
            nextSelectedToolNameSet.add(toolName);
            continue;
          }
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
    async (content: string, sendOptions?: SendAssistantMessageOptions): Promise<boolean> => {
      if (!currentUserId) {
        toast.error(t('features.messages.ai.authRequired'));
        return false;
      }

      if (!session?.access_token) {
        toast.error(t('features.messages.ai.sessionMissing'));
        return false;
      }

      const requestOverride = sendOptions?.requestOverride;
      if (!selectedModel && !requestOverride) {
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

      let requestPayload: AssistantChatRequestPayload | null = null;
      try {
        const attachmentsForRequest: AiChatAttachment[] = requestOverride
          ? [...requestOverride.attachments]
          : [...attachmentComposer.selectedAttachments];

        if (!requestOverride && !controllerOptions.project) {
          for (const selectedSkill of selectedSkills) {
            attachmentsForRequest.push({
              entityType: 'skill',
              entityId: selectedSkill.slug,
              title: selectedSkill.name,
              subtitle: selectedSkill.slug,
              prompt_context: selectedSkill.systemPrompt,
            });
          }
        }

        const contextJson = JSON.stringify(attachmentsForRequest);
        if (requestOverride) {
          requestPayload = requestOverride;
        } else {
          // The prerequisite guard above proves a model exists whenever there is no override.
          const modelForRequest = selectedModel as AiCatalogModel;
          requestPayload = {
            conversationId: conversation.id,
            content,
            model: toAiModelDescriptor(modelForRequest),
            reasoningEffort,
            skillSlugs: selectedSkills.map(skill => skill.slug),
            toolNames: selectedToolNames.filter((name): name is AiToolName =>
              personalToolNames.has(name)
            ),
            attachments: attachmentsForRequest,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            ...(controllerOptions.project
              ? {
                  requestId: crypto.randomUUID(),
                  editorContext: await controllerOptions.project.beforeSend(),
                }
              : {}),
          };
        }
        if (!sendOptions?.skipUserMessagePersistence && !controllerOptions.project) {
          const userMessageResult = await mutations.sendMessage(
            conversation.id,
            currentUserId,
            content,
            undefined,
            { contextJson, confirmServer: true }
          );

          if (!userMessageResult.success) {
            return false;
          }
          requestPayload.originMessageId = userMessageResult.messageId;

          sendOptions?.onUserMessageSent?.();
        }

        const requestController = new AbortController();
        abortController.current = requestController;
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          signal: requestController.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestPayload),
        });
        setActiveTraceId(response.headers?.get('X-AI-Trace-Id') ?? null);

        if (!response.ok) {
          const errorPayload = await readAiChatErrorResponse(response);
          throw new Error(localizeAppError(errorPayload));
        }

        if (!response.body) {
          throw new Error(t('features.messages.ai.sendFailed'));
        }

        attachmentComposer.clearAttachments();
        controllerOptions.project?.onSent?.();
        if (controllerOptions.project && !sendOptions?.skipUserMessagePersistence) {
          sendOptions?.onUserMessageSent?.();
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const streamDecoder = new AssistantChatStreamDecoder();
        let finalText = '';
        let streamErrorMessage: string | null = null;

        const resolveToolLabel = (toolName?: string | null): string | null => {
          if (!toolName) {
            return null;
          }

          return availableTools.find(tool => tool.name === toolName)?.label ?? toolName;
        };

        const handleStreamEvent = (streamEvent: AssistantChatStreamEvent) => {
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
              streamErrorMessage = localizeAppError(streamEvent.error, {
                logUnknown: false,
              });
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

          for (const event of streamDecoder.push(chunk)) {
            handleStreamEvent(event);
          }
        }

        const trailingChunk = decoder.decode();
        if (trailingChunk) {
          for (const event of streamDecoder.push(trailingChunk)) {
            handleStreamEvent(event);
          }
        }

        for (const event of streamDecoder.finish()) {
          handleStreamEvent(event);
        }

        if (finalText.trim()) {
          setAwaitingPersistenceText(finalText.trim());
        } else {
          setStreamingText('');
        }

        setStreamError(null);
        setLastFailedRequest(null);

        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setStreamingText('');
          setAwaitingPersistenceText(null);
          setStreamError(null);
          setLastFailedRequest(null);
          return false;
        }
        console.error('Failed to stream Aria & Kai response:', error);
        const errorMessage =
          error instanceof Error && error.message.trim()
            ? error.message
            : t('features.messages.ai.sendFailed');
        setAwaitingPersistenceText(null);
        setIsCompressing(false);
        setIsToolCalling(false);
        setActiveToolName(null);
        setActiveToolCall(null);

        if (requestPayload) setLastFailedRequest(requestPayload);
        setStreamError(errorMessage);
        toast.error(errorMessage);
        return false;
      } finally {
        abortController.current = null;
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
      controllerOptions.project,
    ]
  );

  const retryLastAssistantMessage = useCallback(async (): Promise<boolean> => {
    if (isSending) {
      return false;
    }

    if (controllerOptions.project?.resumeRequestId && session?.access_token) {
      setIsSending(true);
      setIsThinking(true);
      setStreamingText('');
      setStreamError(null);
      try {
        const requestController = new AbortController();
        abortController.current = requestController;
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          signal: requestController.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            requestId: controllerOptions.project.resumeRequestId,
            resume: true,
          }),
        });
        setActiveTraceId(
          response.headers?.get('X-AI-Trace-Id') ?? controllerOptions.project.resumeRequestId
        );
        if (!response.ok)
          throw new Error(localizeAppError(await readAiChatErrorResponse(response)));
        if (!response.body) throw new Error(t('features.messages.ai.sendFailed'));
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const streamDecoder = new AssistantChatStreamDecoder();
        let finalText = '';
        const handleEvent = (event: AssistantChatStreamEvent) => {
          if (event.type === 'text-delta') {
            finalText += event.text;
            setStreamingText(current => current + event.text);
            setIsThinking(false);
            setIsToolCalling(false);
          } else if (event.type === 'tool-call') {
            const label = availableTools.find(tool => tool.name === event.toolName)?.label;
            setIsThinking(false);
            setIsToolCalling(true);
            setActiveToolName(label ?? event.toolName);
            setActiveToolCall({
              label: label ?? event.toolName,
              preview: buildToolCallPreview(event.toolName, event.args),
            });
          } else if (event.type === 'tool-result') {
            setIsToolCalling(false);
            setIsThinking(true);
            setActiveToolName(null);
            setActiveToolCall(null);
          } else if (event.type === 'compression-start') {
            setIsCompressing(true);
          } else if (event.type === 'error') {
            throw new Error(localizeAppError(event.error, { logUnknown: false }));
          }
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const event of streamDecoder.push(decoder.decode(value, { stream: true }))) {
            handleEvent(event);
          }
        }
        for (const event of streamDecoder.push(decoder.decode())) handleEvent(event);
        for (const event of streamDecoder.finish()) handleEvent(event);
        if (finalText.trim()) setAwaitingPersistenceText(finalText.trim());
        setStreamError(null);
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('features.messages.ai.sendFailed');
        setStreamError(message);
        return false;
      } finally {
        abortController.current = null;
        setIsSending(false);
        setIsThinking(false);
        setIsToolCalling(false);
        setIsCompressing(false);
      }
    }

    if (!lastFailedRequest) return false;

    return sendAssistantMessage(lastFailedRequest.content, {
      skipUserMessagePersistence: true,
      requestOverride: lastFailedRequest,
    });
  }, [
    availableTools,
    conversation.id,
    controllerOptions.project?.resumeRequestId,
    isSending,
    lastFailedRequest,
    sendAssistantMessage,
    session?.access_token,
    t,
  ]);

  const cancelAssistantMessage = useCallback(async () => {
    abortController.current?.abort();
    await controllerOptions.project?.onCancel?.();
  }, [controllerOptions.project]);

  const effectiveSending = isSending || Boolean(controllerOptions.project?.externallyBusy);

  return {
    projectDraftKey: controllerOptions.project
      ? `project-chat-draft:${currentUserId ?? 'anonymous'}:${conversation.id}`
      : undefined,
    activeTraceId,
    isTutorialConversation,
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
    projectContextReferences: controllerOptions.project?.contextReferences ?? [],
    projectContextOptions: controllerOptions.project?.contextOptions ?? [],
    addProjectContext: controllerOptions.project?.addContextReference,
    removeProjectContext: controllerOptions.project?.removeContextReference,
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
    retryLastAssistantMessage,
    canRetry:
      Boolean(lastFailedRequest || controllerOptions.project?.resumeRequestId) && !effectiveSending,
    sharesAttachmentsWithProject: Boolean(controllerOptions.project),
    streamingText,
    streamError,
    isSending: effectiveSending,
    cancelAssistantMessage,
    canCancel: isSending || Boolean(controllerOptions.project?.onCancel),
    isCompressing,
    isThinking,
    isToolCalling,
    activeToolName,
    activeToolCall,
  };
}

export type AssistantChatController = ReturnType<typeof useAssistantChat>;
