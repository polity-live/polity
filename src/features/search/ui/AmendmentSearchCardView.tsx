import type React from 'react';

import { AmendmentTimelineCard } from '@/features/timeline/ui/cards/AmendmentTimelineCard';

interface AmendmentSearchCardViewProps {
  amendment: React.ComponentProps<typeof AmendmentTimelineCard>['amendment'];
}

export function AmendmentSearchCardView({ amendment }: AmendmentSearchCardViewProps) {
  return (
    <AmendmentTimelineCard amendment={amendment} className="entity-search-card-no-spotlight" />
  );
}
