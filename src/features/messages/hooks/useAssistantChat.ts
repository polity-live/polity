import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DEFAULT_AI_SKILLS } from '@/features/assistant/logic/defaultAiSkills';
import { buildAgendaItemsByEventId } from '@/features/search/logic/searchFiltering';
import { mapMosaicToContentItems } from '@/features/search/logic/searchMappers';
import type { SearchContentItem, SearchResultItem } from '@/features/search/types/search.types';
import type { AiChatAttachment, AiProvider, AiReasoningEffort } from '@/server/ai-types';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useSearchData } from '@/features/search/hooks/useSearchData';
import { useAuth } from '@/providers/auth-provider';
import { useAiActions } from '@/zero/ai/useAiActions';
import { useAiState } from '@/zero/ai/useAiState';
import { useVoteState } from '@/zero/votes/useVoteState';
import type { Conversation } from '../types/message.types';
import {
  buildAssistantAttachmentOption,
  buildVoteSearchItem,
  slugifySkillName,
  type AssistantAttachmentOption,
} from '../logic/assistantComposer';
import { useMessageMutations } from './useMessageMutations';

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
  isDefault: boolean;
  systemPrompt: string;
}

export interface CreateAssistantSkillInput {
  name: string;
  slug?: string;
  aliases?: string;
  systemPrompt: string;
}

const FREE_ROUTER_MODEL_LABEL = 'free models router';

function getModelKey(model: Pick<AiCatalogModel, 'provider' | 'id'>): string {
  return `${model.provider}:${model.id}`;
}

function getPreferredDefaultModelKey(models: readonly AiCatalogModel[]): string | null {
  const labeledFreeRouterModel = models.find(
    model => model.label.trim().toLowerCase() === FREE_ROUTER_MODEL_LABEL
  );

  if (labeledFreeRouterModel) {
    return getModelKey(labeledFreeRouterModel);
  }

  const fallbackFreeRouterModel = models.find(
    model => model.provider === 'openrouter' && model.source === 'app' && model.free
  );

  if (fallbackFreeRouterModel) {
    return getModelKey(fallbackFreeRouterModel);
  }

  return models[0] ? getModelKey(models[0]) : null;
}

export function useAssistantChat(conversation: Conversation, currentUserId?: string) {
  const { session } = useAuth();
  const { t } = useTranslation();
  const { skills } = useAiState();
  const aiActions = useAiActions();
  const mutations = useMessageMutations();
  const { data } = useSearchData();
  const { votesWithDetails } = useVoteState({ includeVotesWithDetails: true });

  const [models, setModels] = useState<AiCatalogModel[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<AiReasoningEffort>('medium');
  const [selectedSkillSlug, setSelectedSkillSlug] = useState<string | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<AiChatAttachment[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [awaitingPersistenceText, setAwaitingPersistenceText] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const availableSkills = useMemo<AssistantSkillOption[]>(() => {
    const mergedSkills = new Map<string, AssistantSkillOption>();

    for (const skill of DEFAULT_AI_SKILLS) {
      mergedSkills.set(skill.slug, {
        slug: skill.slug,
        name: skill.name,
        aliases: [...skill.aliases],
        isDefault: true,
        systemPrompt: skill.systemPrompt,
      });
    }

    for (const skill of skills) {
      mergedSkills.set(skill.slug, {
        slug: skill.slug,
        name: skill.name,
        aliases: skill.aliases
          .split(',')
          .map(alias => alias.trim())
          .filter(Boolean),
        isDefault: false,
        systemPrompt: skill.system_prompt,
      });
    }

    return [...mergedSkills.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [skills]);

  const agendaItemsByEventId = useMemo(
    () =>
      buildAgendaItemsByEventId(
        (data?.agendaItems ?? []) as Parameters<typeof buildAgendaItemsByEventId>[0]
      ),
    [data?.agendaItems]
  );

  const mosaicResults = useMemo<SearchResultItem[]>(
    () => [
      ...(data?.$users ?? []).map(item => ({ ...item, _type: 'user' as const })),
      ...(data?.groups ?? []).map(item => ({ ...item, _type: 'group' as const })),
      ...(data?.statements ?? []).map(item => ({ ...item, _type: 'statement' as const })),
      ...(data?.blogs ?? []).map(item => ({ ...item, _type: 'blog' as const })),
      ...(data?.amendments ?? []).map(item => ({ ...item, _type: 'amendment' as const })),
      ...(data?.events ?? []).map(item => ({ ...item, _type: 'event' as const })),
      ...(data?.todos ?? []).map(item => ({ ...item, _type: 'todo' as const })),
      ...(data?.elections ?? []).map(item => ({ ...item, _type: 'election' as const })),
    ],
    [
      data?.$users,
      data?.groups,
      data?.statements,
      data?.blogs,
      data?.amendments,
      data?.events,
      data?.todos,
      data?.elections,
    ]
  );

  const searchItems = useMemo<SearchContentItem[]>(() => {
    const baseItems = mapMosaicToContentItems(mosaicResults, agendaItemsByEventId);
    const voteItems = votesWithDetails.map(buildVoteSearchItem);
    return [...baseItems, ...voteItems];
  }, [agendaItemsByEventId, mosaicResults, votesWithDetails]);

  const attachmentOptions = useMemo(
    () =>
      searchItems
        .map(buildAssistantAttachmentOption)
        .filter((option): option is AssistantAttachmentOption => option !== null),
    [searchItems]
  );

  const selectedModel = useMemo(
    () => models.find(model => getModelKey(model) === selectedModelKey) ?? null,
    [models, selectedModelKey]
  );

  const preferredDefaultModelKey = useMemo(() => getPreferredDefaultModelKey(models), [models]);

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
      toast.error('Failed to load AI models');
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

    const selectionStillExists = models.some(model => getModelKey(model) === selectedModelKey);

    if (!selectionStillExists && preferredDefaultModelKey) {
      setSelectedModelKey(preferredDefaultModelKey);
    }
  }, [models, preferredDefaultModelKey, selectedModelKey]);

  useEffect(() => {
    if (!selectedSkillSlug) {
      return;
    }

    const skillStillExists = availableSkills.some(skill => skill.slug === selectedSkillSlug);
    if (!skillStillExists) {
      setSelectedSkillSlug(null);
    }
  }, [availableSkills, selectedSkillSlug]);

  useEffect(() => {
    setSelectedAttachments([]);
    setStreamingText('');
    setAwaitingPersistenceText(null);
    setIsThinking(false);
    setIsSending(false);
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

  const addAttachment = useCallback((option: AssistantAttachmentOption) => {
    setSelectedAttachments(currentAttachments => {
      const alreadySelected = currentAttachments.some(
        attachment =>
          attachment.entityType === option.attachment.entityType &&
          attachment.entityId === option.attachment.entityId
      );

      return alreadySelected ? currentAttachments : [...currentAttachments, option.attachment];
    });
  }, []);

  const removeAttachment = useCallback((entityType: AiAttachmentEntity, entityId: string) => {
    setSelectedAttachments(currentAttachments =>
      currentAttachments.filter(
        attachment => attachment.entityType !== entityType || attachment.entityId !== entityId
      )
    );
  }, []);

  const clearAttachments = useCallback(() => {
    setSelectedAttachments([]);
  }, []);

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
    async (content: string): Promise<boolean> => {
      if (!currentUserId) {
        toast.error(
          t(
            'features.messages.ai.authRequired',
            'You need to be signed in to chat with Aria & Kai.'
          )
        );
        return false;
      }

      if (!session?.access_token) {
        toast.error(
          t(
            'features.messages.ai.sessionMissing',
            'Your session has expired. Please sign in again.'
          )
        );
        return false;
      }

      if (!selectedModel) {
        toast.error(
          t(
            'features.messages.ai.modelRequired',
            'Choose an AI model first. Free OpenRouter models appear automatically when configured.'
          )
        );
        return false;
      }

      setIsSending(true);
      setIsThinking(true);
      setStreamingText('');
      setAwaitingPersistenceText(null);

      const selectedSkill = selectedSkillSlug
        ? (availableSkills.find(skill => skill.slug === selectedSkillSlug) ?? null)
        : null;

      const attachmentsForRequest: AiChatAttachment[] = [...selectedAttachments];

      if (selectedSkill) {
        attachmentsForRequest.push({
          entityType: 'skill',
          entityId: selectedSkill.slug,
          title: selectedSkill.name,
          subtitle: selectedSkill.isDefault ? 'Built-in skill' : 'Custom skill',
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
            skillSlug: selectedSkillSlug,
            attachments: attachmentsForRequest,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error((await response.text()) || 'AI chat request failed');
        }

        clearAttachments();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let finalText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) {
            continue;
          }

          finalText += chunk;
          setStreamingText(currentText => currentText + chunk);
          setIsThinking(false);
        }

        const trailingChunk = decoder.decode();
        if (trailingChunk) {
          finalText += trailingChunk;
          setStreamingText(currentText => currentText + trailingChunk);
          setIsThinking(false);
        }

        if (finalText.trim()) {
          setAwaitingPersistenceText(finalText.trim());
        } else {
          setStreamingText('');
        }

        return true;
      } catch (error) {
        console.error('Failed to stream Aria & Kai response:', error);
        setStreamingText('');
        setAwaitingPersistenceText(null);
        toast.error(
          t('features.messages.ai.sendFailed', 'Failed to get a response from Aria & Kai.')
        );
        return false;
      } finally {
        setIsSending(false);
        setIsThinking(false);
      }
    },
    [
      clearAttachments,
      conversation.id,
      currentUserId,
      mutations,
      reasoningEffort,
      availableSkills,
      selectedAttachments,
      selectedModel,
      selectedSkillSlug,
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
    availableSkills,
    selectedSkillSlug,
    setSelectedSkillSlug,
    selectedAttachments,
    attachmentOptions,
    addAttachment,
    removeAttachment,
    clearAttachments,
    createSkill,
    sendAssistantMessage,
    streamingText,
    isSending,
    isThinking,
  };
}
