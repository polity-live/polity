import { useMembershipCompositionPanelController } from '../hooks/useMembershipCompositionPanelController';
import type { MembershipCompositionBucket } from '../types/group.types';

import { MembershipCompositionPanelView } from './MembershipCompositionPanelView';

interface MembershipCompositionPanelProps {
  buckets: MembershipCompositionBucket[];
  isLoading?: boolean;
}

export function MembershipCompositionPanel({
  buckets,
  isLoading = false,
}: MembershipCompositionPanelProps) {
  const controller = useMembershipCompositionPanelController(buckets);

  return <MembershipCompositionPanelView isLoading={isLoading} {...controller} />;
}
