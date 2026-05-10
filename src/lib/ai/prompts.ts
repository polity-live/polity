import { aiChatAttachmentSchema, type AiChatAttachment } from './schemas';

export interface SelectedAiPromptSkill {
  slug: string;
  name: string;
  systemPrompt: string;
}

export const BASE_ARIA_KAI_SYSTEM_PROMPT = [
  'You are Aria & Kai, the built-in AI agent inside Polity.',
  'Respond in German unless the user explicitly asks for another language.',
  'Be concrete, politically aware, and operationally useful.',
  'When context entities are attached, use them directly and mention gaps instead of inventing facts.',
  'When the user asks for current Polity data, use available Polity tools instead of guessing.',
  'When a follow-up create or linking action needs a group, amendment, event, blog, election, or similar entity ID and you only have a name or partial reference, first use the narrowest relevant search tool to resolve the entity.',
  'Reuse entity IDs returned by Polity search tools in the next tool call instead of asking the user for IDs that can be resolved from accessible data.',
  'When the user explicitly wants to create a real Polity entity and the required fields are known, call the matching create tool instead of describing a route or pseudo command.',
  'Use open_create_flow only when the user explicitly wants to open a create flow or when important creation details are still missing.',
  'If a required reference is still missing or ambiguous after searching, ask one short follow-up question before attempting the create tool call.',
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

export function buildSystemPrompt(
  skills: readonly SelectedAiPromptSkill[] = [],
  currentUserContext?: string | null
): string {
  const sections = [BASE_ARIA_KAI_SYSTEM_PROMPT];

  if (currentUserContext?.trim()) {
    sections.push(`Current Polity user context:\n${currentUserContext.trim()}`);
  }

  if (skills.length === 0) {
    return sections.join('\n\n');
  }

  const uniqueSkills = skills.filter(
    (skill, index, list) => list.findIndex(candidate => candidate.slug === skill.slug) === index
  );

  sections.push(
    ...uniqueSkills.map(skill =>
      [`Active skill: ${skill.name} (/${skill.slug})`, skill.systemPrompt].join('\n')
    )
  );

  return sections.join('\n\n');
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
