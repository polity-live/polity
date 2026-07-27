import { describe, expect, it, vi } from 'vitest';

import { encodeAppError } from '@/features/shared/errors/app-error';
import { GROUP_CONFLICT_ERROR_PREFIX } from '@/features/groups/logic/groupConflict';
import { sanitizeZeroMutationResult } from '../zero-mutate';

describe('sanitizeZeroMutationResult', () => {
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
