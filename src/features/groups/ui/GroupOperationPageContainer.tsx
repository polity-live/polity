interface GroupOperationPageContainerProps {
  groupId: string;
  hash: string;
}

import { useGroupOperationPageContainerController } from './useGroupOperationPageContainerController';
import { GroupOperationPageContainerView } from './GroupOperationPageContainerView';

export function GroupOperationPageContainer({ groupId, hash }: GroupOperationPageContainerProps) {
  const viewProps = useGroupOperationPageContainerController({ groupId, hash });

  return <GroupOperationPageContainerView {...viewProps} />;
}
