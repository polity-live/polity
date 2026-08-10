import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  session: vi.fn(),
  executeRead: vi.fn(),
  groupAccess: vi.fn(),
  amendmentAccess: vi.fn(),
  eventAccess: vi.fn(),
  blogAccess: vi.fn(),
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
vi.mock('@tanstack/react-start/server', () => ({ getRequest: mocks.request }));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.session }));
vi.mock('@/server/zero-mutate', () => ({ executeZeroRead: mocks.executeRead }));
vi.mock('@/features/auth/logic/privateEntityRelationshipAccess', () => ({
  hasPrivateGroupRouteAccess: mocks.groupAccess,
  hasPrivateAmendmentRouteAccess: mocks.amendmentAccess,
  hasPrivateEventRouteAccess: mocks.eventAccess,
  hasPrivateBlogRouteAccess: mocks.blogAccess,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/zero/schema', () => ({
  zql: new Proxy(
    {},
    {
      get(_target, table) {
        const chain = {
          table: String(table),
          filters: [] as unknown[][],
          relations: [] as string[],
          isOne: false,
          where(...args: unknown[]) {
            chain.filters.push(args);
            return chain;
          },
          related(relation: string) {
            chain.relations.push(relation);
            return chain;
          },
          one() {
            chain.isOne = true;
            return chain;
          },
        };
        return chain;
      },
    }
  ),
}));

import { entityRouteAccessFn } from '../entity-route-access';

interface QueryDescription {
  table: string;
  filters: unknown[][];
  relations: string[];
  isOne: boolean;
}

type Records = Partial<Record<QueryDescription['table'], unknown>>;

function installDatabase(records: Records) {
  const run = vi.fn(async (query: QueryDescription) => {
    if (!(query.table in records)) {
      throw new Error(`Unexpected query: ${JSON.stringify(query)}`);
    }
    return records[query.table];
  });
  mocks.executeRead.mockImplementation(async (callback: (tx: { run: typeof run }) => unknown) =>
    callback({ run })
  );
  return run;
}

async function check(data: Record<string, unknown>) {
  return (entityRouteAccessFn as any)({ data });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockReturnValue({ headers: new Headers() });
  mocks.session.mockResolvedValue({ user: { id: 'viewer-1' } });
  mocks.groupAccess.mockReturnValue(true);
  mocks.amendmentAccess.mockReturnValue(true);
  mocks.eventAccess.mockReturnValue(true);
  mocks.blogAccess.mockReturnValue(true);
});

describe('entityRouteAccessFn validation and request boundary', () => {
  it('requires parent type and id together while accepting neither or both', async () => {
    installDatabase({ user: null, blog: null });

    await expect(check({ entityType: 'user', entityId: 'user-1' })).resolves.toMatchObject({
      exists: false,
    });
    await expect(
      check({ entityType: 'blog', entityId: 'blog-1', parentType: 'group', parentId: 'group-1' })
    ).resolves.toMatchObject({ exists: false });
    await expect(
      check({ entityType: 'blog', entityId: 'blog-1', parentType: 'group' })
    ).rejects.toThrow();
    await expect(
      check({ entityType: 'blog', entityId: 'blog-1', parentId: 'group-1' })
    ).rejects.toThrow();
  });

  it('rejects calls without a request before session or database access', async () => {
    mocks.request.mockReturnValue(undefined);

    await expect(check({ entityType: 'user', entityId: 'user-1' })).rejects.toThrow(
      'Request context unavailable.'
    );
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.executeRead).not.toHaveBeenCalled();
  });
});

describe('entityRouteAccessFn entity policies', () => {
  it('allows only the requested user to read a private user route', async () => {
    const run = installDatabase({ user: { id: 'viewer-1', visibility: 'private' } });
    await expect(check({ entityType: 'user', entityId: 'viewer-1' })).resolves.toEqual({
      exists: true,
      visibilities: ['private'],
      canAccessPrivate: true,
    });

    installDatabase({ user: { id: 'other-1', visibility: null } });
    await expect(check({ entityType: 'user', entityId: 'other-1' })).resolves.toEqual({
      exists: true,
      visibilities: [null],
      canAccessPrivate: false,
    });
    expect(run.mock.calls[0]?.[0]).toMatchObject({
      table: 'user',
      filters: [['id', 'viewer-1']],
      isOne: true,
    });
  });

  it('returns an empty denial for a missing user', async () => {
    installDatabase({ user: null });
    await expect(check({ entityType: 'user', entityId: 'missing' })).resolves.toEqual({
      exists: false,
      visibilities: [],
      canAccessPrivate: false,
    });
  });

  it('loads group membership and guest status for an authenticated viewer', async () => {
    const run = installDatabase({
      group: { id: 'group-1', owner_id: 'owner-1', visibility: 'members' },
      group_membership: [{ status: 'active' }, { status: 'requested' }],
      group_guest_access: [{ status: 'invited' }],
    });
    await expect(check({ entityType: 'group', entityId: 'group-1' })).resolves.toEqual({
      exists: true,
      visibilities: ['members'],
      canAccessPrivate: true,
    });
    expect(mocks.groupAccess).toHaveBeenCalledWith(
      'owner-1',
      'viewer-1',
      ['active', 'requested'],
      ['invited']
    );
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('uses empty relationship lists for anonymous group access and denies missing groups', async () => {
    mocks.session.mockResolvedValue(null);
    const run = installDatabase({
      group: { id: 'group-1', owner_id: 'owner-1', visibility: 'private' },
    });
    await expect(check({ entityType: 'group', entityId: 'group-1' })).resolves.toMatchObject({
      exists: true,
      canAccessPrivate: true,
    });
    expect(mocks.groupAccess).toHaveBeenCalledWith('owner-1', null, [], []);
    expect(run).toHaveBeenCalledTimes(1);

    installDatabase({ group: null });
    await expect(check({ entityType: 'group', entityId: 'missing' })).resolves.toEqual({
      exists: false,
      visibilities: [],
      canAccessPrivate: false,
    });
  });

  it('checks amendment collaborators and includes the related group visibility', async () => {
    installDatabase({
      amendment: {
        id: 'amendment-1',
        created_by_id: 'author-1',
        visibility: 'private',
        group: { visibility: 'members' },
      },
      amendment_collaborator: [{ status: 'active' }],
    });
    await expect(check({ entityType: 'amendment', entityId: 'amendment-1' })).resolves.toEqual({
      exists: true,
      visibilities: ['private', 'members'],
      canAccessPrivate: true,
    });
    expect(mocks.amendmentAccess).toHaveBeenCalledWith('author-1', 'viewer-1', ['active']);
  });

  it('handles anonymous and missing amendments without collaborator queries', async () => {
    mocks.session.mockResolvedValue(undefined);
    const run = installDatabase({
      amendment: {
        created_by_id: 'author-1',
        visibility: 'private',
        group: undefined,
      },
    });
    await expect(check({ entityType: 'amendment', entityId: 'amendment-1' })).resolves.toEqual({
      exists: true,
      visibilities: ['private', undefined],
      canAccessPrivate: true,
    });
    expect(mocks.amendmentAccess).toHaveBeenCalledWith('author-1', null, []);
    expect(run).toHaveBeenCalledTimes(1);

    installDatabase({ amendment: null });
    await expect(check({ entityType: 'amendment', entityId: 'missing' })).resolves.toMatchObject({
      exists: false,
      canAccessPrivate: false,
    });
  });

  it('checks event participants and includes the related group visibility', async () => {
    installDatabase({
      event: {
        id: 'event-1',
        creator_id: 'creator-1',
        visibility: 'public',
        group: { visibility: 'members' },
      },
      event_participant: [{ status: 'active' }, { status: 'invited' }],
    });
    await expect(check({ entityType: 'event', entityId: 'event-1' })).resolves.toEqual({
      exists: true,
      visibilities: ['public', 'members'],
      canAccessPrivate: true,
    });
    expect(mocks.eventAccess).toHaveBeenCalledWith('creator-1', 'viewer-1', ['active', 'invited']);
  });

  it('handles anonymous and missing events without participant queries', async () => {
    mocks.session.mockResolvedValue(null);
    const run = installDatabase({
      event: { creator_id: 'creator-1', visibility: 'private', group: undefined },
    });
    await expect(check({ entityType: 'event', entityId: 'event-1' })).resolves.toEqual({
      exists: true,
      visibilities: ['private', undefined],
      canAccessPrivate: true,
    });
    expect(mocks.eventAccess).toHaveBeenCalledWith('creator-1', null, []);
    expect(run).toHaveBeenCalledTimes(1);

    installDatabase({ event: null });
    await expect(check({ entityType: 'event', entityId: 'missing' })).resolves.toMatchObject({
      exists: false,
      canAccessPrivate: false,
    });
  });

  it('denies missing blogs and parent mismatches before private-access evaluation', async () => {
    installDatabase({ blog: null });
    await expect(check({ entityType: 'blog', entityId: 'missing' })).resolves.toEqual({
      exists: false,
      visibilities: [],
      canAccessPrivate: false,
    });

    installDatabase({ blog: { group_id: 'group-2', bloggers: [] } });
    await expect(
      check({ entityType: 'blog', entityId: 'blog-1', parentType: 'group', parentId: 'group-1' })
    ).resolves.toMatchObject({ exists: false });

    installDatabase({ blog: { group_id: null, bloggers: [{ user_id: 'other-1' }] } });
    await expect(
      check({ entityType: 'blog', entityId: 'blog-1', parentType: 'user', parentId: 'viewer-1' })
    ).resolves.toMatchObject({ exists: false });

    installDatabase({ blog: { group_id: null, bloggers: undefined } });
    await expect(
      check({ entityType: 'blog', entityId: 'blog-1', parentType: 'user', parentId: 'viewer-1' })
    ).resolves.toMatchObject({ exists: false });
    expect(mocks.blogAccess).not.toHaveBeenCalled();
  });

  it('accepts matching group and user parents and forwards the viewer blogger statuses', async () => {
    const blog = {
      group_id: 'group-1',
      visibility: 'private',
      bloggers: [
        { user_id: 'viewer-1', status: 'active' },
        { user_id: 'other-1', status: 'active' },
        { user_id: 'viewer-1', status: 'invited' },
      ],
    };
    installDatabase({ blog });
    await expect(
      check({ entityType: 'blog', entityId: 'blog-1', parentType: 'group', parentId: 'group-1' })
    ).resolves.toEqual({
      exists: true,
      visibilities: ['private'],
      canAccessPrivate: true,
    });

    await expect(
      check({ entityType: 'blog', entityId: 'blog-1', parentType: 'user', parentId: 'viewer-1' })
    ).resolves.toMatchObject({ exists: true });
    expect(mocks.blogAccess).toHaveBeenLastCalledWith('viewer-1', ['active', 'invited']);
  });

  it('normalizes a missing blogger relation and allows a blog without a parent constraint', async () => {
    installDatabase({ blog: { group_id: null, visibility: 'public', bloggers: undefined } });
    await expect(check({ entityType: 'blog', entityId: 'blog-1' })).resolves.toEqual({
      exists: true,
      visibilities: ['public'],
      canAccessPrivate: true,
    });
    expect(mocks.blogAccess).toHaveBeenCalledWith('viewer-1', []);
  });
});
