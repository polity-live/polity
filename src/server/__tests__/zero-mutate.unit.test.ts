import { describe, expect, it, vi } from 'vitest';

import { encodeAppError } from '@/features/shared/errors/app-error';
import { GROUP_CONFLICT_ERROR_PREFIX } from '@/features/groups/logic/groupConflict';
import { sanitizeZeroMutationResult } from '../zero-mutate';

describe('sanitizeZeroMutationResult', () => {
  it('gives obsolete clients and paused procedural actions a safe actionable response', () => {
    for (const message of [
      'collaboration_legacy_write_rejected',
      'collaboration_version_requires_committed_revision',
      'collaboration_comments_require_server_command',
      'collaboration_maintenance',
    ]) {
      expect(sanitizeZeroMutationResult({ type: 'error', error: { message } })).toEqual({
        type: 'error',
        error: {
          message: encodeAppError(
            message === 'collaboration_maintenance'
              ? 'collaboration_maintenance'
              : 'collaboration_client_outdated'
          ),
        },
      });
    }
  });
  it('replaces legacy clear-text mutation errors with a stable app error', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(
      sanitizeZeroMutationResult({
        mutations: [
          {
            type: 'error',
            error: { type: 'application', message: 'Legacy sensitive detail' },
          },
        ],
      })
    ).toEqual({
      mutations: [
        {
          type: 'error',
          error: {
            type: 'application',
            message: encodeAppError('mutation_server_failed'),
          },
        },
      ],
    });
    expect(log).toHaveBeenCalledWith('Unstructured Zero mutation error', 'Legacy sensitive detail');
    log.mockRestore();
  });

  it('preserves app-error and group-conflict payloads', () => {
    const appError = encodeAppError('permission_denied');
    const conflict = `${GROUP_CONFLICT_ERROR_PREFIX}{"blocking":true,"conflicts":[]}`;

    expect(
      sanitizeZeroMutationResult([
        { type: 'error', error: { message: appError } },
        { type: 'error', error: { message: conflict } },
      ])
    ).toEqual([
      { type: 'error', error: { message: appError } },
      { type: 'error', error: { message: conflict } },
    ]);
  });
});
