import { useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { AmendmentPathVisualizationView } from './AmendmentPathVisualizationView';
import type { AmendmentPathVisualizationSegment } from './AmendmentPathVisualizationView';

export type { AmendmentPathVisualizationSegment } from './AmendmentPathVisualizationView';

interface AmendmentPathVisualizationProps {
  enrichedPathData: AmendmentPathVisualizationSegment[];
  groupTypeById?: Map<string, string | null>;
  onGroupClick?: (groupId: string) => void;
  onNodeClick?: (eventId: string) => void;
}

function AmendmentPathVisualizationEmptyView({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

export function AmendmentPathVisualization(props: AmendmentPathVisualizationProps) {
  const { t } = useTranslation();
  const [legendOpen, setLegendOpen] = useState(false);

  if (!props.enrichedPathData || props.enrichedPathData.length === 0) {
    return (
      <AmendmentPathVisualizationEmptyView
        message={t('features.amendments.process.noPathAvailable')}
      />
    );
  }

  return (
    <AmendmentPathVisualizationView
      {...props}
      legendOpen={legendOpen}
      onLegendOpenChange={setLegendOpen}
    />
  );
}
