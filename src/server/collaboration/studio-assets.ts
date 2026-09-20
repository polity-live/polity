import { documentSchema } from '@/features/communication-studio/logic/document';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { rows, type SqlTransaction } from './transaction';
export async function validateStudioAssetsInTransaction(
  tx: SqlTransaction,
  projectId: string,
  value: unknown
) {
  const doc = documentSchema.parse(value);
  const ids = [
    ...new Set(
      [...doc.pages.flatMap(p => p.elements.map(e => e.assetId)), doc.brand.logoAssetId].filter(
        Boolean
      )
    ),
  ];
  if (!ids.length) return;
  const assets = await rows(
    tx,
    'select id from studio_asset where project_id=$1 and ready=true and id=any($2::uuid[])',
    [projectId, ids]
  );
  if (assets.length !== ids.length) throw new CollaborationError('invalid_asset', 422);
}
