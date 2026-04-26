import { streamText } from 'ai';
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { getSession } from '@/lib/supabase/server';
import {
  enrichAiAttachmentsForPrompt,
  enrichAiAttachmentsFromContextJson,
  getAiSkillBySlug,
  getAssistantConversationForUser,
  getConversationMessagesForAi,
  isAssistantSender,
  persistAssistantMessage,
  touchAiCredential,
} from '@/server/ai-db';
import { getAiCatalog, resolveLanguageModelForUser } from '@/server/ai-models';
import { buildCurrentTurnUserContent, buildSystemPrompt } from '@/server/ai-prompts';
import { aiChatRequestSchema } from '@/server/ai-types';

export const APIRoute = createAPIFileRoute('/api/ai/chat')({
  POST: async ({ request }) => {
    const session = await getSession(request);

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = aiChatRequestSchema.parse(await request.json());
    const conversation = await getAssistantConversationForUser(
      session.user.id,
      body.conversationId
    );

    if (!conversation) {
      return new Response('Forbidden', { status: 403 });
    }

    const catalog = await getAiCatalog(session.user.id);
    const isAllowedModel = catalog.models.some(
      model => model.provider === body.model.provider && model.id === body.model.id
    );

    if (!isAllowedModel) {
      return new Response('Selected model is not available for this user.', { status: 400 });
    }

    const skill = body.skillSlug ? await getAiSkillBySlug(session.user.id, body.skillSlug) : null;
    const { model, providerOptions, credentialProvider } = await resolveLanguageModelForUser(
      session.user.id,
      body.model,
      body.reasoningEffort
    );

    const history = await getConversationMessagesForAi(body.conversationId);
    const historyMessages = await Promise.all(
      history.map(async message => ({
        role: isAssistantSender(message.sender_id) ? ('assistant' as const) : ('user' as const),
        content: isAssistantSender(message.sender_id)
          ? (message.content ?? '')
          : buildCurrentTurnUserContent(
              message.content ?? '',
              await enrichAiAttachmentsFromContextJson(message.context_json)
            ),
      }))
    );

    const enrichedAttachments = await enrichAiAttachmentsForPrompt(body.attachments);
    const currentTurnContent = buildCurrentTurnUserContent(body.content, enrichedAttachments);
    const shouldAppendCurrentTurn = (() => {
      const lastMessage = historyMessages.at(-1);
      if (!lastMessage) {
        return true;
      }

      return !(lastMessage.role === 'user' && lastMessage.content === currentTurnContent);
    })();

    const messages = shouldAppendCurrentTurn
      ? [...historyMessages, { role: 'user' as const, content: currentTurnContent }]
      : historyMessages;

    const result = streamText({
      model,
      system: buildSystemPrompt(skill?.slug ?? body.skillSlug ?? null),
      messages,
      providerOptions,
      onFinish: async ({ text }) => {
        const trimmed = text.trim();

        if (!trimmed) {
          return;
        }

        await persistAssistantMessage(body.conversationId, trimmed);

        if (credentialProvider) {
          await touchAiCredential(session.user.id, credentialProvider);
        }
      },
    });

    return result.toTextStreamResponse();
  },
});
