import { createHash } from 'node:crypto';
import type { createClient } from '@/lib/supabase/server';
import { currentStudioTransaction } from './context';

type Storage = ReturnType<ReturnType<typeof createClient>['storage']['from']>;
/** A retry can find a copy made by a database transaction that rolled back. */
export async function copyStudioAsset(storage: Storage, source: string, destination: string) {
  const copied = await storage.copy(source, destination);
  if (!copied.error || !currentStudioTransaction()) return copied;
  const [original, existing] = await Promise.all([
    storage.download(source),
    storage.download(destination),
  ]);
  if (original.error || existing.error || !original.data || !existing.data) return copied;
  const digest = async (blob: Blob) =>
    createHash('sha256')
      .update(Buffer.from(await blob.arrayBuffer()))
      .digest('hex');
  if (
    original.data.size !== existing.data.size ||
    (await digest(original.data)) !== (await digest(existing.data))
  )
    return copied;
  return { ...copied, error: null };
}
export async function removeFailedStudioCopies(storage: Storage, paths: string[]) {
  // Zero owns the commit. Leave copies for retry and the orphan sweep, rather
  // than deleting a file whose mutation may already have committed elsewhere.
  if (!currentStudioTransaction() && paths.length) await storage.remove(paths);
}
