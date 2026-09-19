import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionError } from '@/zero/rbac/errors';
const io = vi.hoisted(() => ({
  can: vi.fn(),
  view: vi.fn(),
  mode: vi.fn(),
  event: vi.fn(),
  run: vi.fn(),
  query: vi.fn(),
}));
vi.mock('@/zero/rbac/can', () => ({ can: io.can }));
vi.mock('@/zero/rbac/amendment-access', () => ({ assertCanViewAmendment: io.view }));
vi.mock('@/zero/amendments/server-mutators', () => ({
  amendmentServerMutatorInternals: {
    resolveChangeRequestMutationEditingMode: io.mode,
    findCurrentProcessEventId: io.event,
  },
}));
import { permitted, resolveAccess } from '../access';
const tx: any = { location: 'server', run: io.run, dbTransaction: { query: io.query } };
const reference = {
  kind: 'document' as const,
  entityId: 'entity',
  branchId: null,
  workspaceId: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  io.run.mockReset();
  io.can.mockReset().mockResolvedValue(undefined);
  io.view.mockReset().mockResolvedValue(undefined);
  io.mode.mockResolvedValue({ mode: 'edit', branch: null });
  io.event.mockResolvedValue('event');
  io.query.mockReset().mockResolvedValue([]);
});
describe('central rights and phase mapping', () => {
  it('requires an identity and preserves unexpected policy errors instead of converting them into grants', async () => {
    await expect(resolveAccess(tx, '', reference)).rejects.toThrow('authentication_required');
    await expect(resolveAccess(tx, 'anon', reference)).rejects.toThrow('authentication_required');
    const check = { action: 'update' as const, resource: 'blogs' as const, blogId: 'blog' };
    expect(await permitted(tx, 'actor', check)).toBe(true);
    expect(io.can).toHaveBeenCalledWith(tx, { userID: 'actor' }, check);
    io.can.mockRejectedValueOnce(new PermissionError('update', 'blogs'));
    expect(await permitted(tx, 'actor', check)).toBe(false);
    io.can.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(permitted(tx, 'actor', check)).rejects.toThrow('database unavailable');
  });
  it('uses the Studio access function and refuses nonexistent projects or branch aliases', async () => {
    const ref = { ...reference, kind: 'studio' as const };
    await expect(resolveAccess(tx, 'actor', ref)).rejects.toThrow('access_denied');
    io.query.mockResolvedValue([{ document: {}, read: false, edit: true }]);
    await expect(resolveAccess(tx, 'actor', ref)).rejects.toThrow('access_denied');
    io.query.mockResolvedValue([{ document: {}, read: true, edit: false }]);
    expect((await resolveAccess(tx, 'actor', ref)).capabilities).toEqual({
      read: true,
      edit: false,
      suggest: false,
      comment: false,
      vote: false,
      manage: false,
    });
    await expect(resolveAccess(tx, 'actor', { ...ref, branchId: 'foreign' })).rejects.toThrow(
      'access_denied'
    );
    io.query.mockResolvedValue([{ document: {}, read: true, edit: true }]);
    expect((await resolveAccess(tx, 'actor', ref)).capabilities).toMatchObject({
      edit: true,
      suggest: true,
      comment: true,
      manage: true,
      vote: false,
    });
  });
  it.each(['document', 'blog', 'city'] as const)(
    'rejects retired %s rooms before reading content',
    async kind => {
      await expect(resolveAccess(tx, 'actor', { ...reference, kind })).rejects.toThrow(
        'legacy_editor_required'
      );
      expect(io.run).not.toHaveBeenCalled();
      expect(io.query).not.toHaveBeenCalled();
    }
  );
});
