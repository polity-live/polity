import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { StudioError } from './db';
import { rows, type SqlTransaction } from '@/server/transaction';
import { studioNodeAssetIds } from '@/features/communication-studio/logic/event-intro';
export async function validateStudioAssetsInTransaction(
  tx: SqlTransaction,
  projectId: string,
  value: unknown,
  workspaceId?: string
) {
  const doc = studioDocumentV3Schema.parse(value);
  const ids = [
    ...new Set(
      [
        ...(doc.show?.cues.map(cue => cue.assetId) ?? []),
        ...doc.nodes.flatMap(studioNodeAssetIds),
      ].filter((id): id is string => Boolean(id))
    ),
  ];
  if (!ids.length) return;
  const assets = await rows(
    tx,
    'select id,mime_type from studio_asset where project_id=$1 and ready=true and id=any($2::uuid[]) and (workspace_id is null or workspace_id=$3::uuid)',
    [projectId, ids, workspaceId ?? null]
  );
  if (assets.length !== ids.length) throw new StudioError('invalid_asset', 422);
  const videoIds = new Set(
    doc.nodes.flatMap(n => (n.type === 'frame' ? studioNodeAssetIds(n) : []))
  );
  if (assets.some(a => videoIds.has(String(a.id)) && a.mime_type !== 'video/mp4'))
    throw new StudioError('invalid_asset', 422);
}
