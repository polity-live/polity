import { GroupNetworkFlow } from './GroupNetworkFlow';

interface CurrentNetworkTabProps {
  groupId: string;
}

export function CurrentNetworkTab({ groupId }: CurrentNetworkTabProps) {
  return (
    <div className="h-full min-h-0">
      <GroupNetworkFlow groupId={groupId} />
    </div>
  );
}
