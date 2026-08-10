import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: mocks.getSession } }),
}));

import { parseAppError } from '@/features/shared/errors/app-error';
import { pushApiFetch } from '../push-api';

describe('pushApiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token-1' } } });
  });

  it('merges headers and returns a successful JSON response', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'sent' }),
    });
    await expect(
      pushApiFetch('/api/push/test', {
        method: 'POST',
        headers: { 'X-Request-ID': 'request-1' },
      })
    ).resolves.toEqual({ status: 'sent' });
    expect(mocks.fetch).toHaveBeenCalledWith('/api/push/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': 'request-1',
        Authorization: 'Bearer token-1',
      },
    });
  });

  it('requires a session and normalizes failed and non-JSON responses', async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(pushApiFetch('/api/push/test')).rejects.toSatisfy(
      error => parseAppError(error)?.code === 'permission_denied'
    );

    mocks.fetch.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ version: 1, code: 'validation_failed' }),
    });
    await expect(pushApiFetch('/api/push/test')).rejects.toSatisfy(
      error => parseAppError(error)?.code === 'validation_failed'
    );

    mocks.fetch.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockRejectedValue(new Error('invalid JSON')),
    });
    await expect(pushApiFetch('/api/push/test')).rejects.toSatisfy(
      error => parseAppError(error)?.code === 'push_operation_failed'
    );
  });
});
