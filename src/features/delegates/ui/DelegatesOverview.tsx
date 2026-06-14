interface DelegatesOverviewProps {
  eventId: string;
  groupId?: string;
}

import { useDelegatesOverviewController } from './useDelegatesOverviewController';
import { DelegatesOverviewView } from './DelegatesOverviewView';

export function DelegatesOverview({ eventId, groupId }: DelegatesOverviewProps) {
  const viewProps = useDelegatesOverviewController({ eventId, groupId });

  return <DelegatesOverviewView {...viewProps} />;
}
