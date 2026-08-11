import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator = (value: unknown) => value;
    const chain = {
      validator(nextValidator: (value: unknown) => unknown) {
        validator = nextValidator;
        return chain;
      },
      handler(handler: (input: any) => unknown) {
        return (input: any) => handler({ ...input, data: validator(input.data) });
      },
    };
    return chain;
  },
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

async function loadModule() {
  return import('../createTimelineEvent');
}

function baseData(overrides: Record<string, unknown> = {}) {
  return {
    eventType: 'created',
    entityType: 'group',
    entityId: '00000000-0000-4000-8000-000000000001',
    actorId: '00000000-0000-4000-8000-000000000002',
    title: 'Created group',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.SUPABASE_URL = 'https://supabase.test';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  mocks.insert.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.createClient.mockReturnValue({ from: mocks.from });
  vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('event-uuid') });
});

describe('createTimelineEvent', () => {
  it('rejects a missing Supabase URL before creating a client', async () => {
    delete process.env.SUPABASE_URL;
    const { createTimelineEvent } = await loadModule();
    await expect((createTimelineEvent as any)({ data: baseData() })).rejects.toThrow(
      '[Timeline] SUPABASE_URL is not configured'
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('inserts minimal events, reuses the client and logs rather than throwing insert errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.insert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'write failed' } });
    const { createTimelineEvent } = await loadModule();

    await (createTimelineEvent as any)({ data: baseData() });
    await (createTimelineEvent as any)({ data: baseData({ tags: [] }) });

    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.createClient).toHaveBeenCalledWith('https://supabase.test', '');
    expect(mocks.from).toHaveBeenCalledWith('timeline_event');
    expect(mocks.insert.mock.calls[0]?.[0]).toEqual({
      id: 'event-uuid',
      event_type: 'created',
      entity_type: 'group',
      entity_id: '00000000-0000-4000-8000-000000000001',
      actor_id: '00000000-0000-4000-8000-000000000002',
      title: 'Created group',
      description: null,
      created_at: expect.any(String),
      content_type: 'group',
      group_id: '00000000-0000-4000-8000-000000000001',
    });
    expect(consoleError).toHaveBeenCalledWith('[Timeline] Failed to create timeline event:', {
      message: 'write failed',
    });
  });

  it('persists every optional event section with the service-role key', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    const { createTimelineEvent } = await loadModule();
    const endsAt = new Date('2026-08-04T12:00:00.000Z');

    await (createTimelineEvent as any)({
      data: baseData({
        entityType: 'event',
        description: 'Full description',
        contentType: 'video',
        tags: ['assembly', 'live'],
        metadata: { source: 'camera', featured: true, index: 2, empty: null },
        media: {
          imageURL: 'https://cdn.test/image.jpg',
          videoURL: 'https://cdn.test/video.mp4',
          videoThumbnailURL: 'https://cdn.test/thumb.jpg',
          videoDuration: 120,
        },
        status: {
          voteStatus: 'open',
          electionStatus: 'voting',
          endsAt,
        },
        stats: { likes: 1, views: 2, comments: 3, shares: 4 },
      }),
    });

    expect(mocks.createClient).toHaveBeenCalledWith('https://supabase.test', 'service-key');
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: '00000000-0000-4000-8000-000000000001',
        description: 'Full description',
        content_type: 'video',
        tags: ['assembly', 'live'],
        metadata: { source: 'camera', featured: true, index: 2, empty: null },
        image_url: 'https://cdn.test/image.jpg',
        video_url: 'https://cdn.test/video.mp4',
        video_thumbnail_url: 'https://cdn.test/thumb.jpg',
        vote_status: 'open',
        election_status: 'voting',
        ends_at: endsAt,
        stats: { likes: 1, views: 2, comments: 3, shares: 4 },
      })
    );
  });

  it('accepts present optional objects whose individual values are absent', async () => {
    const { createTimelineEvent } = await loadModule();
    await (createTimelineEvent as any)({
      data: baseData({ media: {}, status: {}, stats: {}, metadata: {} }),
    });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ metadata: {}, stats: {} }));
    expect(mocks.insert.mock.calls[0]?.[0]).not.toHaveProperty('image_url');
    expect(mocks.insert.mock.calls[0]?.[0]).not.toHaveProperty('vote_status');
  });

  it('validates required input before attempting persistence', async () => {
    const { createTimelineEvent } = await loadModule();
    expect(() => (createTimelineEvent as any)({ data: { eventType: 'created' } })).toThrow();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe('timeline media helpers', () => {
  it('creates video events with default and linked entities', async () => {
    const { createVideoUploadEvent } = await loadModule();
    await createVideoUploadEvent({
      videoURL: 'https://cdn.test/video.mp4',
      videoThumbnailURL: 'https://cdn.test/thumb.jpg',
      videoDuration: 90,
      title: 'Video',
      actorId: '00000000-0000-4000-8000-000000000002',
    });
    expect(mocks.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        event_type: 'video_uploaded',
        entity_type: 'user',
        entity_id: '00000000-0000-4000-8000-000000000002',
        content_type: 'video',
        video_url: 'https://cdn.test/video.mp4',
      })
    );

    await createVideoUploadEvent({
      videoURL: 'https://cdn.test/video-2.mp4',
      title: 'Linked video',
      description: 'Description',
      actorId: '00000000-0000-4000-8000-000000000002',
      linkedEntityType: 'group',
      linkedEntityId: '00000000-0000-4000-8000-000000000003',
      tags: ['linked'],
    });
    expect(mocks.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entity_type: 'group',
        entity_id: '00000000-0000-4000-8000-000000000003',
        description: 'Description',
        tags: ['linked'],
      })
    );
  });

  it('creates image events with default and linked entities', async () => {
    const { createImageUploadEvent } = await loadModule();
    await createImageUploadEvent({
      imageURL: 'https://cdn.test/image.jpg',
      title: 'Image',
      actorId: '00000000-0000-4000-8000-000000000002',
    });
    expect(mocks.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        event_type: 'image_uploaded',
        entity_type: 'user',
        entity_id: '00000000-0000-4000-8000-000000000002',
        content_type: 'image',
        image_url: 'https://cdn.test/image.jpg',
      })
    );

    await createImageUploadEvent({
      imageURL: 'https://cdn.test/image-2.jpg',
      title: 'Linked image',
      description: 'Description',
      actorId: '00000000-0000-4000-8000-000000000002',
      linkedEntityType: 'blog',
      linkedEntityId: '00000000-0000-4000-8000-000000000004',
      tags: ['cover'],
    });
    expect(mocks.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entity_type: 'blog',
        entity_id: '00000000-0000-4000-8000-000000000004',
        description: 'Description',
        tags: ['cover'],
      })
    );
  });
});
