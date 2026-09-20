import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CollaborationError } from '@/features/collaboration/logic/types';
import {
  collaborationDiagnostics,
  collaborationFailures,
  recordCollaborationFailure,
} from '../diagnostics';
beforeEach(() => {
  Object.assign(collaborationFailures, { denied: 0, storage: 0, conflicts: 0 });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());
it('distinguishes permission, conflict and storage failures without logging private content', () => {
  recordCollaborationFailure(new CollaborationError('access_denied', 403));
  recordCollaborationFailure(new CollaborationError('authentication_required', 401));
  recordCollaborationFailure(new CollaborationError('generation_changed', 409));
  recordCollaborationFailure(new CollaborationError('collaboration_unavailable', 503));
  recordCollaborationFailure(new Error('private user document'));
  expect(collaborationFailures).toEqual({ denied: 2, conflicts: 1, storage: 2 });
  expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('private user document');
});
it('reports durable pending work and per-document integrity failures separately from global readiness', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(10000);
  const row = {
    phase: 'active',
    compatibility: false,
    schema_errors: 0,
    integrity_errors: 1,
    pending_deliveries: 2,
    oldest_pending_at: 4000,
    pending_exports: 3,
    failed_exports: 1,
  };
  const query = vi.fn().mockResolvedValue([row]);
  expect(await collaborationDiagnostics({ query })).toMatchObject({
    writeReady: true,
    pendingDeliveryAgeMs: 6000,
    integrity_errors: 1,
    pending_exports: 3,
  });
  row.schema_errors = 1;
  expect((await collaborationDiagnostics({ query })).writeReady).toBe(false);
  row.schema_errors = 0;
  row.phase = 'maintenance';
  expect((await collaborationDiagnostics({ query })).writeReady).toBe(false);
  query.mockResolvedValue([{ ...row, oldest_pending_at: null }]);
  expect((await collaborationDiagnostics({ query })).pendingDeliveryAgeMs).toBe(0);
  query.mockResolvedValue([]);
  await expect(collaborationDiagnostics({ query })).rejects.toThrow(
    'collaboration_not_initialized'
  );
});
