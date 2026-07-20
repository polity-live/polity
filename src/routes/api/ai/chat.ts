import { stepCountIs, streamText } from 'ai';
import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';
import { DEFAULT_AI_SKILLS_BY_SLUG } from '@/features/assistant/logic/defaultAiSkills';
import {
  dedupeAiChatAttachments,
  extractAiChatAttachmentsFromToolResults,
  extractAiPresentationsFromToolResults,
} from '@/lib/ai/attachments';
import {
  createAiMessageContext,
  dedupeAiPresentations,
  type AiPresentationBlock,
} from '@/lib/ai/messageContext';
import { compressConversationHistory } from '@/lib/ai/historyCompression';
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
import { buildAiTools, buildCurrentUserScopePrompt } from '@/server/ai-tools';
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

export type AiChatErrorCode =
  'INVALID_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'MODEL_UNAVAILABLE' | 'CHAT_SETUP_FAILED';

export interface AiChatErrorResponse {
  code: AiChatErrorCode;
  message: string;
}

function aiChatError(code: AiChatErrorCode, message: string, status: number): Response {
  return Response.json({ code, message } satisfies AiChatErrorResponse, { status });
}

export async function handleAiChatRequest(request: Request): Promise<Response> {
  try {
    const session = await getSession(request);

    if (!session?.user) {
      return aiChatError('UNAUTHORIZED', 'Authentication is required.', 401);
    }

    const body = aiChatRequestSchema.parse(await request.json());
    const conversation = await getAssistantConversationForUser(
      session.user.id,
      body.conversationId
    );

    if (!conversation) {
      return aiChatError('FORBIDDEN', 'This assistant conversation is not available.', 403);
    }

    const catalog = await getAiCatalog(session.user.id);
    const isAllowedModel = catalog.models.some(
      model => model.provider === body.model.provider && model.id === body.model.id
    );

    if (!isAllowedModel) {
      return aiChatError(
        'MODEL_UNAVAILABLE',
        'Selected model is not available for this user.',
        400
      );
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
    const selectedCatalogModel = catalog.models.find(
      model => model.provider === body.model.provider && model.id === body.model.id
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

    const tools = buildAiTools(session.user.id, body.timeZone);
    const activeToolNames: (keyof typeof tools)[] = [
      ...(selectedToolNames.filter(toolName => toolName in tools) as (keyof typeof tools)[]),
      'present_findings',
    ];
    const toolAttachments: ReturnType<typeof dedupeAiChatAttachments> = [];
    const toolPresentations: AiPresentationBlock[] = [];
    const currentUserContext = await buildCurrentUserScopePrompt(session.user.id);
    const systemPrompt = buildSystemPrompt(selectedSkills, currentUserContext);
    const compressedHistory = compressConversationHistory({
      systemPrompt,
      messages,
      contextWindow: selectedCatalogModel?.context_window ?? null,
    });

    const result = streamText({
      model,
      system: systemPrompt,
      messages: compressedHistory.messages,
      tools,
      stopWhen: stepCountIs(4),
      providerOptions,
      activeTools: activeToolNames,
      onStepFinish: async stepResult => {
        try {
          toolAttachments.push(...extractAiChatAttachmentsFromToolResults(stepResult.toolResults));
          toolPresentations.push(...extractAiPresentationsFromToolResults(stepResult.toolResults));
        } catch (error) {
          console.error('Failed to collect AI tool attachments:', error);
        }
      },
      onFinish: async ({ text, toolResults }) => {
        try {
          const attachments = dedupeAiChatAttachments([
            ...toolAttachments,
            ...extractAiChatAttachmentsFromToolResults(toolResults),
          ]);
          const presentations = dedupeAiPresentations([
            ...toolPresentations,
            ...extractAiPresentationsFromToolResults(toolResults),
          ]);
          const trimmed = text.trim();

          if (!trimmed && attachments.length === 0 && presentations.length === 0) return;

          await persistAssistantMessage(
            body.conversationId,
            trimmed,
            createAiMessageContext(attachments, presentations)
          );

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
          if (compressedHistory.wasCompressed) {
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({
                  type: 'compression-start',
                  compressedMessageCount: compressedHistory.compressedMessageCount,
                })}\n`
              )
            );
          }

          for await (const part of result.fullStream) {
            switch (part.type) {
              case 'text-delta': {
                controller.enqueue(
                  encoder.encode(`${JSON.stringify({ type: 'text-delta', text: part.text })}\n`)
                );
                break;
              }
              case 'tool-call': {
                controller.enqueue(
                  encoder.encode(
                    `${JSON.stringify({
                      type: 'tool-call',
                      toolName: String(part.toolName),
                      args: part.input,
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
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return aiChatError('INVALID_REQUEST', 'The AI chat request is invalid.', 400);
    }

    console.error('Failed to prepare AI chat stream:', error);
    return aiChatError('CHAT_SETUP_FAILED', 'The AI response could not be started.', 500);
  }
}

export const Route = createFileRoute('/api/ai/chat')({
  server: {
    handlers: {
      POST: ({ request }) => handleAiChatRequest(request),
    },
  },
});
