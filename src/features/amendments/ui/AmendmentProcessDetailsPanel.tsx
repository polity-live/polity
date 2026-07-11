'use client';

import type { AmendmentPathVisualizationSegment } from '@/features/network/ui/AmendmentPathVisualization';
import type { AmendmentForwardingPreviewModel } from '@/features/amendments/logic/amendmentForwardingPreview';

import { useAmendmentProcessDetailsPanelController } from '@/features/amendments/hooks/useAmendmentProcessDetailsPanelController';

import { AmendmentProcessDetailsPanelView } from './AmendmentProcessDetailsPanelView';

interface AmendmentProcessDetailsPanelProps {
  amendment: {
    id: string;
    title?: string | null;
    reason?: string | null;
    preamble?: string | null;
    current_process_run?: {
      branches?:
        | readonly {
            id: string;
            created_at?: number | string | null;
            editing_mode?: string | null;
          }[]
        | null;
    } | null;
    group?: { id: string; name?: string | null } | null;
  };
  forwardingPreview?: AmendmentForwardingPreviewModel | null;
  pathVisualizationData?: AmendmentPathVisualizationSegment[];
  groupTypeById?: Map<string, string | null>;
  onGroupClick?: (groupId: string) => void;
  onEventClick?: (eventId: string) => void;
  defaultOpen?: boolean;
}

export function AmendmentProcessDetailsPanel({
  defaultOpen = true,
  ...viewProps
}: AmendmentProcessDetailsPanelProps) {
  const controller = useAmendmentProcessDetailsPanelController(defaultOpen);

  return <AmendmentProcessDetailsPanelView {...viewProps} {...controller} />;
}
