import { afterEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
const storage = vi.hoisted(() => ({ uploadToSignedUrl: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth, storage: { from: () => storage } }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: vi.fn() } }));
import { studioRequest, useStudioApi } from '../useStudioApi';
import { toast } from '@/features/shared/ui/ui/sonner';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe('studio authenticated HTTP writes', () => {
  it('uses a safe fallback for unsuccessful responses and non-Error notifications', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 500 })));
    await expect(studioRequest('themes')).rejects.toThrow('Studio request failed');
    useStudioApi().notifyError(new Error('Upload denied'));
    expect(toast.error).toHaveBeenLastCalledWith('Upload denied');
    useStudioApi().notifyError(null);
    expect(toast.error).toHaveBeenLastCalledWith('Studio request failed');
  });
  it('only confirms an export after the server acknowledges its request', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } });
    let complete: (response: Response) => void = () => {
      /* Assigned by the pending response. */
    };
    const fetch = vi.fn(
      () =>
        new Promise<Response>(resolve => {
          complete = resolve;
        })
    );
    vi.stubGlobal('fetch', fetch);
    let settled = false;
    const pending = studioRequest<{ id: string }>('export', { projectId: 'project' }).then(
      result => {
        settled = true;
        return result;
      }
    );
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(settled).toBe(false);
    expect(fetch.mock.calls[0]).toMatchObject([
      '/api/studio',
      { headers: { Authorization: 'Bearer test-token' } },
    ]);
    complete(Response.json({ id: 'job' }));
    expect(await pending).toEqual({ id: 'job' });
  });
  it('surfaces rejected writes instead of reporting success', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'No access' }, { status: 403 }))
    );
    await expect(studioRequest('template', { id: 'project' })).rejects.toThrow('No access');
  });
  it('requires a session before sending a private upload', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      useStudioApi().upload('project', new File(['image'], 'image.png'))
    ).rejects.toThrow('Please sign in');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uploads the file directly and only returns it after verification', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ id: 'asset', path: 'project/asset', token: 'signed-upload' })
      )
      .mockResolvedValueOnce(Response.json({ id: 'asset', mime: 'image/png' }));
    vi.stubGlobal('fetch', fetch);
    storage.uploadToSignedUrl.mockResolvedValue({ error: null });
    const file = new File(['image'], 'image.png', { type: 'image/png' });
    expect(await useStudioApi().upload('project', file)).toEqual({
      id: 'asset',
      mime: 'image/png',
    });
    expect(storage.uploadToSignedUrl).toHaveBeenCalledWith('project/asset', 'signed-upload', file, {
      contentType: 'image/png',
    });
    expect(fetch.mock.calls.map(call => JSON.parse(call[1].body).operation)).toEqual([
      'beginUpload',
      'finishUpload',
    ]);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      name: 'image.png',
      mime: 'image/png',
      size: 5,
    });
  });
  it('cancels the reservation if the storage upload fails', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ id: 'asset', path: 'project/asset', token: 'signed-upload' })
      )
      .mockResolvedValueOnce(Response.json({ id: 'asset' }));
    vi.stubGlobal('fetch', fetch);
    storage.uploadToSignedUrl.mockResolvedValue({ error: new Error('storage offline') });
    await expect(
      useStudioApi().upload('project', new File(['image'], 'image.png', { type: 'image/png' }))
    ).rejects.toThrow('Media upload failed');
    expect(fetch.mock.calls.map(call => JSON.parse(call[1].body).operation)).toEqual([
      'beginUpload',
      'cancelUpload',
    ]);
  });
  it('preserves a verification error when cancellation also fails', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ id: 'asset', path: 'project/asset', token: 'signed-upload' })
      )
      .mockResolvedValueOnce(Response.json({ error: 'MIME mismatch' }, { status: 400 }))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    storage.uploadToSignedUrl.mockResolvedValue({ error: null });
    await expect(
      useStudioApi().upload('project', new File(['image'], 'image.png', { type: 'image/png' }))
    ).rejects.toThrow('MIME mismatch');
    expect(fetch.mock.calls.map(call => JSON.parse(call[1].body).operation)).toEqual([
      'beginUpload',
      'finishUpload',
      'cancelUpload',
    ]);
  });
});
