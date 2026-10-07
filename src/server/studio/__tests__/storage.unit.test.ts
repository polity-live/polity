import { expect, it, vi } from 'vitest';
import { copyStudioAsset, removeFailedStudioCopies } from '../storage';
import { withStudioTransaction } from '../context';
it('validates orphaned copies on retry without deleting files before the Zero commit', async () => {
  const failed = { error: new Error('exists'), data: null };
  const storage = { copy: vi.fn().mockResolvedValue(failed), download: vi.fn(), remove: vi.fn() };
  expect(await copyStudioAsset(storage as never, 'a', 'b')).toBe(failed);
  await removeFailedStudioCopies(storage as never, []);
  await removeFailedStudioCopies(storage as never, ['orphan']);
  expect(storage.remove).toHaveBeenCalledOnce();
  await withStudioTransaction({} as never, 'operation', async () => {
    storage.copy.mockResolvedValueOnce({ error: null, data: { path: 'b' } });
    expect((await copyStudioAsset(storage as never, 'a', 'b')).error).toBeNull();
    for (const pair of [
      [{ error: new Error('missing') }, { data: new Blob(['a']) }],
      [{ data: new Blob(['a']) }, { error: new Error('missing') }],
      [{ data: null }, { data: new Blob(['a']) }],
      [{ data: new Blob(['a']) }, { data: null }],
      [{ data: new Blob(['a']) }, { data: new Blob(['ab']) }],
      [{ data: new Blob(['a']) }, { data: new Blob(['b']) }],
    ]) {
      storage.download.mockResolvedValueOnce(pair[0]).mockResolvedValueOnce(pair[1]);
      expect(await copyStudioAsset(storage as never, 'a', 'b')).toBe(failed);
    }
    storage.download.mockResolvedValue({ data: new Blob(['same']) });
    expect((await copyStudioAsset(storage as never, 'a', 'b')).error).toBeNull();
    await removeFailedStudioCopies(storage as never, ['b']);
    expect(storage.remove).toHaveBeenCalledOnce();
  });
});
