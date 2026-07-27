import { stepCountIs, streamText, tool } from 'ai';
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
  console.error('AI chat stream error:', error);
  return appErrorHttpBody('ai_operation_failed').error;
}

function aiChatError(code: AppErrorCode, status: number): Response {
  return Response.json(appErrorHttpBody(code), { status });
}

export async function handleAiChatRequest(request: Request): Promise<Response> {
  try {
    const session = await getSession(request);

    if (!session?.user) {
      return aiChatError('permission_denied', 401);
    }

    const body = aiChatRequestSchema.parse(await request.json());
    const conversation = await getAssistantConversationForUser(
      session.user.id,
      body.conversationId
    );

    if (!conversation) {
      return aiChatError('permission_denied', 403);
    }

    const catalog = await getAiCatalog(session.user.id);
    const isAllowedModel = catalog.models.some(
      model => model.provider === body.model.provider && model.id === body.model.id
    );

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
    const selectedCatalogModel = catalog.models.find(
      model => model.provider === body.model.provider && model.id === body.model.id
    );

    const { model, providerOptions, credentialProvider } = await resolveLanguageModelForUser(
      session.user.id,
      body.model,
      body.reasoningEffort
    );

    const history = await getConversationMessagesForAi(body.conversationId);
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
    const effectiveUserMessageCount = persistedUserMessageCount + (shouldAppendCurrentTurn ? 1 : 0);
    const shouldEnableChatTitleTool =
      conversation.name === DEFAULT_ASSISTANT_CONVERSATION_NAME && effectiveUserMessageCount === 1;

    const tools = {
      ...buildAiTools(session.user.id, body.timeZone),
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
                  console.error('Failed to set AI chat title:', error);
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

    const result = streamText({
      model,
      system: systemPrompt,
      messages: compressedHistory.messages,
      tools,
      stopWhen: stepCountIs(shouldEnableChatTitleTool ? 5 : 4),
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
                if (part.toolName === INTERNAL_CHAT_TITLE_TOOL_NAME) {
                  break;
                }
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
                if (part.toolName === INTERNAL_CHAT_TITLE_TOOL_NAME) {
                  break;
                }
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
          console.error('AI chat stream failed after response started:', error);
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
      return aiChatError('validation_failed', 400);
    }

    console.error('Failed to prepare AI chat stream:', error);
    return aiChatError('ai_operation_failed', 500);
  }
}

export const Route = createFileRoute('/api/ai/chat')({
  server: {
    handlers: {
      POST: ({ request }) => handleAiChatRequest(request),
    },
  },
});
