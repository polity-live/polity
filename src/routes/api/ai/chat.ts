import { streamText } from 'ai';
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { DEFAULT_AI_SKILLS_BY_SLUG } from '@/features/assistant/logic/defaultAiSkills';
import {
  dedupeAiChatAttachments,
  extractAiChatAttachmentsFromToolResults,
} from '@/lib/ai/attachments';
import { buildCurrentTurnUserContent, buildSystemPrompt } from '@/lib/ai/prompts';
import { getSession } from '@/lib/supabase/server';
import {
  enrichAiAttachmentsForPrompt,
  enrichAiAttachmentsFromContextJson,
  getAiSkillsBySlugs,
  getAiToolsByNames,
  getAssistantConversationForUser,
  getConversationMessagesForAi,
  isAssistantSender,
  persistAssistantMessage,
  touchAiCredential,
} from '@/server/ai-db';
import { getAiCatalog, resolveLanguageModelForUser } from '@/server/ai-models';
import { buildAiTools } from '@/server/ai-tools';
import { aiChatRequestSchema } from '@/server/ai-types';

function getStreamErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'AI chat streaming failed.';
}

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

    const customSkills = await getAiSkillsBySlugs(session.user.id, body.skillSlugs);
    const toolOverrides = await getAiToolsByNames(session.user.id, body.toolNames);
    const customSkillMap = new Map(customSkills.map(skill => [skill.slug, skill]));
    const toolOverrideMap = new Map(toolOverrides.map(tool => [tool.tool_name, tool]));
    const selectedSkills = body.skillSlugs
      .map(skillSlug => {
        const customSkill = customSkillMap.get(skillSlug);
        if (customSkill?.enabled === false) {
          return null;
        }

        if (customSkill) {
          return {
            slug: customSkill.slug,
            name: customSkill.name,
            systemPrompt: customSkill.system_prompt,
          };
        }

        const builtInSkill = DEFAULT_AI_SKILLS_BY_SLUG[skillSlug];
        if (!builtInSkill) {
          return null;
        }

        return {
          slug: builtInSkill.slug,
          name: builtInSkill.name,
          systemPrompt: builtInSkill.systemPrompt,
        };
      })
      .filter((skill): skill is NonNullable<typeof skill> => skill !== null);
    const selectedToolNames = body.toolNames.filter(
      toolName => toolOverrideMap.get(toolName)?.enabled !== false
    );

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

    const tools = selectedToolNames.length > 0 ? buildAiTools(session.user.id) : undefined;
    const activeToolNames = tools
      ? selectedToolNames.filter((toolName): toolName is keyof typeof tools => toolName in tools)
      : [];
    const toolAttachments: ReturnType<typeof dedupeAiChatAttachments> = [];

    const result = streamText({
      model,
      system: buildSystemPrompt(selectedSkills),
      messages,
      tools,
      maxSteps: tools ? 4 : 1,
      providerOptions,
      experimental_activeTools: tools ? activeToolNames : undefined,
      onStepFinish: async stepResult => {
        try {
          toolAttachments.push(...extractAiChatAttachmentsFromToolResults(stepResult.toolResults));
        } catch (error) {
          console.error('Failed to collect AI tool attachments:', error);
        }
      },
      onFinish: async ({ text, toolResults }) => {
        try {
          const trimmed = text.trim();

          if (!trimmed) {
            return;
          }

          const attachments = dedupeAiChatAttachments([
            ...toolAttachments,
            ...extractAiChatAttachmentsFromToolResults(toolResults),
          ]);

          await persistAssistantMessage(body.conversationId, trimmed, attachments);

          if (credentialProvider) {
            await touchAiCredential(session.user.id, credentialProvider);
          }
        } catch (error) {
          console.error('Failed to persist AI chat response:', error);
        }
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const part of result.fullStream) {
            switch (part.type) {
              case 'text-delta': {
                controller.enqueue(
                  encoder.encode(
                    `${JSON.stringify({ type: 'text-delta', text: part.textDelta })}\n`
                  )
                );
                break;
              }
              case 'tool-call-delta': {
                controller.enqueue(
                  encoder.encode(`${JSON.stringify({ type: 'tool-call-delta' })}\n`)
                );
                break;
              }
              case 'tool-call': {
                controller.enqueue(
                  encoder.encode(
                    `${JSON.stringify({
                      type: 'tool-call',
                      toolName: String(part.toolName),
                      args: 'args' in part ? part.args : null,
                    })}\n`
                  )
                );
                break;
              }
              case 'tool-result': {
                controller.enqueue(
                  encoder.encode(
                    `${JSON.stringify({ type: 'tool-result', toolName: String(part.toolName) })}\n`
                  )
                );
                break;
              }
              case 'error': {
                controller.enqueue(
                  encoder.encode(
                    `${JSON.stringify({
                      type: 'error',
                      message: getStreamErrorMessage(part.error),
                    })}\n`
                  )
                );
                controller.close();
                return;
              }
              default:
                break;
            }
          }

          controller.close();
        } catch (error) {
          console.error('AI chat stream failed after response started:', error);
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: 'error',
                message: getStreamErrorMessage(error),
              })}\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  },
});
