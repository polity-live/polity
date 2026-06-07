import type { GroupNetworkLayout } from '@/zero/preferences';

const EMPTY_LAYOUT: GroupNetworkLayout = {
  node_positions: {},
  edge_bend_points: {},
};

export function normalizeGroupNetworkLayout(
  layout: GroupNetworkLayout | null | undefined
): GroupNetworkLayout {
  if (!layout) {
    return EMPTY_LAYOUT;
  }

  return {
    node_positions: Object.fromEntries(
      Object.entries(layout.node_positions ?? {})
        .map(([nodeId, position]) => [nodeId, { x: position.x, y: position.y }] as const)
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    ),
    edge_bend_points: Object.fromEntries(
      Object.entries(layout.edge_bend_points ?? {})
        .filter(([, bendPoints]) => Array.isArray(bendPoints) && bendPoints.length > 0)
        .map(
          ([edgeId, bendPoints]) =>
            [edgeId, bendPoints.map(bendPoint => ({ x: bendPoint.x, y: bendPoint.y }))] as const
        )
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    ),
  };
}

export function areGroupNetworkLayoutsEqual(
  left: GroupNetworkLayout | null | undefined,
  right: GroupNetworkLayout | null | undefined
) {
  return (
    JSON.stringify(normalizeGroupNetworkLayout(left)) ===
    JSON.stringify(normalizeGroupNetworkLayout(right))
  );
}
