import { generateText } from 'ai';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getPreferredDefaultAiModel, toAiModelDescriptor } from '@/lib/ai/models';
import { getSession } from '@/lib/supabase/server';
import { touchAiCredential } from '@/server/ai-db';
import { getAiCatalog, resolveLanguageModelForUser } from '@/server/ai-models';

const COPILOT_MAX_TOKENS = 48;
const COPILOT_PROVIDER_COOLDOWN_MS = 30_000;

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

let copilotProviderCooldownUntilMs = 0;

function copilotNoSuggestionResponse(): Response {
  return Response.json({ text: '0' });
}

function getErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as {
    cause?: unknown;
    response?: { status?: unknown };
    status?: unknown;
    statusCode?: unknown;
  };
  const rawStatus = candidate.status ?? candidate.statusCode ?? candidate.response?.status;

  if (typeof rawStatus === 'number' && Number.isFinite(rawStatus)) {
    return rawStatus;
  }

  if (typeof rawStatus === 'string') {
    const parsed = Number.parseInt(rawStatus, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return getErrorStatusCode(candidate.cause);
}

function isTransientAiProviderError(error: unknown): boolean {
  const statusCode = getErrorStatusCode(error);

  if (statusCode === 429 || statusCode === 503) {
    return true;
  }

  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  return /\b(?:429|503)\b|rate limit|too many requests|server unavailable/i.test(message);
}

function startCopilotProviderCooldown(nowMs = Date.now()) {
  copilotProviderCooldownUntilMs = Math.max(
    copilotProviderCooldownUntilMs,
    nowMs + COPILOT_PROVIDER_COOLDOWN_MS
  );
}

export function isCopilotProviderCooldownActive(nowMs = Date.now()): boolean {
  return copilotProviderCooldownUntilMs > nowMs;
}

export function resetCopilotProviderCooldownForTests(): void {
  copilotProviderCooldownUntilMs = 0;
}

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
    return copilotNoSuggestionResponse();
  }

  try {
    if (isCopilotProviderCooldownActive()) {
      return copilotNoSuggestionResponse();
    }

    const catalog = await getAiCatalog(session.user.id);
    const preferredModel = getPreferredDefaultAiModel(catalog.models);

    if (!preferredModel) {
      return copilotNoSuggestionResponse();
    }

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
    if (isTransientAiProviderError(error)) {
      startCopilotProviderCooldown();
      console.warn('AI copilot completion temporarily unavailable:', error);
    } else {
      console.error('AI copilot completion failed:', error);
    }

    return copilotNoSuggestionResponse();
  }
}

export const Route = createFileRoute('/api/ai/copilot')({
  server: {
    handlers: {
      POST: async ({ request }) => handleCopilotRequest(request),
    },
  },
});
