import { GroupNetworkFlow } from './GroupNetworkFlow';

interface CurrentNetworkTabProps {
  groupId: string;
}

export function CurrentNetworkTab({ groupId }: CurrentNetworkTabProps) {
  return (
    <div className="h-full min-h-0" data-tutorial-anchor="tutorial-network-flow">
      <GroupNetworkFlow groupId={groupId} />
    </div>
  );
}
