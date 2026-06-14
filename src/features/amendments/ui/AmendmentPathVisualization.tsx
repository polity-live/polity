'use client';
interface AmendmentPathVisualizationProps {
  amendmentId: string;
}

import { useAmendmentPathVisualizationController } from './useAmendmentPathVisualizationController';
import { AmendmentPathVisualizationView } from './AmendmentPathVisualizationView';

export function AmendmentPathVisualization({ amendmentId }: AmendmentPathVisualizationProps) {
  const viewProps = useAmendmentPathVisualizationController({ amendmentId });

  return <AmendmentPathVisualizationView {...viewProps} />;
}
