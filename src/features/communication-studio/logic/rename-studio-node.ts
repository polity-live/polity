import { applyStudioCommandV3 } from './commands-v3';
import type { StudioDocumentV3 } from './document-v3';

/** Recheck the node inside the transaction because a collaborator can change it after input. */
export function renameStudioNode({
  nodeId,
  name,
  editable,
  transact,
}: {
  nodeId: string;
  name: string;
  editable: boolean;
  transact: (change: (document: StudioDocumentV3) => void) => void;
}) {
  if (!editable) return;
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > 200) return;
  transact(document => {
    const node = document.nodes.find(candidate => candidate.id === nodeId);
    if (!node || node.locked || node.name === normalizedName) return;
    Object.assign(
      document,
      applyStudioCommandV3(document, {
        type: 'updateNode',
        nodeId,
        patch: { name: normalizedName },
      })
    );
  });
}
