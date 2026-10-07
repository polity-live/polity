import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { StudioError } from './db';
import { rows, type SqlTransaction } from '@/server/transaction';
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
        ...doc.nodes.flatMap(node =>
          node.type === 'media'
            ? [node.assetId]
            : node.type === 'chart' && node.sourceAssetId
              ? [node.sourceAssetId]
              : []
        ),
      ].filter(Boolean)
    ),
  ];
  if (!ids.length) return;
  const assets = await rows(
    tx,
    'select id from studio_asset where project_id=$1 and ready=true and id=any($2::uuid[]) and (workspace_id is null or workspace_id=$3::uuid)',
    [projectId, ids, workspaceId ?? null]
  );
  if (assets.length !== ids.length) throw new StudioError('invalid_asset', 422);
}
