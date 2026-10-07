import { stepCountIs, tool } from 'ai';
import { streamText } from '@/server/ai-generation';
import {
  startAiTrace,
  traceAiRequest,
  logAiEvent,
  normalizeAiError,
  type AiTraceContext,
} from '@/server/ai-trace';
import { createFileRoute } from '@tanstack/react-router';
import { z, ZodError } from 'zod';
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
import { DEFAULT_ASSISTANT_CONVERSATION_NAME } from '@/lib/ai/chatTitle';
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
  setAssistantConversationTitle,
  touchAiCredential,
} from '@/server/ai-db';
import { getAiCatalog, resolveLanguageModelForUser } from '@/server/ai-models';
import { buildAiTools, buildCurrentUserScopePrompt } from '@/server/ai-tools';
import { aiChatRequestSchema } from '@/server/ai-types';
import { matchesAiModel } from '@/lib/ai/models';
import { aiErrorCode } from '@/lib/ai/errors';
import { appErrorHttpBody, type AppErrorCode } from '@/features/shared/errors/app-error';

const INTERNAL_CHAT_TITLE_TOOL_NAME = 'set_chat_title';
const CHAT_TITLE_SYSTEM_PROMPT = [
  'This is the first user message in a new assistant chat.',
  `Before answering, call ${INTERNAL_CHAT_TITLE_TOOL_NAME} exactly once.`,
  'Create a specific chat title that summarizes the user request in 3 to 8 meaningful words.',
  'Use the language of the user request, avoid generic titles, and keep the title at or below 60 characters.',
  'Pass the title as plain text only. Do not use Markdown, formatting characters, escape sequences, quotation marks, or underscores as word separators.',
].join('\n');

function getStreamError(error: unknown) {
  return appErrorHttpBody(aiErrorCode(error)).error;
}

function aiChatError(code: AppErrorCode, status: number): Response {
  return Response.json(appErrorHttpBody(code), { status });
}

export async function handleAiChatRequest(request: Request): Promise<Response> {
  let trace: AiTraceContext | undefined;
  try {
    const session = await getSession(request);

    if (!session?.user) {
      return aiChatError('permission_denied', 401);
    }

    const body = aiChatRequestSchema.parse(await request.json());
    if (body.resume || body.requestId) {
      const { handleProjectAiChat } = await import('@/server/project-chat/run');
      const projectResponse = await handleProjectAiChat(session.user.id, body, request);
      if (projectResponse) return projectResponse;
    }
    if (body.resume) return aiChatError('permission_denied', 403);
    const conversation = await getAssistantConversationForUser(
      session.user.id,
      body.conversationId
    );

    if (!conversation) {
      return aiChatError('permission_denied', 403);
    }

    const history = await getConversationMessagesForAi(body.conversationId);
    const origin = body.originMessageId
      ? history.find(
          message => message.id === body.originMessageId && message.sender_id === session.user.id
        )
      : [...history]
          .reverse()
          .find(
            message => message.sender_id === session.user.id && message.content === body.content
          );
    if (body.originMessageId && !origin) return aiChatError('validation_failed', 400);
    const context = await startAiTrace(
      {
        traceId: origin?.id ?? crypto.randomUUID(),
        actorId: session.user.id,
        conversationId: body.conversationId,
        originMessageId: origin?.id,
        surface: 'chat',
        invocation: 'assistant_chat',
        retryProvider: true,
      },
      { content: body.content, attachments: body.attachments },
      origin?.content ?? body.content
    );
    trace = context;
    return await traceAiRequest(context, async () => {
      const catalog = await getAiCatalog(session.user.id);
      const isAllowedModel = catalog.models.some(model => matchesAiModel(model, body.model));

      if (!isAllowedModel) {
        return aiChatError('ai_model_unavailable', 400);
      }

      const tutorialSkillSlug = conversation.tutorial_run_id ? 'live-tutorial' : null;
      const requestedSkillSlugs = tutorialSkillSlug
        ? Array.from(new Set([...body.skillSlugs, tutorialSkillSlug]))
        : body.skillSlugs;
      const requestedToolNames = conversation.tutorial_run_id
        ? Array.from(new Set([...body.toolNames, 'create_todo' as const]))
        : body.toolNames;
      const customSkills = await getAiSkillsBySlugs(session.user.id, requestedSkillSlugs);
      const toolOverrides = await getAiToolsByNames(session.user.id, requestedToolNames);
      const customSkillMap = new Map(customSkills.map(skill => [skill.slug, skill]));
      const toolOverrideMap = new Map(toolOverrides.map(tool => [tool.tool_name, tool]));
      const selectedSkills = requestedSkillSlugs
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
      const selectedToolNames = requestedToolNames.filter(
        toolName => toolOverrideMap.get(toolName)?.enabled !== false
      );
      const selectedCatalogModel = catalog.models.find(model => matchesAiModel(model, body.model));

      const { model, providerOptions, credentialProvider } = await resolveLanguageModelForUser(
        session.user.id,
        body.model,
        body.reasoningEffort
      );

      const persistedUserMessageCount = history.filter(
        message => !isAssistantSender(message.sender_id)
      ).length;
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
      const effectiveUserMessageCount =
        persistedUserMessageCount + (shouldAppendCurrentTurn ? 1 : 0);
      const shouldEnableChatTitleTool =
        conversation.name === DEFAULT_ASSISTANT_CONVERSATION_NAME &&
        effectiveUserMessageCount === 1;

      const tools = {
        ...buildAiTools(session.user.id, body.timeZone, body.content, body.attachments, {
          model: body.model.source ? body.model : undefined,
          reasoningEffort: body.reasoningEffort,
        }),
        ...(shouldEnableChatTitleTool
          ? {
              [INTERNAL_CHAT_TITLE_TOOL_NAME]: tool({
                description:
                  'Set a concise title for this new assistant chat. This internal tool is available only for the first user message.',
                inputSchema: z.object({
                  title: z
                    .string()
                    .min(1)
                    .max(200)
                    .describe(
                      'A specific plain-text title with 3 to 8 meaningful words in the language of the user request, without Markdown, escape sequences, quotation marks, or underscore separators, and at most 60 characters.'
                    ),
                }),
                execute: async ({ title }) => {
                  try {
                    const updated = await setAssistantConversationTitle(
                      session.user.id,
                      body.conversationId,
                      title
                    );
                    return { updated };
                  } catch (error) {
                    logAiEvent('ai.operation.failed', {
                      operation: 'Failed to set AI chat title:',
                      ...normalizeAiError(error),
                    });
                    return { updated: false };
                  }
                },
              }),
            }
          : {}),
      };
      const activeToolNameSet = new Set<keyof typeof tools>([
        ...(selectedToolNames.filter(toolName => toolName in tools) as (keyof typeof tools)[]),
        'read_polity_docs',
        'present_findings',
        'studio_generate_suggestion',
        'search_polity_entities',
      ]);
      if (shouldEnableChatTitleTool) {
        activeToolNameSet.add(INTERNAL_CHAT_TITLE_TOOL_NAME);
      }
      const activeToolNames = Array.from(activeToolNameSet);
      const toolAttachments: ReturnType<typeof dedupeAiChatAttachments> = [];
      const toolPresentations: AiPresentationBlock[] = [];
      const currentUserContext = await buildCurrentUserScopePrompt(session.user.id);
      const systemPrompt = [
        buildSystemPrompt(selectedSkills, currentUserContext),
        ...(shouldEnableChatTitleTool ? [CHAT_TITLE_SYSTEM_PROMPT] : []),
      ].join('\n\n');
      const compressedHistory = compressConversationHistory({
        systemPrompt,
        messages,
        contextWindow: selectedCatalogModel?.context_window ?? null,
      });

      const stop = new AbortController();
      const result = streamText({
        model,
        maxRetries: 0,
        abortSignal: AbortSignal.any([request.signal, stop.signal]),
        system: systemPrompt,
        messages: compressedHistory.messages,
        tools,
        stopWhen: stepCountIs(shouldEnableChatTitleTool ? 5 : 4),
        providerOptions,
        activeTools: activeToolNames,
        onStepFinish: async stepResult => {
          try {
            toolAttachments.push(
              ...extractAiChatAttachmentsFromToolResults(stepResult.toolResults)
            );
            toolPresentations.push(
              ...extractAiPresentationsFromToolResults(stepResult.toolResults)
            );
          } catch (error) {
            logAiEvent('ai.operation.failed', {
              operation: 'Failed to collect AI tool attachments:',
              ...normalizeAiError(error),
            });
          }
        },
        onFinish: async ({ text, toolResults, finishReason }) => {
          if (stop.signal.aborted || request.signal.aborted || finishReason === 'error') return;
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
            logAiEvent('ai.operation.failed', {
              operation: 'Failed to persist AI chat response:',
              ...normalizeAiError(error),
            });
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
                  if (part.toolName === INTERNAL_CHAT_TITLE_TOOL_NAME) {
                    break;
                  }
                  controller.enqueue(
                    encoder.encode(
                      `${JSON.stringify({
                        type: 'tool-call',
                        traceId: context.traceId,
                        originMessageId: origin?.id,
                        toolCallId: part.toolCallId,
                        toolName: String(part.toolName),
                        args: part.input,
                      })}\n`
                    )
                  );
                  break;
                }
                case 'tool-result': {
                  if (part.toolName === INTERNAL_CHAT_TITLE_TOOL_NAME) {
                    break;
                  }
                  controller.enqueue(
                    encoder.encode(
                      `${JSON.stringify({ type: 'tool-result', traceId: context.traceId, toolCallId: part.toolCallId, toolName: String(part.toolName) })}\n`
                    )
                  );
                  break;
                }
                case 'tool-error': {
                  if (aiErrorCode(part.error) !== 'ai_operation_failed') {
                    stop.abort();
                    throw part.error;
                  }
                  break;
                }
                case 'error': {
                  stop.abort();
                  controller.enqueue(
                    encoder.encode(
                      `${JSON.stringify({
                        type: 'error',
                        error: getStreamError(part.error),
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
            stop.abort();
            logAiEvent('ai.chat.failed', normalizeAiError(error), context);
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({
                  type: 'error',
                  error: getStreamError(error),
                })}\n`
              )
            );
            controller.close();
          }
        },
        cancel() {
          stop.abort();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-AI-Trace-Id': context.traceId,
        },
      });
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return aiChatError('validation_failed', 400);
    }

    logAiEvent('ai.chat.failed', normalizeAiError(error), trace);
    const response = aiChatError(aiErrorCode(error), 500);
    if (trace) response.headers.set('X-AI-Trace-Id', trace.traceId);
    return response;
  }
}

export const Route = createFileRoute('/api/ai/chat')({
  server: {
    handlers: {
      POST: ({ request }) => handleAiChatRequest(request),
    },
  },
});
