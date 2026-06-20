import { generateText } from 'ai';
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { z } from 'zod';
import { getPreferredDefaultAiModel, toAiModelDescriptor } from '@/lib/ai/models';
import { getSession } from '@/lib/supabase/server';
import { touchAiCredential } from '@/server/ai-db';
import { getAiCatalog, resolveLanguageModelForUser } from '@/server/ai-models';

const COPILOT_MAX_TOKENS = 48;

const DEFAULT_COPILOT_SYSTEM_PROMPT = `You are Polity's inline editor autocomplete assistant.

Your job is to continue the user's current text naturally. Return only the next short continuation, not a full answer.

Rules:
- Continue in the same language as the input.
- Continue the current sentence or paragraph, do not start a new topic.
- Keep the suggestion short: usually 3 to 18 words.
- Match the tone, formality, and style of the existing text.
- Do not repeat text that is already present.
- Do not add Markdown formatting, headings, bullet points, numbering, quotes, or explanations.
- Do not answer questions as a chatbot; only complete the text.
- If the context is too unclear, return exactly: 0
- If you produce a continuation, end at a natural stopping point, preferably with punctuation.`;

const copilotRequestSchema = z.object({
  prompt: z.string(),
  system: z.string().optional(),
});

export function normalizeCopilotCompletion(text: string): string {
  const trimmed = text.trim();

  if (!trimmed || trimmed === '0') {
    return '0';
  }

  const normalized = trimmed
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || normalized === '0') {
    return '0';
  }

  if (/^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)/.test(normalized)) {
    return '0';
  }

  return normalized;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'AI copilot completion failed.';
}

export async function handleCopilotRequest(request: Request): Promise<Response> {
  const session = await getSession(request);

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return new Response('Invalid copilot request.', { status: 400 });
  }

  const parsedBody = copilotRequestSchema.safeParse(requestBody);

  if (!parsedBody.success) {
    return new Response('Invalid copilot request.', { status: 400 });
  }

  const prompt = parsedBody.data.prompt.trim();

  if (!prompt) {
    return Response.json({ text: '0' });
  }

  const catalog = await getAiCatalog(session.user.id);
  const preferredModel = getPreferredDefaultAiModel(catalog.models);

  if (!preferredModel) {
    return new Response('No AI models are available for this user.', { status: 400 });
  }

  try {
    const { model, providerOptions, credentialProvider } = await resolveLanguageModelForUser(
      session.user.id,
      toAiModelDescriptor(preferredModel),
      'low'
    );

    const result = await generateText({
      model,
      providerOptions,
      system: parsedBody.data.system?.trim() || DEFAULT_COPILOT_SYSTEM_PROMPT,
      prompt,
      temperature: 0.2,
      maxTokens: COPILOT_MAX_TOKENS,
    });

    const text = normalizeCopilotCompletion(result.text);

    if (text !== '0' && credentialProvider) {
      try {
        await touchAiCredential(session.user.id, credentialProvider);
      } catch (error) {
        console.error('Failed to update AI credential usage after copilot completion:', error);
      }
    }

    return Response.json({ text });
  } catch (error) {
    console.error('AI copilot completion failed:', error);
    return new Response(getErrorMessage(error), { status: 500 });
  }
}

export const APIRoute = createAPIFileRoute('/api/ai/copilot')({
  POST: async ({ request }) => handleCopilotRequest(request),
});
