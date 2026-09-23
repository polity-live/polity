import type { CanvasChangeRequestTone } from '@/features/shared/ui/change-requests/CanvasChangeRequestMarker';
import type { CanvasProposal } from './governance';
import type { StudioDocumentV3, StudioNode } from './document-v3';

type ProposalChange = NonNullable<CanvasProposal['changes']>[number];

export interface StudioChangeRequestAnnotation {
  id: string;
  proposalId: string;
  nodeId: string;
  label: string;
  selected: boolean;
  tone: CanvasChangeRequestTone;
  sourceDocument: StudioDocumentV3;
}

function nodeSnapshot(value: unknown, id: string): StudioNode | null {
  if (!value || typeof value !== 'object') return null;
  const node = value as Partial<StudioNode>;
  return node.id === id && node.transform && typeof node.transform === 'object'
    ? (node as StudioNode)
    : null;
}

function snapshotDocument(
  base: StudioDocumentV3,
  changes: readonly ProposalChange[],
  side: 'before' | 'after'
): StudioDocumentV3 {
  const nodes = new Map(base.nodes.map(node => [node.id, node]));
  for (const change of changes) {
    if (change.path[0] !== 'nodes') continue;
    const id = change.path[1]?.startsWith('#') ? change.path[1].slice(1) : null;
    if (!id) continue;
    if (change.path.length === 2) {
      const snapshot = nodeSnapshot(change[side].value, id);
      if (snapshot) nodes.set(id, snapshot);
    } else if (change.path.length === 3 && change.path[2] === '@transform') {
      const node = nodes.get(id);
      const transform = change[side].value as StudioNode['transform'] | undefined;
      if (node && transform) nodes.set(id, { ...node, transform });
    }
  }
  return { ...base, nodes: [...nodes.values()] };
}

export function buildProposalAnnotations({
  proposal,
  changes,
  canonicalDocument,
  displayedDocument,
  selected,
}: {
  proposal: CanvasProposal;
  changes: readonly ProposalChange[];
  canonicalDocument: StudioDocumentV3;
  displayedDocument: StudioDocumentV3;
  selected: boolean;
}): StudioChangeRequestAnnotation[] {
  const beforeDocument = snapshotDocument(canonicalDocument, changes, 'before');
  const afterDocument = snapshotDocument(canonicalDocument, changes, 'after');
  const nodeIds = [
    ...new Set(
      changes
        .filter(change => change.path[0] === 'nodes' && change.path[1]?.startsWith('#'))
        .map(change => change.path[1].slice(1))
    ),
  ];
  return nodeIds.map(nodeId => {
    const structural = changes.find(
      change => change.path.length === 2 && change.path[1] === `#${nodeId}`
    );
    const tone: CanvasChangeRequestTone =
      structural?.before.exists === false
        ? 'add'
        : structural?.after.exists === false
          ? 'remove'
          : 'update';
    const sourceDocument =
      tone === 'add'
        ? selected && displayedDocument.nodes.some(node => node.id === nodeId)
          ? displayedDocument
          : afterDocument
        : tone === 'remove'
          ? beforeDocument
          : selected && displayedDocument.nodes.some(node => node.id === nodeId)
            ? displayedDocument
            : canonicalDocument;
    return {
      id: `${proposal.id}:${nodeId}`,
      proposalId: proposal.id,
      nodeId,
      label: proposal.title,
      selected,
      tone,
      sourceDocument,
    };
  });
}
