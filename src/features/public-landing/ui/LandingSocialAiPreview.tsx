'use client';

import { useMemo } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { ARIA_KAI_AVATAR_URL, ARIA_KAI_USER_ID } from '@/features/assistant/constants';
import {
  translate as translateText,
  useTranslation,
} from '@/features/shared/hooks/use-translation';
import { MessageBubble } from '@/features/messages/ui/MessageBubble';
import { ConversationHeader } from '@/features/messages/ui/ConversationHeader';
import { AssistantMessageInput } from '@/features/messages/ui/AssistantMessageInput';
import type { Conversation, Message } from '@/features/messages/types/message.types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';

const landingPreviewUserId = 'landing-preview-user';
type LandingAssistantChatPreview = Parameters<typeof AssistantMessageInput>[0]['assistantChat'];

export function LandingSocialAiPreview() {
  const { t } = useTranslation();
  const conversation = useMemo<Conversation>(
    () =>
      ({
        id: 'landing-ai-conversation',
        type: 'direct',
        status: 'accepted',
        name: t('pages.home.publicLanding.social.aiTitle'),
        pinned: true,
        assistant_for_user_id: landingPreviewUserId,
        participants: [
          {
            id: 'landing-current-user-participant',
            user_id: landingPreviewUserId,
            unread_count: 0,
            user: {
              id: landingPreviewUserId,
              first_name: 'Jonas',
              last_name: 'Parliamentary group',
              handle: 'jonas',
              avatar: null,
            },
          },
          {
            id: 'landing-ai-participant',
            user_id: ARIA_KAI_USER_ID,
            unread_count: 0,
            user: {
              id: ARIA_KAI_USER_ID,
              first_name: 'Aria',
              last_name: 'Kai',
              handle: 'aria-kai',
              avatar: ARIA_KAI_AVATAR_URL,
            },
          },
        ],
        messages: [],
      }) as unknown as Conversation,
    [t]
  );
  const messages = useMemo<Message[]>(
    () =>
      [
        {
          id: 'landing-message-1',
          conversation_id: conversation.id,
          sender_id: landingPreviewUserId,
          content: t('pages.home.publicLanding.social.aiPrompt'),
          created_at: Date.now() - 1000 * 60 * 9,
          context_json: null,
          is_read: true,
          sender: {
            id: landingPreviewUserId,
            first_name: 'Jonas',
            last_name: 'Parliamentary group',
            handle: 'jonas',
            avatar: null,
          },
        },
        {
          id: 'landing-message-2',
          conversation_id: conversation.id,
          sender_id: ARIA_KAI_USER_ID,
          content: `${t('pages.home.publicLanding.social.aiResponseTitle')}\n${t('pages.home.publicLanding.social.aiResponse')}`,
          created_at: Date.now() - 1000 * 60 * 7,
          context_json: null,
          is_read: true,
          sender: {
            id: ARIA_KAI_USER_ID,
            first_name: 'Aria',
            last_name: 'Kai',
            handle: 'aria-kai',
            avatar: ARIA_KAI_AVATAR_URL,
          },
        },
        {
          id: 'landing-message-3',
          conversation_id: conversation.id,
          sender_id: 'landing-local-branch',
          content: t('pages.home.publicLanding.social.messages.third.body'),
          created_at: Date.now() - 1000 * 60 * 3,
          context_json: null,
          is_read: true,
          sender: {
            id: 'landing-local-branch',
            first_name: 'Local',
            last_name: 'branch north',
            handle: 'branch-north',
            avatar: null,
          },
        },
      ] as unknown as Message[],
    [conversation.id, t]
  );
  const assistantChat = useMemo<LandingAssistantChatPreview>(() => {
    const model = {
      provider: 'openai',
      id: 'gpt-4.1-mini',
      label: translateText('generated.inline.0495_gpt_4_1_mini_14652a67'),
      source: 'app',
      free: false,
      supports_reasoning_effort: true,
      context_window: 128000,
    };
    const tools = [
      {
        name: 'search_polity_entities',
        label: t('features.messages.ai.searchToolGroup'),
        kind: 'search',
        description: translateText(
          'generated.inline.0496_find_amendments_events_groups_and_agenda_item_06723b3d'
        ),
        enabled: true,
      },
      {
        name: 'create_agenda_item',
        label: t('features.events.agenda.createItem'),
        kind: 'create',
        description: translateText(
          'generated.inline.0497_prepare_a_structured_agenda_item_from_the_cur_64bd1d1d'
        ),
        enabled: true,
      },
    ];
    const skills = [
      {
        slug: 'amendment-drafting',
        name: t('pages.home.publicLanding.social.aiTitle'),
        aliases: ['motion-review', 'policy-wording'],
        isBuiltIn: true,
        systemPrompt: 'Review political amendments and produce neutral procedural wording.',
        enabled: true,
      },
    ];
    const noop = () => undefined;

    return {
      models: [model],
      isCatalogLoading: false,
      refreshCatalog: async () => undefined,
      selectedModel: model,
      selectedModelKey: 'openai:gpt-4.1-mini',
      setSelectedModelKey: noop,
      reasoningEffort: 'medium',
      setReasoningEffort: noop,
      availableTools: tools,
      selectedTools: tools,
      selectedToolNames: tools.map(tool => tool.name),
      setToolSelection: noop,
      setToolGroupSelection: noop,
      toggleSelectedToolName: noop,
      availableSkills: skills,
      selectedSkills: skills,
      selectedSkillSlugs: skills.map(skill => skill.slug),
      setSkillSelection: noop,
      toggleSelectedSkillSlug: noop,
      selectedAttachments: [],
      attachmentOptions: [],
      resolveAttachmentCardData: async () => null,
      addAttachment: noop,
      removeAttachment: noop,
      clearAttachments: noop,
      addUploadedFiles: async () => undefined,
      isUploadingAttachments: false,
      uploadingAttachmentName: null,
      createSkill: ({ slug, name }: { slug?: string; name: string }) => slug || name,
      sendAssistantMessage: async () => true,
      streamingText: '',
      streamError: null,
      isSending: false,
      isCompressing: false,
      isThinking: false,
      isToolCalling: false,
      activeToolName: null,
      activeToolCall: null,
    } as unknown as LandingAssistantChatPreview;
  }, [t]);

  return (
    <div className="landing-social-ai-preview grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
      <Card className="h-full min-w-0 overflow-hidden">
        <CardHeader separator className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand/10 text-brand flex h-9 w-9 items-center justify-center rounded-md">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('pages.home.publicLanding.social.chatTitle')}
              </CardTitle>
              <CardDescription>{t('pages.home.publicLanding.social.chatSubtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <MessageBubble
            message={
              {
                id: 'landing-chat-1',
                sender_id: 'landing-policy-lead',
                content: t('pages.home.publicLanding.social.messages.first.body'),
                created_at: Date.now() - 1000 * 60 * 12,
                context_json: null,
                is_read: true,
                sender: {
                  id: 'landing-policy-lead',
                  first_name: 'Maya',
                  last_name: 'Policy lead',
                  avatar: null,
                },
              } as unknown as Message
            }
            isOwnMessage={false}
          />
          <MessageBubble
            message={
              {
                id: 'landing-chat-2',
                sender_id: landingPreviewUserId,
                content: t('pages.home.publicLanding.social.messages.second.body'),
                created_at: Date.now() - 1000 * 60 * 10,
                context_json: null,
                is_read: true,
                sender: {
                  id: landingPreviewUserId,
                  first_name: 'Jonas',
                  last_name: 'Parliamentary group',
                  avatar: null,
                },
              } as unknown as Message
            }
            isOwnMessage
          />
        </CardContent>
      </Card>

      <Card className="landing-ai-conversation-card h-full min-w-0 overflow-hidden">
        <ConversationHeader
          conversation={conversation}
          currentUserId={landingPreviewUserId}
          isOnline={false}
          onBack={() => undefined}
          onTogglePin={() => undefined}
          onDeleteClick={() => undefined}
          onMembersClick={() => undefined}
          onRenameConversation={async () => true}
        />
        <CardContent className="space-y-4 p-4">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Sparkles className="landing-ai-spark text-brand h-4 w-4" />
            {t('pages.home.publicLanding.social.aiSubtitle')}
          </div>
          {messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.sender?.id === landingPreviewUserId}
            />
          ))}
        </CardContent>
        <AssistantMessageInput assistantChat={assistantChat} />
      </Card>
    </div>
  );
}
