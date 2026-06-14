import type { Edge, EdgeProps } from '@xyflow/react';
import type { EditableRightsLabelEdgeData } from '@/features/network/types/networkEdge.types';
type RightsLabelEdgeType = Edge<EditableRightsLabelEdgeData, 'rightsLabel'>;
import { useRightsLabelEdgeController } from './useRightsLabelEdgeController';
import { RightsLabelEdgeView } from './RightsLabelEdgeView';

export function RightsLabelEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerStart,
  markerEnd,
  data,
}: EdgeProps<RightsLabelEdgeType>) {
  const viewProps = useRightsLabelEdgeController({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerStart,
    markerEnd,
    data,
  });

  return <RightsLabelEdgeView {...viewProps} />;
}
