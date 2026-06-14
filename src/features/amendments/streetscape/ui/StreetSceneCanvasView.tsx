import type { CorridorGeometry, StreetDesignLocalPoint, StreetDesignStateV1 } from '../types';
interface StreetSceneCanvasViewProps {
  design: StreetDesignStateV1;
  placementPreview: CorridorGeometry | null;
  selectedObjectId: string | null;
  readOnly: boolean;
  onPointerDown: (point: StreetDesignLocalPoint) => void;
  onPointerMove: (point: StreetDesignLocalPoint) => void;
  onObjectSelect: (objectId: string | null) => void;
}

import { useStreetSceneCanvasViewController } from './useStreetSceneCanvasViewController';
import { StreetSceneCanvasViewView } from './StreetSceneCanvasViewView';

export function StreetSceneCanvasView({
  design,
  placementPreview,
  selectedObjectId,
  readOnly,
  onPointerDown,
  onPointerMove,
  onObjectSelect,
}: StreetSceneCanvasViewProps) {
  const viewProps = useStreetSceneCanvasViewController({
    design,
    placementPreview,
    selectedObjectId,
    readOnly,
    onPointerDown,
    onPointerMove,
    onObjectSelect,
  });

  return <StreetSceneCanvasViewView {...viewProps} />;
}
