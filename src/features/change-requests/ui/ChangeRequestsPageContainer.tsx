interface ChangeRequestsPageContainerProps {
  amendmentId: string;
  userId?: string;
}
import { useChangeRequestsPageContainerController } from './useChangeRequestsPageContainerController';
import { ChangeRequestsPageContainerView } from './ChangeRequestsPageContainerView';
export function ChangeRequestsPageContainer({
  amendmentId,
  userId,
}: ChangeRequestsPageContainerProps) {
  const viewProps = useChangeRequestsPageContainerController({ amendmentId, userId });

  return <ChangeRequestsPageContainerView {...viewProps} />;
}
