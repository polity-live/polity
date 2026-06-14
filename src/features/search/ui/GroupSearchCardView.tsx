import type React from 'react';

import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';

interface GroupSearchCardViewProps {
  group: React.ComponentProps<typeof GroupTimelineCard>['group'];
}

export function GroupSearchCardView({ group }: GroupSearchCardViewProps) {
  return <GroupTimelineCard group={group} />;
}
