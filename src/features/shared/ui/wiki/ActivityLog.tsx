import {
  useEntityActivity,
  type ActivityEntityType,
} from '@/features/shared/hooks/useEntityActivity';
import { ActivityLogView } from './ActivityLogView';

export { ActivityLogView } from './ActivityLogView';

export function ActivityLog({ type, entityId }: { type: ActivityEntityType; entityId: string }) {
  const activity = useEntityActivity(type, entityId);
  return <ActivityLogView activity={activity} />;
}
