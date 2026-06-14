import { useGroupSearchCardController } from '../hooks/useGroupSearchCardController';
import { type SearchGroup } from '../types/search.types';
import { GroupSearchCardView } from './GroupSearchCardView';

interface BasicGroupData {
  id: string;
  name?: string | null;
  description?: unknown;
  member_count?: number | null;
  event_count?: number | null;
  amendment_count?: number | null;
}

interface GroupSearchCardProps {
  group: SearchGroup | BasicGroupData;
}

export function GroupSearchCard({ group }: GroupSearchCardProps) {
  return <GroupSearchCardView {...useGroupSearchCardController({ group })} />;
}
