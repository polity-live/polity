import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

const mocks = vi.hoisted(() => ({
  queues: new Map<string, QueryResult[]>(),
  builders: [] as { table: string; calls: [string, unknown[]][] }[],
  createClient: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  mask: vi.fn(),
  isErrorContext: vi.fn(),
  plainText: vi.fn((value: unknown) =>
    typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value)
  ),
  translate: vi.fn((_key: string, values?: { valuee0eb?: number }) =>
    values?.valuee0eb ? `Translated ${values.valuee0eb}` : 'Translated'
  ),
}));

function createSupabaseFake() {
  return {
    from(table: string) {
      const calls: [string, unknown[]][] = [];
      mocks.builders.push({ table, calls });
      const result = () =>
        mocks.queues.get(table)?.shift() ?? ({ data: null, error: null } satisfies QueryResult);
      const builder: Record<string, unknown> = {};
      for (const method of [
        'select',
        'eq',
        'order',
        'limit',
        'in',
        'insert',
        'upsert',
        'update',
        'delete',
      ]) {
        builder[method] = (...args: unknown[]) => {
          calls.push([method, args]);
          return builder;
        };
      }
      builder.maybeSingle = async () => result();
      builder.then = (
        resolve: (value: QueryResult) => unknown,
        reject: (reason: unknown) => unknown
      ) => Promise.resolve(result()).then(resolve, reject);
      return builder;
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('../ai-crypto', () => ({
  decryptSecret: mocks.decrypt,
  encryptSecret: mocks.encrypt,
  maskSecret: mocks.mask,
}));
vi.mock('@/features/messages/logic/contextAttachments', () => ({
  isAssistantErrorContext: mocks.isErrorContext,
}));
vi.mock('@/features/shared/logic/richText', () => ({ richTextToPlainText: mocks.plainText }));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: mocks.translate }));

import { ARIA_KAI_USER_ID } from '@/features/assistant/constants';
import { serializeAiMessageContext } from '@/lib/ai/messageContext';
import {
  deleteAiCredential,
  enrichAiAttachmentsForPrompt,
  enrichAiAttachmentsFromContextJson,
  getAiSkillBySlug,
  getAiSkillsBySlugs,
  getAiToolsByNames,
  getAssistantConversationForUser,
  getConversationMessagesForAi,
  getDecryptedAiCredential,
  isAssistantSender,
  listAiCredentialRows,
  listAiCredentialSummaries,
  persistAssistantMessage,
  setAssistantConversationTitle,
  touchAiCredential,
  upsertAiCredential,
} from '../ai-db';

function respond(table: string, ...results: Partial<QueryResult>[]) {
  const queue = mocks.queues.get(table) ?? [];
  queue.push(
    ...results.map(result => ({ data: result.data ?? null, error: result.error ?? null }))
  );
  mocks.queues.set(table, queue);
}

function failure(message: string): QueryResult {
  return { data: null, error: { message } };
}

function attachment(entityType: string, overrides: Record<string, unknown> = {}) {
  return {
    entityType,
    entityId: `${entityType}-1`,
    title: `${entityType} title`,
    context_type: 'output',
    href: `/${entityType}/1`,
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queues.clear();
  mocks.builders.splice(0);
  mocks.createClient.mockImplementation(createSupabaseFake);
  mocks.encrypt.mockResolvedValue('encrypted');
  mocks.decrypt.mockResolvedValue('decrypted');
  mocks.mask.mockReturnValue('***hint');
  mocks.isErrorContext.mockImplementation(value => value === 'error-context');
});

describe('AI credential persistence', () => {
  it('lists rows and builds summaries for present and absent providers', async () => {
    const row = {
      id: 'credential-1',
      user_id: 'user-1',
      provider: 'openai',
      encrypted_key: 'secret',
      key_hint: '***cret',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
      last_used_at: null,
    };
    respond('ai_provider_credential', { data: [row] }, { data: [row] }, { data: null });
    await expect(listAiCredentialRows('user-1')).resolves.toEqual([row]);
    await expect(listAiCredentialSummaries('user-1')).resolves.toEqual([
      { provider: 'openrouter', has_key: false, key_hint: null, updated_at: null },
      { provider: 'openai', has_key: true, key_hint: '***cret', updated_at: '2025-01-02' },
      { provider: 'anthropic', has_key: false, key_hint: null, updated_at: null },
    ]);
    await expect(listAiCredentialRows('user-1')).resolves.toEqual([]);
  });

  it('reports list errors and decrypts only existing credentials', async () => {
    respond('ai_provider_credential', failure('read failed'));
    await expect(listAiCredentialRows('user-1')).rejects.toThrow(
      'Failed to load AI credentials: read failed'
    );

    respond(
      'ai_provider_credential',
      { data: [] },
      { data: [{ provider: 'openai', encrypted_key: 'cipher' }] }
    );
    await expect(getDecryptedAiCredential('user-1', 'openai')).resolves.toBeNull();
    await expect(getDecryptedAiCredential('user-1', 'openai')).resolves.toBe('decrypted');
    expect(mocks.decrypt).toHaveBeenCalledWith('cipher');
  });

  it('upserts, deletes and touches credentials and reports provider-specific failures', async () => {
    respond('ai_provider_credential', {}, {}, {});
    await expect(upsertAiCredential('user-1', 'openai', 'key')).resolves.toBeUndefined();
    expect(mocks.encrypt).toHaveBeenCalledWith('key');
    expect(mocks.mask).toHaveBeenCalledWith('key');
    await expect(deleteAiCredential('user-1', 'anthropic')).resolves.toBeUndefined();
    await expect(touchAiCredential('user-1', 'openrouter')).resolves.toBeUndefined();

    respond(
      'ai_provider_credential',
      failure('save failed'),
      failure('delete failed'),
      failure('touch failed')
    );
    await expect(upsertAiCredential('user-1', 'openai', 'key')).rejects.toThrow(
      'Failed to save openai credential: save failed'
    );
    await expect(deleteAiCredential('user-1', 'anthropic')).rejects.toThrow(
      'Failed to delete anthropic credential: delete failed'
    );
    await expect(touchAiCredential('user-1', 'openrouter')).rejects.toThrow(
      'Failed to mark openrouter credential as used: touch failed'
    );
  });
});

describe('assistant conversations and messages', () => {
  it('loads conversations, preserves nulls and reports lookup errors', async () => {
    const conversation = {
      id: 'conversation-1',
      assistant_for_user_id: 'user-1',
      name: 'Assistant',
      tutorial_run_id: null,
    };
    respond('conversation', { data: conversation }, { data: null }, failure('lookup failed'));
    await expect(getAssistantConversationForUser('user-1', 'conversation-1')).resolves.toEqual(
      conversation
    );
    await expect(getAssistantConversationForUser('user-1', 'missing')).resolves.toBeNull();
    await expect(getAssistantConversationForUser('user-1', 'broken')).rejects.toThrow(
      'Failed to load assistant conversation: lookup failed'
    );
  });

  it('sets only valid default titles and returns whether a row changed', async () => {
    await expect(setAssistantConversationTitle('user-1', 'conversation-1', '   ')).resolves.toBe(
      false
    );
    respond(
      'conversation',
      { data: { id: 'conversation-1' } },
      { data: null },
      failure('write failed')
    );
    await expect(
      setAssistantConversationTitle('user-1', 'conversation-1', '  A useful title  ')
    ).resolves.toBe(true);
    await expect(
      setAssistantConversationTitle('user-1', 'conversation-1', 'Another title')
    ).resolves.toBe(false);
    await expect(
      setAssistantConversationTitle('user-1', 'conversation-1', 'Broken title')
    ).rejects.toThrow('Failed to set assistant conversation title: write failed');
  });

  it('loads ordered message history with optional limits and filters error contexts', async () => {
    const rows = [
      { id: 'one', sender_id: 'user-1', content: 'Hello', context_json: null, created_at: '1' },
      {
        id: 'two',
        sender_id: ARIA_KAI_USER_ID,
        content: 'Failed',
        context_json: 'error-context',
        created_at: '2',
      },
    ];
    respond('message', { data: rows }, { data: rows }, { data: null }, failure('history failed'));
    await expect(getConversationMessagesForAi('conversation-1')).resolves.toEqual([rows[0]]);
    await expect(getConversationMessagesForAi('conversation-1', 1)).resolves.toEqual([rows[0]]);
    expect(mocks.builders.at(-1)?.calls).toEqual(expect.arrayContaining([['limit', [1]]]));
    await expect(getConversationMessagesForAi('conversation-1')).resolves.toEqual([]);
    await expect(getConversationMessagesForAi('conversation-1')).rejects.toThrow(
      'Failed to load assistant conversation messages: history failed'
    );
  });

  it('persists messages, updates timestamps and keeps both failures observable', async () => {
    respond('message', {});
    respond('conversation', {});
    await expect(
      persistAssistantMessage('conversation-1', 'Answer', {
        version: 1,
        attachments: [],
        presentations: [],
      })
    ).resolves.toBeUndefined();

    respond('message', failure('insert failed'));
    await expect(
      persistAssistantMessage('conversation-1', 'Answer', {
        version: 1,
        attachments: [],
        presentations: [],
      })
    ).rejects.toThrow('Failed to persist assistant message: insert failed');

    respond('message', {});
    respond('conversation', failure('timestamp failed'));
    await expect(
      persistAssistantMessage('conversation-1', 'Answer', {
        version: 1,
        attachments: [],
        presentations: [],
      })
    ).rejects.toThrow('Failed to update assistant conversation timestamp: timestamp failed');
  });
});

describe('AI skill and tool configuration', () => {
  it('loads one skill, returns null, and reports errors', async () => {
    const skill = { id: 'skill-1', slug: 'writer' };
    respond('ai_skill', { data: skill }, { data: null }, failure('skill failed'));
    await expect(getAiSkillBySlug('user-1', 'writer')).resolves.toEqual(skill);
    await expect(getAiSkillBySlug('user-1', 'missing')).resolves.toBeNull();
    await expect(getAiSkillBySlug('user-1', 'broken')).rejects.toThrow(
      'Failed to load AI skill: skill failed'
    );
  });

  it('short-circuits empty lists and loads configured skill and tool rows', async () => {
    await expect(getAiSkillsBySlugs('user-1', [])).resolves.toEqual([]);
    await expect(getAiToolsByNames('user-1', [])).resolves.toEqual([]);

    respond('ai_skill', { data: [{ slug: 'writer' }] }, { data: null }, failure('skills failed'));
    respond(
      'ai_tool',
      { data: [{ tool_name: 'find_entities' }] },
      { data: null },
      failure('tools failed')
    );
    await expect(getAiSkillsBySlugs('user-1', ['writer'])).resolves.toEqual([{ slug: 'writer' }]);
    await expect(getAiSkillsBySlugs('user-1', ['missing'])).resolves.toEqual([]);
    await expect(getAiSkillsBySlugs('user-1', ['broken'])).rejects.toThrow(
      'Failed to load AI skills: skills failed'
    );
    await expect(getAiToolsByNames('user-1', ['find_entities'] as never)).resolves.toEqual([
      { tool_name: 'find_entities' },
    ]);
    await expect(getAiToolsByNames('user-1', ['missing'] as never)).resolves.toEqual([]);
    await expect(getAiToolsByNames('user-1', ['broken'] as never)).rejects.toThrow(
      'Failed to load AI tools: tools failed'
    );
  });

  it('identifies the assistant sender exactly', () => {
    expect(isAssistantSender(ARIA_KAI_USER_ID)).toBe(true);
    expect(isAssistantSender('user-1')).toBe(false);
  });
});

describe('AI prompt attachment enrichment', () => {
  it('short-circuits empty and unsupported attachments and parses context JSON', async () => {
    await expect(enrichAiAttachmentsForPrompt([])).resolves.toEqual([]);
    const group = attachment('group');
    await expect(enrichAiAttachmentsForPrompt([group])).resolves.toEqual([group]);
    const context = serializeAiMessageContext({
      version: 1,
      attachments: [group],
      presentations: [],
    });
    await expect(enrichAiAttachmentsFromContextJson(context)).resolves.toEqual([group]);
    await expect(enrichAiAttachmentsFromContextJson(null)).resolves.toEqual([]);
  });

  it('uses event prompt fallbacks and catches event and agenda lookup errors', async () => {
    const original = attachment('event', { prompt_context: 'Existing context' });
    respond(
      'event',
      failure('event failed'),
      { data: null },
      { data: null },
      { data: { title: 'Event' } }
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(enrichAiAttachmentsForPrompt([original])).resolves.toEqual([original]);
    await expect(enrichAiAttachmentsForPrompt([original])).resolves.toMatchObject([
      { prompt_context: 'Existing context' },
    ]);
    await expect(
      enrichAiAttachmentsForPrompt([attachment('event', { prompt_context: null })])
    ).resolves.toMatchObject([{ prompt_context: null }]);
    respond('agenda_item', failure('agenda failed'));
    await expect(enrichAiAttachmentsForPrompt([original])).resolves.toEqual([original]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('builds rich and sparse event prompt sections', async () => {
    respond(
      'event',
      {
        data: {
          title: '',
          description: [{ type: 'p', children: [{ text: 'Description' }] }],
          status: 'scheduled',
          location_name: 'Hall',
          city: 'Berlin',
          post_code: '10115',
          start_date: '2025-01-01',
          end_date: '2025-01-02',
        },
      },
      { data: { title: 'Sparse', description: null } }
    );
    respond(
      'agenda_item',
      {
        data: [
          {
            title: 'Opening',
            type: 'discussion',
            status: 'scheduled',
            scheduled_time: '10:00',
            description: 'Welcome',
          },
          { title: '', type: 'vote', start_time: '11:00', description: ' ' },
          { title: '', type: '', end_time: '12:00', description: null },
          { title: 'Closing', type: '', description: null },
        ],
      },
      { data: null }
    );
    const rich = await enrichAiAttachmentsForPrompt([
      attachment('event', { title: 'Fallback event', prompt_context: 'Pinned context' }),
    ]);
    expect(rich[0].prompt_context).toContain('Pinned context');
    expect(rich[0].prompt_context).toContain('Event title: Fallback event');
    expect(rich[0].prompt_context).toContain('Agenda items:');
    expect(rich[0].prompt_context).toContain('Translated 3');

    const sparse = await enrichAiAttachmentsForPrompt([attachment('event')]);
    expect(sparse[0].prompt_context).toContain('Event title: Sparse');
    expect(sparse[0].prompt_context).not.toContain('Agenda items:');
  });

  it('uses amendment fallbacks and catches every query boundary failure', async () => {
    const original = attachment('amendment', { prompt_context: 'Existing context' });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    respond(
      'amendment',
      failure('amendment failed'),
      { data: null },
      { data: null },
      { data: { title: 'With document', document_id: 'doc-1' } },
      { data: { title: 'Fallback document', document_id: null } },
      { data: { title: 'Change requests', document_id: 'doc-1' } },
      { data: { title: 'Threads', document_id: 'doc-1' } }
    );
    await expect(enrichAiAttachmentsForPrompt([original])).resolves.toEqual([original]);
    await expect(enrichAiAttachmentsForPrompt([original])).resolves.toMatchObject([
      { prompt_context: 'Existing context' },
    ]);
    await expect(
      enrichAiAttachmentsForPrompt([attachment('amendment', { prompt_context: null })])
    ).resolves.toMatchObject([{ prompt_context: null }]);

    respond(
      'document',
      failure('document failed'),
      failure('fallback failed'),
      { data: null },
      { data: null }
    );
    await expect(enrichAiAttachmentsForPrompt([original])).resolves.toEqual([original]);
    await expect(enrichAiAttachmentsForPrompt([original])).resolves.toEqual([original]);

    respond('change_request', failure('changes failed'), { data: [] });
    await expect(enrichAiAttachmentsForPrompt([original])).resolves.toEqual([original]);
    respond('thread', failure('threads failed'));
    await expect(enrichAiAttachmentsForPrompt([original])).resolves.toEqual([original]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('builds amendment document, change-request, thread and comment sections', async () => {
    const longDocument = 'x'.repeat(8_010);
    respond(
      'amendment',
      {
        data: {
          title: '',
          reason: 'Reason',
          preamble: 'Preamble',
          updated_at: '2025-01-02',
          document_id: 'document-1',
        },
      },
      { data: { title: 'No threads', document_id: null } }
    );
    respond('document', { data: { content: longDocument } }, { data: null });
    respond(
      'change_request',
      {
        data: [
          {
            title: 'First',
            description: 'Details',
            reason: 'Reason fallback',
            status: 'open',
            voting_status: 'voting',
            votes_for: null,
            votes_against: 2,
            votes_abstain: null,
          },
          { title: '', description: '', reason: 'Only reason' },
          { title: 'No details', description: '', reason: '' },
        ],
      },
      { data: null }
    );
    respond(
      'thread',
      {
        data: [
          { id: 'thread-1', content: 'Thread', status: 'open', updated_at: '2025-01-03' },
          { id: 'thread-2', content: null, status: null, updated_at: null },
        ],
      },
      { data: null }
    );
    respond('comment', {
      data: [
        { thread_id: 'thread-1', content: 'Comment' },
        { thread_id: 'thread-1', content: ' ' },
        { thread_id: 'other', content: 'Ignored' },
      ],
    });

    const [rich] = await enrichAiAttachmentsForPrompt([
      attachment('amendment', { title: 'Fallback amendment', prompt_context: 'Pinned' }),
    ]);
    expect(rich.prompt_context).toContain('Amendment title: Fallback amendment');
    expect(rich.prompt_context).toContain('[truncated]');
    expect(rich.prompt_context).toContain('Change requests:');
    expect(rich.prompt_context).toContain('Translated 2');
    expect(rich.prompt_context).toContain('Discussion threads:');
    expect(rich.prompt_context).toContain('Thread // Comment');

    const [sparse] = await enrichAiAttachmentsForPrompt([attachment('amendment')]);
    expect(sparse.prompt_context).toContain('Amendment title: No threads');
    expect(sparse.prompt_context).not.toContain('Change requests:');
    expect(sparse.prompt_context).not.toContain('Discussion threads:');
  });

  it('catches comment lookup errors after threads are found', async () => {
    const original = attachment('amendment');
    respond('amendment', { data: { title: 'Title', document_id: null } });
    respond('document', { data: null });
    respond('change_request', { data: [] });
    respond('thread', { data: [{ id: 'thread-1', content: 'Thread' }] });
    respond('comment', failure('comments failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(enrichAiAttachmentsForPrompt([original])).resolves.toEqual([original]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('treats a null comment result as an empty discussion comment list', async () => {
    respond('amendment', { data: { title: 'Title', document_id: null } });
    respond('document', { data: null });
    respond('change_request', { data: [] });
    respond('thread', { data: [{ id: 'thread-1', content: 'Thread' }] });
    respond('comment', { data: null });
    await expect(enrichAiAttachmentsForPrompt([attachment('amendment')])).resolves.toMatchObject([
      { prompt_context: expect.stringContaining('Thread') },
    ]);
  });
});
