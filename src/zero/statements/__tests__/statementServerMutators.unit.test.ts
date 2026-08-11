import { describe, expect, it } from 'vitest';

import {
  createCtx,
  createTxHarness,
  installDeterministicGlobals,
} from '../../__tests__/test-utils/zeroHarness';
import { statementServerMutators } from '../server-mutators';

const publicCreateArgs = {
  id: 'statement-1',
  text: 'A public statement',
  group_id: null,
  image_url: 'https://example.com/image.jpg',
  video_url: null,
  visibility: 'public',
};

describe('statementServerMutators', () => {
  it('creates a timeline event when creating a public statement', async () => {
    const globals = installDeterministicGlobals({
      now: 1_700_000_000_123,
      uuids: 'timeline-event-1',
    });
    const { tx, mutation } = createTxHarness();

    await statementServerMutators.create.fn({
      tx: tx as never,
      ctx: createCtx({ userID: 'author-1' }),
      args: publicCreateArgs,
    });

    expect(mutation('statement', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'statement-1',
        user_id: 'author-1',
        visibility: 'public',
      })
    );
    expect(mutation('timeline_event', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'timeline-event-1',
        event_type: 'statement_posted',
        entity_type: 'statement',
        entity_id: 'statement-1',
        actor_id: 'author-1',
        user_id: 'author-1',
        statement_id: 'statement-1',
        image_url: 'https://example.com/image.jpg',
        created_at: 1_700_000_000_123,
      })
    );

    globals.restore();
  });

  it('does not create a timeline event when creating a non-public statement', async () => {
    const { tx, mutation } = createTxHarness();

    await statementServerMutators.create.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        ...publicCreateArgs,
        id: 'statement-private',
        visibility: 'private',
      },
    });

    expect(mutation('statement', 'insert')).toHaveBeenCalled();
    expect(mutation('timeline_event', 'insert')).not.toHaveBeenCalled();
  });

  it('creates an updated timeline event using merged statement values', async () => {
    const globals = installDeterministicGlobals({
      now: 1_700_000_000_456,
      uuids: 'timeline-event-update',
    });
    const previousStatement = {
      id: 'statement-1',
      user_id: 'author-1',
      group_id: 'group-1',
      text: 'Previous text',
      image_url: 'https://example.com/old.jpg',
      video_url: null,
      visibility: 'public',
    };
    const { tx, queueRunResults, mutation } = createTxHarness();
    queueRunResults(previousStatement, previousStatement);

    await statementServerMutators.update.fn({
      tx: tx as never,
      ctx: createCtx({ userID: 'author-1' }),
      args: {
        id: 'statement-1',
        text: 'Updated text',
        image_url: null,
        video_url: 'https://example.com/new-video.mp4',
      },
    });

    expect(mutation('statement', 'update')).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'statement-1',
        text: 'Updated text',
        image_url: null,
        video_url: 'https://example.com/new-video.mp4',
      })
    );
    expect(mutation('timeline_event', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'timeline-event-update',
        event_type: 'updated',
        entity_id: 'statement-1',
        actor_id: 'author-1',
        user_id: 'author-1',
        group_id: 'group-1',
        description: 'Updated text',
        image_url: '',
        video_url: 'https://example.com/new-video.mp4',
        created_at: 1_700_000_000_456,
      })
    );

    globals.restore();
  });

  it('does not create a timeline event when the resulting visibility is non-public', async () => {
    const previousStatement = {
      id: 'statement-1',
      user_id: 'author-1',
      group_id: null,
      text: 'Previous text',
      image_url: null,
      video_url: null,
      visibility: 'public',
    };
    const { tx, queueRunResults, mutation } = createTxHarness();
    queueRunResults(previousStatement, previousStatement);

    await statementServerMutators.update.fn({
      tx: tx as never,
      ctx: createCtx({ userID: 'author-1' }),
      args: {
        id: 'statement-1',
        visibility: 'authenticated',
      },
    });

    expect(mutation('statement', 'update')).toHaveBeenCalled();
    expect(mutation('timeline_event', 'insert')).not.toHaveBeenCalled();
  });
});
