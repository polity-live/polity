import {
  useMembershipCompositionPanelController,
  type MembershipCompositionPanelLabels,
} from '../hooks/useMembershipCompositionPanelController';
import type { MembershipCompositionBucket } from '../types/group.types';

import { MembershipCompositionPanelView } from './MembershipCompositionPanelView';

interface MembershipCompositionPanelProps {
  buckets: MembershipCompositionBucket[];
  isLoading?: boolean;
  labelOverrides?: Partial<MembershipCompositionPanelLabels>;
}

export function MembershipCompositionPanel({
  buckets,
  isLoading = false,
  labelOverrides,
}: MembershipCompositionPanelProps) {
  const controller = useMembershipCompositionPanelController(buckets, { labelOverrides });

  return <MembershipCompositionPanelView isLoading={isLoading} {...controller} />;
}
