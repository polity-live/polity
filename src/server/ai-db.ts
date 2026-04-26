import { ARIA_KAI_USER_ID } from '@/features/assistant/constants';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { createClient } from '@/lib/supabase/server';
import { decryptSecret, encryptSecret, maskSecret } from './ai-crypto';
import { aiChatAttachmentSchema, type AiChatAttachment, type AiProvider } from './ai-types';

export interface AiCredentialSummary {
  provider: AiProvider;
  has_key: boolean;
  key_hint: string | null;
  updated_at: string | null;
}

interface AiCredentialRow {
  id: string;
  user_id: string;
  provider: AiProvider;
  encrypted_key: string;
  key_hint: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

interface AiConversationRow {
  id: string;
  assistant_for_user_id: string | null;
}

interface AiMessageHistoryRow {
  id: string;
  sender_id: string;
  content: string | null;
  context_json: string | null;
  created_at: string;
}

interface AiSkillRow {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  aliases: string;
  system_prompt: string;
  created_at: string;
  updated_at: string;
}

const PROVIDERS: readonly AiProvider[] = ['openrouter', 'openai', 'anthropic'];

interface EventPromptContextRow {
  title: string | null;
  description: unknown;
  status: string | null;
  location_name: string | null;
  city: string | null;
  post_code: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface AgendaItemPromptContextRow {
  id: string;
  title: string | null;
  description: string | null;
  type: string | null;
  status: string | null;
  order_index: number | null;
  scheduled_time: string | null;
  start_time: string | null;
  end_time: string | null;
}

interface AmendmentPromptContextRow {
  title: string | null;
  reason: string | null;
  preamble: string | null;
  editing_mode: string | null;
  updated_at: string | null;
  document_id: string | null;
}

interface DocumentPromptContextRow {
  content: unknown;
  updated_at: string | null;
}

interface ChangeRequestPromptContextRow {
  title: string | null;
  description: string | null;
  reason: string | null;
  status: string | null;
  voting_status: string | null;
  votes_for: number | null;
  votes_against: number | null;
  votes_abstain: number | null;
  updated_at: string | null;
}

interface ThreadPromptContextRow {
  id: string;
  content: string | null;
  status: string | null;
  updated_at: string | null;
}

interface CommentPromptContextRow {
  thread_id: string;
  content: string | null;
  created_at: string | null;
}

function trimLongText(value: string, maxLength = 8000): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n[truncated]`;
}

function combinePromptSections(...sections: (string | null | undefined)[]): string | null {
  const result = sections
    .map(section => section?.trim())
    .filter(Boolean)
    .join('\n\n');

  return result || null;
}

function parseAiAttachments(contextJson?: string | null): AiChatAttachment[] {
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

async function buildEventPromptContext(
  supabase: ReturnType<typeof createClient>,
  attachment: AiChatAttachment
): Promise<string | null> {
  const { data: eventData, error: eventError } = await supabase
    .from('event')
    .select('title, description, status, location_name, city, post_code, start_date, end_date')
    .eq('id', attachment.entityId)
    .maybeSingle();

  if (eventError) {
    throw new Error(`Failed to load event AI context: ${eventError.message}`);
  }

  const event = (eventData as EventPromptContextRow | null) ?? null;
  if (!event) {
    return attachment.prompt_context ?? null;
  }

  const { data: agendaData, error: agendaError } = await supabase
    .from('agenda_item')
    .select(
      'id, title, description, type, status, order_index, scheduled_time, start_time, end_time'
    )
    .eq('event_id', attachment.entityId)
    .order('order_index', { ascending: true })
    .limit(20);

  if (agendaError) {
    throw new Error(`Failed to load event agenda AI context: ${agendaError.message}`);
  }

  const agendaItems = (agendaData ?? []) as AgendaItemPromptContextRow[];
  const agendaSection =
    agendaItems.length > 0
      ? [
          'Agenda items:',
          ...agendaItems.map((item, index) => {
            const label = item.title || item.type || `Agenda item ${index + 1}`;
            const meta = [item.status, item.scheduled_time || item.start_time || item.end_time]
              .filter(Boolean)
              .join(' | ');
            const description = item.description?.trim();
            return `${index + 1}. ${label}${meta ? ` [${meta}]` : ''}${description ? ` — ${description}` : ''}`;
          }),
        ].join('\n')
      : null;

  return combinePromptSections(
    attachment.prompt_context,
    [
      `Event title: ${event.title || attachment.title}`,
      event.status ? `Status: ${event.status}` : '',
      event.start_date ? `Starts: ${event.start_date}` : '',
      event.end_date ? `Ends: ${event.end_date}` : '',
      [event.location_name, event.post_code, event.city].filter(Boolean).join(', '),
      richTextToPlainText(event.description),
    ]
      .filter(Boolean)
      .join('\n'),
    agendaSection
  );
}

async function buildAmendmentPromptContext(
  supabase: ReturnType<typeof createClient>,
  attachment: AiChatAttachment
): Promise<string | null> {
  const { data: amendmentData, error: amendmentError } = await supabase
    .from('amendment')
    .select('title, reason, preamble, editing_mode, updated_at, document_id')
    .eq('id', attachment.entityId)
    .maybeSingle();

  if (amendmentError) {
    throw new Error(`Failed to load amendment AI context: ${amendmentError.message}`);
  }

  const amendment = (amendmentData as AmendmentPromptContextRow | null) ?? null;
  if (!amendment) {
    return attachment.prompt_context ?? null;
  }

  let document: DocumentPromptContextRow | null = null;

  if (amendment.document_id) {
    const { data: documentData, error: documentError } = await supabase
      .from('document')
      .select('content, updated_at')
      .eq('id', amendment.document_id)
      .maybeSingle();

    if (documentError) {
      throw new Error(`Failed to load amendment document AI context: ${documentError.message}`);
    }

    document = (documentData as DocumentPromptContextRow | null) ?? null;
  } else {
    const { data: documentData, error: documentError } = await supabase
      .from('document')
      .select('content, updated_at')
      .eq('amendment_id', attachment.entityId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (documentError) {
      throw new Error(
        `Failed to load amendment fallback document AI context: ${documentError.message}`
      );
    }

    document = (documentData as DocumentPromptContextRow | null) ?? null;
  }

  const { data: changeRequestData, error: changeRequestError } = await supabase
    .from('change_request')
    .select(
      'title, description, reason, status, voting_status, votes_for, votes_against, votes_abstain, updated_at'
    )
    .eq('amendment_id', attachment.entityId)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (changeRequestError) {
    throw new Error(
      `Failed to load amendment change requests AI context: ${changeRequestError.message}`
    );
  }

  const changeRequests = (changeRequestData ?? []) as ChangeRequestPromptContextRow[];

  const { data: threadData, error: threadError } = await supabase
    .from('thread')
    .select('id, content, status, updated_at')
    .eq('amendment_id', attachment.entityId)
    .order('updated_at', { ascending: false })
    .limit(8);

  if (threadError) {
    throw new Error(`Failed to load amendment discussions AI context: ${threadError.message}`);
  }

  const threads = (threadData ?? []) as ThreadPromptContextRow[];
  const threadIds = threads.map(thread => thread.id);

  let comments: CommentPromptContextRow[] = [];
  if (threadIds.length > 0) {
    const { data: commentData, error: commentError } = await supabase
      .from('comment')
      .select('thread_id, content, created_at')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: true })
      .limit(20);

    if (commentError) {
      throw new Error(
        `Failed to load amendment discussion comments AI context: ${commentError.message}`
      );
    }

    comments = (commentData ?? []) as CommentPromptContextRow[];
  }

  const documentText = trimLongText(richTextToPlainText(document?.content));
  const changeRequestSection =
    changeRequests.length > 0
      ? [
          'Change requests:',
          ...changeRequests.map((changeRequest, index) => {
            const title = changeRequest.title || `Change request ${index + 1}`;
            const summary = [
              changeRequest.status,
              changeRequest.voting_status,
              `for ${changeRequest.votes_for ?? 0}`,
              `against ${changeRequest.votes_against ?? 0}`,
              `abstain ${changeRequest.votes_abstain ?? 0}`,
            ]
              .filter(Boolean)
              .join(' | ');
            const detail = changeRequest.description || changeRequest.reason || '';
            return `${index + 1}. ${title}${summary ? ` [${summary}]` : ''}${detail ? ` — ${detail}` : ''}`;
          }),
        ].join('\n')
      : null;

  const discussionSection =
    threads.length > 0
      ? [
          'Discussion threads:',
          ...threads.map((thread, index) => {
            const threadComments = comments
              .filter(comment => comment.thread_id === thread.id)
              .map(comment => comment.content?.trim())
              .filter(Boolean);
            const summary = [thread.status, thread.updated_at].filter(Boolean).join(' | ');
            const threadText = [thread.content?.trim(), ...threadComments]
              .filter(Boolean)
              .join(' // ');
            return `${index + 1}. ${summary ? `[${summary}] ` : ''}${threadText}`;
          }),
        ].join('\n')
      : null;

  return combinePromptSections(
    attachment.prompt_context,
    [
      `Amendment title: ${amendment.title || attachment.title}`,
      amendment.editing_mode ? `Editing mode: ${amendment.editing_mode}` : '',
      amendment.updated_at ? `Updated at: ${amendment.updated_at}` : '',
      amendment.reason,
      amendment.preamble,
    ]
      .filter(Boolean)
      .join('\n'),
    documentText ? `Current document text:\n${documentText}` : null,
    changeRequestSection,
    discussionSection
  );
}

export async function listAiCredentialRows(userId: string): Promise<AiCredentialRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('ai_provider_credential')
    .select('id, user_id, provider, encrypted_key, key_hint, created_at, updated_at, last_used_at')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to load AI credentials: ${error.message}`);
  }

  return (data ?? []) as AiCredentialRow[];
}

export async function listAiCredentialSummaries(userId: string): Promise<AiCredentialSummary[]> {
  const rows = await listAiCredentialRows(userId);
  const map = new Map(rows.map(row => [row.provider, row]));

  return PROVIDERS.map(provider => {
    const row = map.get(provider);
    return {
      provider,
      has_key: Boolean(row),
      key_hint: row?.key_hint ?? null,
      updated_at: row?.updated_at ?? null,
    };
  });
}

export async function upsertAiCredential(
  userId: string,
  provider: AiProvider,
  apiKey: string
): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const encryptedKey = await encryptSecret(apiKey);
  const keyHint = maskSecret(apiKey);

  const { error } = await supabase.from('ai_provider_credential').upsert(
    {
      user_id: userId,
      provider,
      encrypted_key: encryptedKey,
      key_hint: keyHint,
      updated_at: now,
    },
    { onConflict: 'user_id,provider' }
  );

  if (error) {
    throw new Error(`Failed to save ${provider} credential: ${error.message}`);
  }
}

export async function deleteAiCredential(userId: string, provider: AiProvider): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('ai_provider_credential')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    throw new Error(`Failed to delete ${provider} credential: ${error.message}`);
  }
}

export async function getDecryptedAiCredential(
  userId: string,
  provider: AiProvider
): Promise<string | null> {
  const rows = await listAiCredentialRows(userId);
  const row = rows.find(entry => entry.provider === provider);

  if (!row) {
    return null;
  }

  return decryptSecret(row.encrypted_key);
}

export async function touchAiCredential(userId: string, provider: AiProvider): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('ai_provider_credential')
    .update({
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    throw new Error(`Failed to mark ${provider} credential as used: ${error.message}`);
  }
}

export async function getAssistantConversationForUser(
  userId: string,
  conversationId: string
): Promise<AiConversationRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('conversation')
    .select('id, assistant_for_user_id')
    .eq('id', conversationId)
    .eq('assistant_for_user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load assistant conversation: ${error.message}`);
  }

  return (data as AiConversationRow | null) ?? null;
}

export async function getConversationMessagesForAi(
  conversationId: string,
  limit = 24
): Promise<AiMessageHistoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('message')
    .select('id, sender_id, content, context_json, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load assistant conversation messages: ${error.message}`);
  }

  return (data ?? []) as AiMessageHistoryRow[];
}

export async function persistAssistantMessage(
  conversationId: string,
  content: string
): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error: messageError } = await supabase.from('message').insert({
    conversation_id: conversationId,
    sender_id: ARIA_KAI_USER_ID,
    content,
    context_json: '[]',
    is_read: false,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  });

  if (messageError) {
    throw new Error(`Failed to persist assistant message: ${messageError.message}`);
  }

  const { error: conversationError } = await supabase
    .from('conversation')
    .update({ last_message_at: now })
    .eq('id', conversationId);

  if (conversationError) {
    throw new Error(
      `Failed to update assistant conversation timestamp: ${conversationError.message}`
    );
  }
}

export async function getAiSkillBySlug(
  userId: string,
  skillSlug: string
): Promise<AiSkillRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('ai_skill')
    .select('id, user_id, slug, name, aliases, system_prompt, created_at, updated_at')
    .eq('user_id', userId)
    .eq('slug', skillSlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load AI skill: ${error.message}`);
  }

  return (data as AiSkillRow | null) ?? null;
}

export function isAssistantSender(senderId: string): boolean {
  return senderId === ARIA_KAI_USER_ID;
}

export async function enrichAiAttachmentsForPrompt(
  attachments: readonly AiChatAttachment[]
): Promise<AiChatAttachment[]> {
  if (attachments.length === 0) {
    return [];
  }

  const supabase = createClient();

  return Promise.all(
    attachments.map(async attachment => {
      try {
        switch (attachment.entityType) {
          case 'event':
            return {
              ...attachment,
              prompt_context: await buildEventPromptContext(supabase, attachment),
            };
          case 'amendment':
            return {
              ...attachment,
              prompt_context: await buildAmendmentPromptContext(supabase, attachment),
            };
          default:
            return attachment;
        }
      } catch (error) {
        console.error('Failed to enrich AI attachment context:', error);
        return attachment;
      }
    })
  );
}

export async function enrichAiAttachmentsFromContextJson(
  contextJson?: string | null
): Promise<AiChatAttachment[]> {
  return enrichAiAttachmentsForPrompt(parseAiAttachments(contextJson));
}
