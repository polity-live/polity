import { expect, it, vi } from 'vitest';
const providerMock = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock('ai', async importOriginal => ({
  ...(await importOriginal<typeof import('ai')>()),
  streamText: providerMock.stream,
}));
vi.mock('@/server/ai-models', () => ({
  getAiCatalog: async () => ({ models: [{ provider: 'openai', id: 'test-model' }] }),
  resolveLanguageModelForUser: async () => ({ model: {}, providerOptions: {} }),
}));
import { createZeroContext, executeZeroTransaction } from '@/server/zero-mutate';
import { projectChatSharedMutators } from '@/zero/project-chat/shared-mutators';
import { aiChatRequestSchema } from '@/server/ai-types';
import { handleProjectAiChat } from '../run';
import { rows, sqlTransaction } from '@/server/transaction';

const url = new URL(
  process.env.ZERO_UPSTREAM_DB ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('Run tests require local PostgreSQL');

it('resumes after a committed write without duplicating messages or actions and never loads personal history', async () => {
  const actor = crypto.randomUUID(),
    amendment = crypto.randomUUID(),
    document = crypto.randomUUID(),
    conversation = crypto.randomUUID(),
    personal = crypto.randomUUID();
  const ctx = createZeroContext(actor);
  await executeZeroTransaction(ctx, async tx => {
    const sql = sqlTransaction(tx);
    await sql.query('insert into "user"(id) values($1)', [actor]);
    await sql.query(
      "insert into amendment(id,created_by_id,title,visibility) values($1,$2,'Run test','private')",
      [amendment, actor]
    );
    await sql.query(
      "insert into document(id,amendment_id,editing_mode,content) values($1,$2,'edit',$3::jsonb)",
      [document, amendment, [{ type: 'p', children: [{ text: 'Before' }] }]]
    );
    await sql.query('update amendment set document_id=$2 where id=$1', [amendment, document]);
    await projectChatSharedMutators.create.fn({
      tx,
      ctx,
      args: {
        id: conversation,
        scope: { kind: 'amendment', amendmentId: amendment },
        name: 'Shared run',
      },
    });
    await tx.mutate.conversation.insert({
      id: personal,
      type: 'direct',
      assistant_for_user_id: actor,
      created_at: Date.now(),
    });
    await tx.mutate.message.insert({
      id: crypto.randomUUID(),
      conversation_id: personal,
      sender_id: actor,
      content: 'PRIVATE-HISTORY-SENTINEL',
      is_read: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  });
  try {
    let step = 0;
    providerMock.stream.mockImplementation((options: { messages: any[] }) => {
      expect(JSON.stringify(options.messages)).not.toContain('PRIVATE-HISTORY-SENTINEL');
      step++;
      const previousResult = options.messages.at(-1)?.content?.[0]?.output?.value;
      const call =
        step === 1
          ? { toolCallId: 'read', toolName: 'amendment_read', input: { offset: 0, limit: 20 } }
          : step === 2
            ? {
                toolCallId: 'write',
                toolName: 'amendment_apply_actions',
                input: {
                  snapshotId: previousResult.snapshotId,
                  summary: 'Change text',
                  actions: [{ type: 'text.replace', anchorRef: 'text_0_0', text: 'After' }],
                },
              }
            : step === 3
              ? {
                  toolCallId: 'present',
                  toolName: 'present_findings',
                  input: {
                    title: 'Result',
                    items: [
                      { title: 'Before', description: 'Old text', tone: 'neutral' },
                      { title: 'After', description: 'New text', tone: 'success' },
                    ],
                  },
                }
              : null;
      const current = step;
      return {
        fullStream: (async function* () {
          if (current === 4)
            yield { type: 'error', error: new Error('Simulated provider disconnection') };
          else if (!call) yield { type: 'text-delta', text: 'Changed.' };
        })(),
        response: Promise.resolve({
          messages: [
            { role: 'assistant', content: call ? [{ type: 'tool-call', ...call }] : 'Changed.' },
          ],
        }),
        toolCalls: Promise.resolve(call ? [call] : []),
        finishReason: Promise.resolve(call ? 'tool-calls' : 'stop'),
      };
    });
    const body = aiChatRequestSchema.parse({
      requestId: crypto.randomUUID(),
      conversationId: conversation,
      content: 'Change Before to After',
      model: { provider: 'openai', id: 'test-model' },
      editorContext: { surface: 'amendment_text', documentId: document },
    });
    const first = await handleProjectAiChat(
      actor,
      body,
      new Request('http://localhost/api/ai/chat')
    );
    expect(await first!.text()).toContain('operation_failed');
    const resumed = await handleProjectAiChat(
      actor,
      aiChatRequestSchema.parse({
        conversationId: conversation,
        requestId: body.requestId,
        resume: true,
      }),
      new Request('http://localhost/api/ai/chat')
    );
    expect(await resumed!.text()).toContain('completed');
    await executeZeroTransaction(ctx, async tx => {
      const sql = sqlTransaction(tx);
      expect(
        await rows(sql, 'select id from ai_change_set where conversation_id=$1', [conversation])
      ).toHaveLength(1);
      expect(
        await rows(sql, 'select id from message where conversation_id=$1', [conversation])
      ).toHaveLength(2);
      expect(
        (
          await rows<{ context_json: string }>(
            sql,
            'select context_json from message where conversation_id=$1 and sender_id=$2',
            [conversation, 'a12a0000-0000-4000-a000-000000000001']
          )
        )[0].context_json
      ).toContain('presentations');
      expect(
        (await rows(sql, 'select content from document where id=$1', [document]))[0].content
      ).toEqual([{ type: 'p', children: [{ text: 'After' }] }]);
      expect(
        (
          await rows<{ status: string; configuration: any }>(
            sql,
            'select status,configuration from ai_run where conversation_id=$1',
            [conversation]
          )
        )[0]
      ).toMatchObject({
        status: 'completed',
        configuration: {
          personalToolNames: expect.arrayContaining(['read_polity_docs', 'present_findings']),
          surface: 'amendment_text',
        },
      });
    });
    const duplicate = await handleProjectAiChat(
      actor,
      body,
      new Request('http://localhost/api/ai/chat')
    );
    expect(await duplicate!.text()).toContain('completed');
    expect(providerMock.stream).toHaveBeenCalledTimes(5);
  } finally {
    await executeZeroTransaction(ctx, async tx => {
      const sql = sqlTransaction(tx);
      await sql.query('delete from conversation where id in ($1,$2)', [conversation, personal]);
      await sql.query('delete from amendment where id=$1', [amendment]);
      await sql.query('delete from "user" where id=$1', [actor]);
    });
  }
});
