import type { StudioDocumentV3, StudioNode } from './document-v3';
import { applyStudioCommandV3 } from './commands-v3';
import type { ArrangementReference, Bounds } from './selection-geometry';

type Transact = (change: (document: StudioDocumentV3) => void) => void;
interface ArrangementSelection {
  nodeIds: string[];
  locked: boolean;
  referenceAvailable: boolean;
  reference: ArrangementReference;
  viewBounds?: Bounds;
  groupDepth: number;
  transact: Transact;
}

export function toggleStudioSelectionLock({
  selectedNodes,
  fullyLocked,
  transact,
}: {
  selectedNodes: StudioNode[];
  fullyLocked: boolean;
  transact: Transact;
}) {
  const locked = !fullyLocked;
  const nodeIds = selectedNodes.filter(node => node.locked !== locked).map(node => node.id);
  if (!nodeIds.length) return;
  transact(document =>
    Object.assign(
      document,
      applyStudioCommandV3(document, { type: 'setNodeState', nodeIds, locked })
    )
  );
}

export function alignStudioSelection({
  direction,
  ...selection
}: ArrangementSelection & {
  direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
}) {
  if (!selection.nodeIds.length || selection.locked || !selection.referenceAvailable) return;
  selection.transact(document =>
    Object.assign(
      document,
      applyStudioCommandV3(document, {
        type: 'alignNodes',
        nodeIds: selection.nodeIds,
        direction,
        reference: selection.reference,
        viewBounds: selection.reference === 'view' ? selection.viewBounds : undefined,
        groupDepth: selection.groupDepth,
      })
    )
  );
}

export function distributeStudioSelection({
  axis,
  unitCount,
  ...selection
}: ArrangementSelection & {
  axis: 'horizontal' | 'vertical';
  unitCount: number;
}) {
  if (
    unitCount < (selection.reference === 'selection' ? 3 : 2) ||
    selection.locked ||
    !selection.referenceAvailable
  )
    return;
  selection.transact(document =>
    Object.assign(
      document,
      applyStudioCommandV3(document, {
        type: 'distributeNodes',
        nodeIds: selection.nodeIds,
        axis,
        reference: selection.reference,
        viewBounds: selection.reference === 'view' ? selection.viewBounds : undefined,
        groupDepth: selection.groupDepth,
      })
    )
  );
}

export function cutStudioSelection(nodeIds: string[], transact: Transact) {
  if (!nodeIds.length) return;
  transact(document =>
    Object.assign(document, applyStudioCommandV3(document, { type: 'deleteNodes', nodeIds }))
  );
}
