import { createClient } from '@/lib/supabase/client';
import { toast } from '@/features/shared/ui/ui/sonner';
export async function studioToken() {
  const { data } = await createClient().auth.getSession();
  if (!data.session) throw new Error('Please sign in');
  return data.session.access_token;
}
export async function studioRequest<T = any>(
  operation: string,
  input: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch('/api/studio', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await studioToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, ...input }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Studio request failed');
  return result as T;
}
// These calls resolve after the authenticated HTTP service confirms persistence.
// They are not optimistic Zero mutations and do not return MutationResultPair.
export function useStudioApi() {
  return {
    request: studioRequest,
    async upload(projectId: string, file: File) {
      const intent = await studioRequest<{ id: string; path: string; token: string }>(
        'beginUpload',
        { projectId, name: file.name.slice(0, 200), mime: file.type, size: file.size }
      );
      try {
        const { error } = await createClient()
          .storage.from('studio')
          .uploadToSignedUrl(intent.path, intent.token, file, { contentType: file.type });
        if (error) throw new Error('Media upload failed');
        return await studioRequest<{ id: string; mime: string }>('finishUpload', { id: intent.id });
      } catch (error) {
        await studioRequest('cancelUpload', { id: intent.id }).catch(() => {
          /* The worker removes abandoned uploads after expiry. */
        });
        throw error;
      }
    },
    notifyError(error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Studio request failed');
    },
  };
}
