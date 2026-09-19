import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  openSession: vi.fn(),
  acceptUpdate: vi.fn(),
  readSession: vi.fn(),
  resolveDirectly: vi.fn(),
  createWorkspace: vi.fn(),
  listWorkspaces: vi.fn(),
  shareWorkspace: vi.fn(),
  submitWorkspace: vi.fn(),
  registerSuggestion: vi.fn(),
  restoreVersion: vi.fn(),
  repairDocument: vi.fn(),
  revisions: vi.fn(),
  resumeDraft: vi.fn(),
  rebaseDraft: vi.fn(),
  proposalViews: vi.fn(),
  listComments: vi.fn(),
  changeComment: vi.fn(),
  retryDecision: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('../service', () => ({
  ...mocks,
}));
vi.mock('../proposals', () => ({
  resolveDirectly: mocks.resolveDirectly,
  submitWorkspace: mocks.submitWorkspace,
  registerSuggestion: mocks.registerSuggestion,
}));
vi.mock('../commands', () => ({ restoreVersion: mocks.restoreVersion }));
vi.mock('../repair', () => ({ repairDocument: mocks.repairDocument }));
vi.mock('../recovery', () => ({
  revisions: mocks.revisions,
  resumeDraft: mocks.resumeDraft,
  rebaseDraft: mocks.rebaseDraft,
}));
vi.mock('../comments', async original => ({
  ...(await original<typeof import('../comments')>()),
  listComments: mocks.listComments,
  changeComment: mocks.changeComment,
}));

import { handleCollaboration } from '../api';
import { CollaborationError } from '@/features/collaboration/logic/types';

const actor = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const generation = '10000000-0000-4000-8000-000000000003';
const sessionBody = {
  operation: 'session',
  reference: { kind: 'document', entityId: id, branchId: null, workspaceId: null },
};
const request = (body: unknown, origin = 'https://polity.example') =>
  new Request('https://polity.example/api/collaboration', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: actor } });
});
describe('collaboration HTTP boundary', () => {
  it('binds every workspace and recovery command to the session actor and validated revision', async () => {
    const common = { id, generation, operationId: id, expectedRevision: 5 };
    const value = [{ type: 'p', children: [{ text: 'Recovered' }] }];
    const commands = [
      ['repair', mocks.repairDocument, {}, [actor, id, generation, 5, id]],
      ['revisions', mocks.revisions, {}, [actor, id, generation]],
      ['resume', mocks.resumeDraft, { value }, [actor, id, generation, 5, id, value]],
      ['rebase', mocks.rebaseDraft, {}, [actor, id, generation, 5, id]],
      ['comments', mocks.listComments, {}, [actor, id, generation]],
      [
        'workspaces',
        mocks.listWorkspaces,
        { reference: sessionBody.reference },
        [actor, sessionBody.reference],
      ],
      ['share', mocks.shareWorkspace, { shared: true }, [actor, id, generation, true]],
      ['read', mocks.readSession, {}, [actor, id, generation]],
      ['restore', mocks.restoreVersion, { value }, [actor, id, generation, 5, id, value]],
      ['submit', mocks.submitWorkspace, {}, [actor, id, generation, 5, id]],
      [
        'workspace',
        mocks.createWorkspace,
        { type: 'followup' },
        [actor, id, generation, 5, id, 'followup'],
      ],
    ] as const;
    for (const [operation, handler, extra, args] of commands) {
      handler.mockResolvedValue({ revision: 6 });
      const response = await handleCollaboration(
        request({ ...common, operation, ...extra, userId: 'forged' })
      );
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenLastCalledWith(...args);
      expect(await response.json()).toEqual({ revision: 6 });
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });
  it('uses granular comment operations and reads content only after successful persistence', async () => {
    const change = {
      id: 'comment',
      threadId: 'thread',
      expectedRevision: 0,
      content: [],
      deleted: false,
      resolved: false,
      visibility: 'document',
    };
    mocks.changeComment.mockResolvedValue({ revision: 1 });
    expect(
      (
        await handleCollaboration(
          request({ operation: 'comment', id, generation, operationId: id, change })
        )
      ).status
    ).toBe(200);
    expect(mocks.changeComment).toHaveBeenCalledWith(actor, id, generation, id, change);
    mocks.acceptUpdate.mockResolvedValue({});
    mocks.readSession.mockResolvedValue({ revision: 2 });
    const response = await handleCollaboration(
      request({ operation: 'flush', id, generation, state: 'AAA=' }, '')
    );
    expect(await response.json()).toEqual({ revision: 2 });
    expect(mocks.acceptUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.readSession.mock.invocationCallOrder[0]
    );
  });
  it('rejects cross-origin and unauthenticated requests before opening a document', async () => {
    expect((await handleCollaboration(request(sessionBody, 'https://other.example'))).status).toBe(
      403
    );
    expect(mocks.getSession).not.toHaveBeenCalled();
    mocks.getSession.mockResolvedValueOnce(null);
    expect((await handleCollaboration(request(sessionBody))).status).toBe(401);
    expect(mocks.openSession).not.toHaveBeenCalled();
  });
  it('uses the authenticated actor and reports maintenance without sending a state', async () => {
    mocks.openSession.mockResolvedValue({ phase: 'maintenance' });
    const response = await handleCollaboration(request({ ...sessionBody, userId: 'forged' }));
    expect(mocks.openSession).toHaveBeenCalledWith(actor, sessionBody.reference);
    expect(await response.json()).toEqual({ phase: 'maintenance' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('does not read or return a document after its update is denied', async () => {
    mocks.acceptUpdate.mockRejectedValue(new CollaborationError('write_denied', 403));
    const response = await handleCollaboration(
      request({ operation: 'flush', id, generation, state: 'AAA=' })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'write_denied' });
    expect(mocks.readSession).not.toHaveBeenCalled();
  });
  it.each(['proposals', 'retryDecision', 'registerSuggestion', 'resolve'])(
    'retires amendment operation %s without calling decision handlers',
    async operation => {
      const response = await handleCollaboration(
        request({
          operation,
          id,
          generation,
          expectedRevision: 5,
          operationId: id,
          changeRequestId: id,
          suggestionId: 's',
          result: 'accepted',
        })
      );
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({ error: 'legacy_editor_required' });
      expect(mocks.resolveDirectly).not.toHaveBeenCalled();
      expect(mocks.registerSuggestion).not.toHaveBeenCalled();
      expect(mocks.retryDecision).not.toHaveBeenCalled();
    }
  );
  it('rejects malformed commands and invalid JSON as client errors', async () => {
    expect(
      (
        await handleCollaboration(
          request({ operation: 'resolve', id, generation, expectedRevision: -1 })
        )
      ).status
    ).toBe(400);
    const invalid = new Request('https://polity.example/api/collaboration', {
      method: 'POST',
      body: '{',
    });
    expect((await handleCollaboration(invalid)).status).toBe(400);
    expect(mocks.resolveDirectly).not.toHaveBeenCalled();
    expect(mocks.openSession).not.toHaveBeenCalled();
  });
  it('does not expose internal failures or claim a failed command was saved', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      mocks.openSession.mockRejectedValueOnce(new Error('private database detail'));
      const response = await handleCollaboration(request(sessionBody));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'collaboration_failed' });
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
});
