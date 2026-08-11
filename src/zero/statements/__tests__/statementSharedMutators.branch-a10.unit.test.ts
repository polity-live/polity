import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const auth = vi.hoisted(() => ({
  can: vi.fn(),
  canReadVisibility: vi.fn((_args: unknown[]) => false),
  requireAuthenticated: vi.fn(),
  requireOwner: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => auth.can(...args),
}));

vi.mock('../../rbac/authorize', () => ({
  canReadVisibility: (...args: unknown[]) => auth.canReadVisibility(args),
  requireAuthenticated: (...args: unknown[]) => auth.requireAuthenticated(...args),
  requireOwner: (...args: unknown[]) => auth.requireOwner(...args),
}));

import { assertCanViewStatement, statementSharedMutators } from '../shared-mutators';

type CreateInput = Parameters<typeof statementSharedMutators.create.fn>[0];
type Tx = CreateInput['tx'];
type Ctx = CreateInput['ctx'];

const ctx = { userID: 'viewer', email: 'viewer@example.com' } as Ctx;

function operations() {
  return { insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
}

function createTx(location: Tx['location'] = 'server', rows: unknown[] = []) {
  const pendingRows = [...rows];
  return {
    clientID: 'client',
    location,
    mutationID: 1,
    reason: 'test',
    run: vi.fn().mockImplementation(() => Promise.resolve(pendingRows.shift())),
    mutate: {
      statement: operations(),
      statement_survey: operations(),
      statement_survey_option: operations(),
      statement_survey_vote: operations(),
      statement_support_vote: operations(),
    },
  };
}

const statementArgs = (overrides: Record<string, unknown> = {}) => ({
  id: 'statement',
  group_id: null,
  title: 'Title',
  text: null,
  image_url: null,
  video_url: null,
  visibility: 'public',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.can.mockResolvedValue(undefined);
  auth.canReadVisibility.mockReturnValue(false);
  vi.spyOn(Date, 'now').mockReturnValue(1_000);
});

describe('statement shared mutators A10 branch contracts', () => {
  it('authorizes client, owner, expiry, group relations, visibility, and denial paths', async () => {
    await expect(
      assertCanViewStatement(createTx('client') as never, ctx, 'client')
    ).resolves.toBeUndefined();

    await expect(
      assertCanViewStatement(createTx('server', [undefined]) as never, ctx, 'missing')
    ).rejects.toThrow('Statement not found');

    await expect(
      assertCanViewStatement(
        createTx('server', [{ id: 'owned', user_id: 'viewer' }]) as never,
        ctx,
        'owned'
      )
    ).resolves.toBeUndefined();

    await expect(
      assertCanViewStatement(
        createTx('server', [
          { id: 'expired', user_id: 'other', is_story: true, expires_at: 1, visibility: 'public' },
        ]) as never,
        ctx,
        'expired'
      )
    ).rejects.toBeInstanceOf(PermissionError);

    for (const relationRows of [
      [{ id: 'group' }, undefined, undefined],
      [undefined, { id: 'membership' }, undefined],
      [undefined, undefined, { id: 'guest' }],
    ]) {
      const tx = createTx('server', [
        { id: 'group-statement', user_id: 'other', group_id: 'group', visibility: 'private' },
        ...relationRows,
      ]);
      await expect(
        assertCanViewStatement(tx as never, ctx, 'group-statement')
      ).resolves.toBeUndefined();
    }

    auth.canReadVisibility.mockReturnValueOnce(true);
    await expect(
      assertCanViewStatement(
        createTx('server', [
          { id: 'visible', user_id: 'other', group_id: null, visibility: 'public' },
        ]) as never,
        ctx,
        'visible'
      )
    ).resolves.toBeUndefined();

    auth.canReadVisibility.mockReturnValueOnce(true);
    await expect(
      assertCanViewStatement(
        createTx('server', [
          { id: 'visible-group', user_id: 'other', group_id: 'group', visibility: 'public' },
          undefined,
          undefined,
          undefined,
        ]) as never,
        ctx,
        'visible-group'
      )
    ).resolves.toBeUndefined();

    await expect(
      assertCanViewStatement(
        createTx('server', [
          { id: 'denied', user_id: 'other', group_id: null, visibility: 'private' },
        ]) as never,
        ctx,
        'denied'
      )
    ).rejects.toBeInstanceOf(PermissionError);

    await expect(
      assertCanViewStatement(
        createTx('server', [
          { id: 'denied-group', user_id: 'other', group_id: 'group', visibility: 'private' },
          undefined,
          undefined,
          undefined,
        ]) as never,
        ctx,
        'denied-group'
      )
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it('normalizes standalone, group, full, story, expiry, and invalid create inputs', async () => {
    const plain = createTx();
    await statementSharedMutators.create.fn({
      tx: plain as never,
      ctx,
      args: statementArgs({ title: '  Title  ', text: ' ', is_story: false }) as never,
    });
    expect(plain.mutate.statement.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Title',
        text: null,
        media_type: 'text',
        is_story: false,
        expires_at: null,
        user_id: 'viewer',
        upvotes: 0,
        downvotes: 0,
        comment_count: 0,
        created_at: 1_000,
        updated_at: 1_000,
      })
    );
    expect(auth.can).not.toHaveBeenCalled();

    const groupStory = createTx();
    await statementSharedMutators.create.fn({
      tx: groupStory as never,
      ctx,
      args: statementArgs({
        group_id: 'group',
        title: null,
        image_url: ' image.png ',
        is_story: true,
      }) as never,
    });
    expect(auth.can).toHaveBeenCalledWith(
      groupStory,
      ctx,
      expect.objectContaining({ groupId: 'group' })
    );
    expect(groupStory.mutate.statement.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: 'image.png',
        media_type: 'image',
        expires_at: 86_401_000,
      })
    );

    const explicitExpiry = createTx();
    await statementSharedMutators.create.fn({
      tx: explicitExpiry as never,
      ctx,
      args: statementArgs({
        title: null,
        video_url: ' video.mp4 ',
        is_story: true,
        expires_at: 50,
      }) as never,
    });
    expect(explicitExpiry.mutate.statement.insert).toHaveBeenCalledWith(
      expect.objectContaining({ media_type: 'video', expires_at: 50 })
    );

    const full = createTx('client');
    await statementSharedMutators.createFull.fn({
      tx: full as never,
      ctx,
      args: { statement: statementArgs({ text: 'Full' }) } as never,
    });
    expect(full.mutate.statement.insert).toHaveBeenCalled();

    await expect(
      statementSharedMutators.create.fn({
        tx: createTx() as never,
        ctx,
        args: statementArgs({ image_url: 'image', video_url: 'video' }) as never,
      })
    ).rejects.toThrow('either an image or a video');
    await expect(
      statementSharedMutators.create.fn({
        tx: createTx() as never,
        ctx,
        args: statementArgs({ title: ' ', text: null, image_url: null, video_url: null }) as never,
      })
    ).rejects.toThrow('require text, title, image, or video');
  });

  it('normalizes every update field, media transition, story expiry, authorization, and invalid state', async () => {
    const previous = {
      id: 'statement',
      user_id: 'viewer',
      title: 'Old title',
      text: 'Old text',
      image_url: null,
      video_url: null,
      is_story: false,
      expires_at: null,
    };
    const complete = createTx('server', [previous]);
    await statementSharedMutators.update.fn({
      tx: complete as never,
      ctx,
      args: {
        id: 'statement',
        group_id: 'group',
        title: ' New ',
        text: ' Body ',
        image_url: ' image ',
        video_url: null,
        is_story: true,
        expires_at: 500,
      } as never,
    });
    expect(auth.can).toHaveBeenCalledWith(
      complete,
      ctx,
      expect.objectContaining({ groupId: 'group' })
    );
    expect(complete.mutate.statement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New',
        text: 'Body',
        image_url: 'image',
        video_url: null,
        media_type: 'image',
        is_story: true,
        expires_at: 500,
      })
    );

    const previousExpiry = createTx('server', [{ ...previous, expires_at: 700 }]);
    await statementSharedMutators.update.fn({
      tx: previousExpiry as never,
      ctx,
      args: { id: 'statement', video_url: 'video', image_url: null, is_story: true } as never,
    });
    expect(previousExpiry.mutate.statement.update).toHaveBeenCalledWith(
      expect.objectContaining({ media_type: 'video', expires_at: 700 })
    );

    const defaultExpiry = createTx('server', [previous]);
    await statementSharedMutators.update.fn({
      tx: defaultExpiry as never,
      ctx,
      args: { id: 'statement', is_story: true } as never,
    });
    expect(defaultExpiry.mutate.statement.update).toHaveBeenCalledWith(
      expect.objectContaining({ expires_at: 86_401_000 })
    );

    const stopStory = createTx('server', [{ ...previous, is_story: true, expires_at: 700 }]);
    await statementSharedMutators.update.fn({
      tx: stopStory as never,
      ctx,
      args: { id: 'statement', is_story: false } as never,
    });
    expect(stopStory.mutate.statement.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_story: false, expires_at: null })
    );

    const inherited = createTx('server', [previous]);
    await statementSharedMutators.update.fn({
      tx: inherited as never,
      ctx,
      args: { id: 'statement' } as never,
    });
    expect(inherited.mutate.statement.update).toHaveBeenCalledWith({
      id: 'statement',
      updated_at: 1_000,
    });

    const client = createTx('client');
    await statementSharedMutators.update.fn({
      tx: client as never,
      ctx,
      args: { id: 'client', title: 'Client' } as never,
    });
    expect(client.run).not.toHaveBeenCalled();

    await expect(
      statementSharedMutators.update.fn({
        tx: createTx('server', [previous]) as never,
        ctx,
        args: { id: 'statement', image_url: 'image', video_url: 'video' } as never,
      })
    ).rejects.toThrow('either an image or a video');
    await expect(
      statementSharedMutators.update.fn({
        tx: createTx('server', [
          { ...previous, title: null, text: null, image_url: null, video_url: null },
        ]) as never,
        ctx,
        args: { id: 'statement', title: ' ' } as never,
      })
    ).rejects.toThrow('require text, title, image, or video');
  });

  it('deletes statements and creates/deletes surveys with server and client ownership checks', async () => {
    const serverDelete = createTx('server', [{ id: 'statement', user_id: 'viewer' }]);
    await statementSharedMutators.delete.fn({
      tx: serverDelete as never,
      ctx,
      args: { id: 'statement' },
    });
    expect(serverDelete.mutate.statement.delete).toHaveBeenCalledWith({ id: 'statement' });

    const clientDelete = createTx('client');
    await statementSharedMutators.delete.fn({
      tx: clientDelete as never,
      ctx,
      args: { id: 'client' },
    });

    const createSurvey = createTx('server', [{ id: 'statement', user_id: 'viewer' }]);
    await statementSharedMutators.createSurvey.fn({
      tx: createSurvey as never,
      ctx,
      args: { id: 'survey', statement_id: 'statement', question: 'Q', ends_at: 2_000 },
    });
    expect(createSurvey.mutate.statement_survey.insert).toHaveBeenCalledWith(
      expect.objectContaining({ created_at: 1_000 })
    );

    const deleteServer = createTx('server', [
      { id: 'survey', statement_id: 'statement' },
      { id: 'statement', user_id: 'viewer' },
    ]);
    await statementSharedMutators.deleteSurvey.fn({
      tx: deleteServer as never,
      ctx,
      args: { id: 'survey' },
    });
    expect(auth.requireOwner).toHaveBeenCalledWith(
      deleteServer,
      ctx,
      'viewer',
      expect.objectContaining({ resource: 'statementSurveys' })
    );

    const deleteMissing = createTx('server', [undefined]);
    await statementSharedMutators.deleteSurvey.fn({
      tx: deleteMissing as never,
      ctx,
      args: { id: 'missing' },
    });
    expect(auth.requireOwner).toHaveBeenCalledWith(
      deleteMissing,
      ctx,
      undefined,
      expect.anything()
    );

    const deleteClient = createTx('client');
    await statementSharedMutators.deleteSurvey.fn({
      tx: deleteClient as never,
      ctx,
      args: { id: 'client-survey' },
    });
    expect(deleteClient.run).not.toHaveBeenCalled();
  });

  it('creates and deletes survey options through present, missing, and client lookup paths', async () => {
    const createServer = createTx('server', [
      { id: 'survey', statement_id: 'statement' },
      { id: 'statement', user_id: 'viewer' },
    ]);
    await statementSharedMutators.createSurveyOption.fn({
      tx: createServer as never,
      ctx,
      args: { id: 'option', survey_id: 'survey', label: 'Yes', position: 0 },
    });
    expect(createServer.mutate.statement_survey_option.insert).toHaveBeenCalledWith(
      expect.objectContaining({ vote_count: 0, created_at: 1_000 })
    );

    const createMissing = createTx('server', [undefined]);
    await statementSharedMutators.createSurveyOption.fn({
      tx: createMissing as never,
      ctx,
      args: { id: 'missing-option', survey_id: 'missing', label: 'No', position: 1 },
    });
    expect(auth.requireOwner).toHaveBeenCalledWith(
      createMissing,
      ctx,
      undefined,
      expect.anything()
    );

    const createClient = createTx('client');
    await statementSharedMutators.createSurveyOption.fn({
      tx: createClient as never,
      ctx,
      args: { id: 'client-option', survey_id: 'survey', label: 'Client', position: 2 },
    });

    const deleteServer = createTx('server', [
      { id: 'option', survey_id: 'survey' },
      { id: 'survey', statement_id: 'statement' },
      { id: 'statement', user_id: 'viewer' },
    ]);
    await statementSharedMutators.deleteSurveyOption.fn({
      tx: deleteServer as never,
      ctx,
      args: { id: 'option' },
    });
    expect(deleteServer.mutate.statement_survey_option.delete).toHaveBeenCalledWith({
      id: 'option',
    });

    const deleteMissing = createTx('server', [undefined]);
    await statementSharedMutators.deleteSurveyOption.fn({
      tx: deleteMissing as never,
      ctx,
      args: { id: 'missing-option' },
    });
    expect(auth.requireOwner).toHaveBeenCalledWith(
      deleteMissing,
      ctx,
      undefined,
      expect.anything()
    );

    const deleteClient = createTx('client');
    await statementSharedMutators.deleteSurveyOption.fn({
      tx: deleteClient as never,
      ctx,
      args: { id: 'client-option' },
    });
  });

  it('creates survey votes with client parity and server option/view validation', async () => {
    const client = createTx('client');
    await statementSharedMutators.createSurveyVote.fn({
      tx: client as never,
      ctx,
      args: { id: 'client-vote', option_id: 'option' },
    });
    expect(client.mutate.statement_survey_vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'viewer', created_at: 1_000 })
    );

    const server = createTx('server', [
      { id: 'option', survey_id: 'survey' },
      { id: 'survey', statement_id: 'statement' },
      { id: 'statement', user_id: 'viewer' },
      { id: 'statement', user_id: 'viewer' },
    ]);
    await statementSharedMutators.createSurveyVote.fn({
      tx: server as never,
      ctx,
      args: { id: 'server-vote', option_id: 'option' },
    });
    expect(server.mutate.statement_survey_vote.insert).toHaveBeenCalled();

    await expect(
      statementSharedMutators.createSurveyVote.fn({
        tx: createTx('server', [undefined]) as never,
        ctx,
        args: { id: 'missing-vote', option_id: 'missing' },
      })
    ).rejects.toThrow('Statement survey option not found');
  });

  it('deletes survey votes and creates, updates, and deletes support votes on client and server', async () => {
    const surveyClient = createTx('client');
    await statementSharedMutators.deleteSurveyVote.fn({
      tx: surveyClient as never,
      ctx,
      args: { id: 'client-vote' },
    });
    const surveyServer = createTx('server', [{ id: 'vote', user_id: 'viewer' }]);
    await statementSharedMutators.deleteSurveyVote.fn({
      tx: surveyServer as never,
      ctx,
      args: { id: 'vote' },
    });
    expect(auth.requireOwner).toHaveBeenCalledWith(
      surveyServer,
      ctx,
      'viewer',
      expect.objectContaining({ resource: 'statementSurveyVotes' })
    );

    const supportClient = createTx('client');
    await statementSharedMutators.createSupportVote.fn({
      tx: supportClient as never,
      ctx,
      args: { id: 'support', statement_id: 'statement', vote: 1 },
    });
    expect(supportClient.mutate.statement_support_vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'viewer', created_at: 1_000 })
    );

    await statementSharedMutators.updateSupportVote.fn({
      tx: supportClient as never,
      ctx,
      args: { id: 'support', vote: -1 },
    });
    await statementSharedMutators.deleteSupportVote.fn({
      tx: supportClient as never,
      ctx,
      args: { id: 'support' },
    });

    const updateServer = createTx('server', [{ id: 'support', user_id: 'viewer' }]);
    await statementSharedMutators.updateSupportVote.fn({
      tx: updateServer as never,
      ctx,
      args: { id: 'support', vote: 1 },
    });
    const deleteServer = createTx('server', [undefined]);
    await statementSharedMutators.deleteSupportVote.fn({
      tx: deleteServer as never,
      ctx,
      args: { id: 'missing' },
    });
    expect(auth.requireOwner).toHaveBeenCalledWith(
      deleteServer,
      ctx,
      undefined,
      expect.objectContaining({ action: 'delete' })
    );
  });
});
