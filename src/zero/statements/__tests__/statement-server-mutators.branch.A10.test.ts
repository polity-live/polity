import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCtx,
  createTxHarness,
  installDeterministicGlobals,
} from '../../__tests__/test-utils/zeroHarness';

const mocks = vi.hoisted(() => ({ syncHashtags: vi.fn() }));

vi.mock('../../common/server-hashtags', () => ({
  syncEntityHashtagsForCreate: (...args: unknown[]) => mocks.syncHashtags(...args),
}));

import { STATEMENT_STORY_DURATION_MS } from '../content';
import { statementServerMutators } from '../server-mutators';

const base = {
  id: 'statement-1',
  title: null,
  text: 'Base text',
  group_id: null,
  image_url: null,
  video_url: null,
  visibility: 'public',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.syncHashtags.mockResolvedValue(undefined);
});

describe('statement server mutator exhaustive branch campaign A10', () => {
  it('creates explicit and default-expiry stories with fallback and truncated timeline text', async () => {
    const globals = installDeterministicGlobals({
      now: 1_000,
      uuids: ['timeline-1', 'timeline-2'],
    });
    const first = createTxHarness();
    await statementServerMutators.create.fn({
      tx: first.tx as never,
      ctx: createCtx({ userID: 'author' }),
      args: {
        ...base,
        id: 'story-explicit',
        title: '   ',
        text: 'x'.repeat(101),
        is_story: true,
        expires_at: 5_000,
      } as never,
    });
    expect(first.mutation('timeline_event', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({
        description: `${'x'.repeat(100)}...`,
        ends_at: 5_000,
        image_url: '',
        video_url: '',
        group_id: null,
      })
    );

    const second = createTxHarness();
    await statementServerMutators.create.fn({
      tx: second.tx as never,
      ctx: createCtx({ userID: 'author' }),
      args: { ...base, id: 'story-default', title: 'Headline', is_story: true } as never,
    });
    expect(second.mutation('timeline_event', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({ ends_at: 1_000 + STATEMENT_STORY_DURATION_MS, title: 'Headline' })
    );

    const regular = createTxHarness();
    await statementServerMutators.create.fn({
      tx: regular.tx as never,
      ctx: createCtx({ userID: 'author' }),
      args: { ...base, id: 'regular', is_story: false } as never,
    });
    expect(regular.mutation('timeline_event', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({ ends_at: 0 })
    );
    globals.restore();
  });

  it('creates full statements with and without surveys and all survey options', async () => {
    const empty = createTxHarness({ location: 'client' });
    await statementServerMutators.createFull.fn({
      tx: empty.tx as never,
      ctx: createCtx(),
      args: {
        statement: { ...base, id: 'private', visibility: 'private' },
        hashtags: [],
      } as never,
    });
    expect(mocks.syncHashtags).toHaveBeenCalledWith(
      empty.tx,
      expect.anything(),
      'statement',
      'private',
      []
    );

    const survey = createTxHarness({ location: 'client' });
    await statementServerMutators.createFull.fn({
      tx: survey.tx as never,
      ctx: createCtx(),
      args: {
        statement: { ...base, id: 'survey-statement', visibility: 'private' },
        hashtags: ['civic'],
        survey: {
          record: {
            id: 'survey',
            statement_id: 'survey-statement',
            question: 'Question?',
            ends_at: 10_000,
          },
          options: [
            { id: 'one', survey_id: 'survey', label: 'One', position: 0 },
            { id: 'two', survey_id: 'survey', label: 'Two', position: 1 },
          ],
        },
      } as never,
    });
    expect(survey.mutation('statement_survey', 'insert')).toHaveBeenCalled();
    expect(survey.mutation('statement_survey_option', 'insert')).toHaveBeenCalledTimes(2);
  });

  it('returns after a missing previous row and uses explicit update fields and group', async () => {
    const missing = createTxHarness({ location: 'client' });
    missing.queueRunResults(undefined, { ...base, id: 'missing', user_id: 'user-1' });
    await statementServerMutators.update.fn({
      tx: missing.tx as never,
      ctx: createCtx(),
      args: { id: 'missing' } as never,
    });
    expect(missing.mutation('timeline_event', 'insert')).not.toHaveBeenCalled();

    const globals = installDeterministicGlobals({ now: 2_000, uuids: 'timeline-update' });
    const update = createTxHarness({ location: 'client' });
    update.queueRunResults({
      ...base,
      id: 'statement',
      title: 'Old',
      text: 'Old text',
      group_id: 'old-group',
      image_url: 'old-image',
      video_url: 'old-video',
      is_story: false,
      expires_at: null,
      user_id: 'author',
    });
    update.queueRunResults({
      ...base,
      id: 'statement',
      title: 'Old',
      text: 'Old text',
      group_id: 'old-group',
      image_url: 'old-image',
      video_url: 'old-video',
      is_story: false,
      expires_at: null,
      user_id: 'author',
    });
    await statementServerMutators.update.fn({
      tx: update.tx as never,
      ctx: createCtx({ userID: 'author' }),
      args: {
        id: 'statement',
        visibility: 'public',
        is_story: true,
        expires_at: 9_000,
        title: 'New title',
        text: null,
        image_url: null,
        video_url: null,
        group_id: 'new-group',
      } as never,
    });
    expect(update.mutation('timeline_event', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New title',
        description: '',
        group_id: 'new-group',
        ends_at: 9_000,
      })
    );
    globals.restore();
  });

  it('merges previous fields and covers previous and generated story expiries', async () => {
    const previousExpiry = createTxHarness({ location: 'client' });
    previousExpiry.queueRunResults({
      ...base,
      id: 'statement',
      title: null,
      text: 'Previous body',
      visibility: 'public',
      is_story: true,
      expires_at: 7_000,
      user_id: 'user-1',
    });
    previousExpiry.queueRunResults({
      ...base,
      id: 'statement',
      title: null,
      text: 'Previous body',
      visibility: 'public',
      is_story: true,
      expires_at: 7_000,
      user_id: 'user-1',
    });
    await statementServerMutators.update.fn({
      tx: previousExpiry.tx as never,
      ctx: createCtx(),
      args: { id: 'statement' } as never,
    });
    expect(previousExpiry.mutation('timeline_event', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({ ends_at: 7_000 })
    );

    const globals = installDeterministicGlobals({ now: 3_000, uuids: 'generated-expiry' });
    const generated = createTxHarness({ location: 'client' });
    generated.queueRunResults({
      ...base,
      id: 'statement',
      visibility: 'public',
      is_story: true,
      expires_at: null,
      user_id: 'user-1',
    });
    generated.queueRunResults({
      ...base,
      id: 'statement',
      visibility: 'public',
      is_story: true,
      expires_at: null,
      user_id: 'user-1',
    });
    await statementServerMutators.update.fn({
      tx: generated.tx as never,
      ctx: createCtx(),
      args: { id: 'statement' } as never,
    });
    expect(generated.mutation('timeline_event', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({ ends_at: 3_000 + STATEMENT_STORY_DURATION_MS })
    );

    const regular = createTxHarness({ location: 'client' });
    regular.queueRunResults({ ...base, id: 'regular', visibility: 'public', is_story: false });
    await statementServerMutators.update.fn({
      tx: regular.tx as never,
      ctx: createCtx(),
      args: { id: 'regular' } as never,
    });
    expect(regular.mutation('timeline_event', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({ ends_at: 0 })
    );

    const privateUpdate = createTxHarness({ location: 'client' });
    privateUpdate.queueRunResults({ ...base, id: 'private-update', visibility: 'public' });
    await statementServerMutators.update.fn({
      tx: privateUpdate.tx as never,
      ctx: createCtx(),
      args: { id: 'private-update', visibility: 'private' } as never,
    });
    expect(privateUpdate.mutation('timeline_event', 'insert')).not.toHaveBeenCalled();
    globals.restore();
  });
});
