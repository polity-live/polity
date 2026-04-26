import { DEFAULT_AI_SKILLS_BY_SLUG } from '@/features/assistant/logic/defaultAiSkills';
import { aiChatAttachmentSchema } from './ai-types';
import type { AiChatAttachment } from './ai-types';

export const BASE_ARIA_KAI_SYSTEM_PROMPT = [
  'You are Aria & Kai, the built-in AI agent inside Polity.',
  'Respond in German unless the user explicitly asks for another language.',
  'Be concrete, politically aware, and operationally useful.',
  'When context entities are attached, use them directly and mention gaps instead of inventing facts.',
  'Do not claim that you can access external tools or systems unless the current message clearly provides that context.',
].join('\n\n');

function parseAttachments(contextJson?: string | null): AiChatAttachment[] {
  if (!contextJson) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(contextJson);
    const result = aiChatAttachmentSchema.array().safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function formatAttachmentLine(attachment: AiChatAttachment): string {
  const subtitle = attachment.subtitle ? ` (${attachment.subtitle})` : '';
  const promptContext = attachment.prompt_context?.trim();

  if (promptContext) {
    return `- ${attachment.entityType}: ${attachment.title}${subtitle}\n  Context: ${promptContext}`;
  }

  return `- ${attachment.entityType}: ${attachment.title}${subtitle}`;
}

export function buildSystemPrompt(skillSlug?: string | null): string {
  const skill = skillSlug ? DEFAULT_AI_SKILLS_BY_SLUG[skillSlug] : undefined;

  if (!skill) {
    return BASE_ARIA_KAI_SYSTEM_PROMPT;
  }

  return [BASE_ARIA_KAI_SYSTEM_PROMPT, skill.systemPrompt].join('\n\n');
}

export function buildCurrentTurnUserContent(
  content: string,
  attachments: readonly AiChatAttachment[]
): string {
  if (attachments.length === 0) {
    return content;
  }

  return [
    content,
    '',
    'Attached Polity context:',
    attachments.map(formatAttachmentLine).join('\n'),
  ].join('\n');
}

export function buildHistoricUserContent(
  content: string | null,
  contextJson?: string | null
): string {
  const messageContent = content?.trim() ?? '';
  const attachments = parseAttachments(contextJson);

  if (attachments.length === 0) {
    return messageContent;
  }

  return [
    messageContent,
    '',
    'Attached Polity context:',
    attachments.map(formatAttachmentLine).join('\n'),
  ]
    .filter(Boolean)
    .join('\n');
}
