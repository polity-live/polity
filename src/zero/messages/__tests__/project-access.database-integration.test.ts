import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  createZeroContext,
  executeZeroTransaction,
  type ZeroTransaction,
} from '@/server/zero-mutate';
import { rows, sqlTransaction } from '@/server/transaction';
import { messageSharedMutators } from '../shared-mutators';
import { projectChatSharedMutators } from '@/zero/project-chat/shared-mutators';
import { appearanceThemeSharedMutators } from '@/zero/appearance-themes/shared-mutators';
import {
  createPersonalAppearanceThemeSchema,
  updateAppearanceThemeDraftSchema,
} from '@/zero/appearance-themes/schema';
import { POLITY_THEME } from '@/features/shared/appearance-theme';

const database = new URL(
  process.env.ZERO_UPSTREAM_DB ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
);
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname))
  throw Error('Access tests require isolated local PostgreSQL');
const actor = crypto.randomUUID(),
  other = crypto.randomUUID(),
  amendment = crypto.randomUUID(),
  conversation = crypto.randomUUID(),
  message = crypto.randomUUID();
const ctx = createZeroContext(actor);
const transaction = <T>(work: (tx: ZeroTransaction) => Promise<T>, user = actor) =>
  executeZeroTransaction(createZeroContext(user), work);
const query = (text: string, values: unknown[] = []) =>
  transaction(tx => rows(sqlTransaction(tx), text, values));
const themes: string[] = [];
beforeAll(async () => {
  await query('insert into "user"(id) values($1),($2)', [actor, other]);
  await query(
    "insert into amendment(id,created_by_id,title,visibility) values($1,$2,'Message access','private')",
    [amendment, actor]
  );
  await transaction(tx =>
    projectChatSharedMutators.create.fn({
      tx,
      ctx,
      args: {
        id: conversation,
        scope: { kind: 'amendment', amendmentId: amendment },
        name: 'Message access',
      },
    })
  );
  await query(
    "insert into message(id,conversation_id,sender_id,content) values($1,$2,$3,'Original')",
    [message, conversation, actor]
  );
});
afterAll(async () => {
  for (const id of themes) await query('delete from appearance_theme where id=$1', [id]);
  await query('delete from conversation where id=$1', [conversation]);
  await query('delete from amendment where id=$1', [amendment]);
  await query('delete from "user" where id in ($1,$2)', [actor, other]);
});

it.each([actor, other])(
  'rejects ordinary message insertion into a project chat for actor %s',
  async user => {
    const id = crypto.randomUUID();
    await expect(
      transaction(
        tx =>
          messageSharedMutators.sendMessage.fn({
            tx,
            ctx: createZeroContext(user),
            args: {
              id,
              conversation_id: conversation,
              content: 'Do not insert',
              context_json: null,
              deleted_at: 0,
            },
          }),
        user
      )
    ).rejects.toThrow(user === actor ? 'Use the AI chat transport' : 'Project access denied');
    expect(await query('select id from message where id=$1', [id])).toEqual([]);
  }
);
it('allows the project chat creator to rename the shared conversation', async () => {
  await transaction(tx =>
    messageSharedMutators.updateConversation.fn({
      tx,
      ctx,
      args: { id: conversation, name: 'Renamed project chat' },
    })
  );
  expect(await query('select name from conversation where id=$1', [conversation])).toEqual([
    { name: 'Renamed project chat' },
  ]);
});
it('checks current project access before allowing conversation management', async () => {
  await expect(
    transaction(
      tx =>
        messageSharedMutators.updateConversation.fn({
          tx,
          ctx: createZeroContext(other),
          args: { id: conversation, name: 'Unauthorized' },
        }),
      other
    )
  ).rejects.toThrow('Project access denied');
  expect(await query('select name from conversation where id=$1', [conversation])).toEqual([
    { name: 'Renamed project chat' },
  ]);
});
it('denies a project owner who is not the shared conversation creator and leaves its title intact', async () => {
  await query('update conversation set requested_by_id=$2 where id=$1', [conversation, other]);
  try {
    await expect(
      transaction(tx =>
        messageSharedMutators.updateConversation.fn({
          tx,
          ctx,
          args: { id: conversation, name: 'Wrong creator' },
        })
      )
    ).rejects.toThrow('Only the creator can manage this shared chat');
    expect(await query('select name from conversation where id=$1', [conversation])).toEqual([
      { name: 'Renamed project chat' },
    ]);
  } finally {
    await query('update conversation set requested_by_id=$2 where id=$1', [conversation, actor]);
  }
});
it('keeps durable project messages immutable even for their original sender', async () => {
  await expect(
    transaction(tx =>
      messageSharedMutators.updateMessage.fn({
        tx,
        ctx,
        args: { id: message, content: 'Modified' },
      })
    )
  ).rejects.toThrow('Project run messages are immutable');
  expect(await query('select content from message where id=$1', [message])).toEqual([
    { content: 'Original' },
  ]);
});
it('rejects creating a project conversation through the ordinary conversation mutator', async () => {
  const id = crypto.randomUUID();
  await expect(
    transaction(tx =>
      messageSharedMutators.createConversation.fn({
        tx,
        ctx,
        args: {
          id,
          type: 'project_ai',
          name: 'Bypass',
          status: null,
          pinned: false,
          last_message_at: 0,
          group_id: null,
        },
      })
    )
  ).rejects.toThrow('Use projectChat.create');
  expect(await query('select id from conversation where id=$1', [id])).toEqual([]);
});

it.each(['defaults', 'explicit'] as const)(
  'creates and edits a personal appearance theme with %s optional fields using native Zero transactions',
  async mode => {
    const id = crypto.randomUUID(),
      revision = crypto.randomUUID();
    themes.push(id);
    const args = createPersonalAppearanceThemeSchema.parse({
      id,
      revision_id: revision,
      slug: `personal-${id}`,
      name: 'Personal theme',
      light_palette: POLITY_THEME.light,
      dark_palette: POLITY_THEME.dark,
      fonts: POLITY_THEME.fonts,
      ...(mode === 'explicit'
        ? { description: 'My theme', text_styles: POLITY_THEME.textStyles }
        : {}),
    });
    await transaction(tx => appearanceThemeSharedMutators.createPersonal.fn({ tx, ctx, args }));
    const [theme] = await query(
      'select kind,group_id,created_by_id,description from appearance_theme where id=$1',
      [id]
    );
    expect(theme).toEqual({
      kind: 'personal',
      group_id: null,
      created_by_id: actor,
      description: mode === 'explicit' ? 'My theme' : null,
    });
    const [draft] = await query(
      'select text_styles,version,status from appearance_theme_revision where id=$1',
      [revision]
    );
    expect(draft).toMatchObject({
      text_styles: mode === 'explicit' ? POLITY_THEME.textStyles : [],
      version: 1,
      status: 'draft',
    });
    const edit = updateAppearanceThemeDraftSchema.parse({
      ...args,
      id: crypto.randomUUID(),
      revision_id: revision,
      theme_id: id,
      version: 1,
      name: 'Updated personal theme',
    });
    await transaction(tx => appearanceThemeSharedMutators.updateDraft.fn({ tx, ctx, args: edit }));
    expect(await query('select name from appearance_theme where id=$1', [id])).toEqual([
      { name: 'Updated personal theme' },
    ]);
    await expect(
      transaction(
        tx =>
          appearanceThemeSharedMutators.updateDraft.fn({
            tx,
            ctx: createZeroContext(other),
            args: { ...edit, name: 'Foreign edit' },
          }),
        other
      )
    ).rejects.toThrow('Theme not found');
    expect(await query('select name from appearance_theme where id=$1', [id])).toEqual([
      { name: 'Updated personal theme' },
    ]);
  }
);
