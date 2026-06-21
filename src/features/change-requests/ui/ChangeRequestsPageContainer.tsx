interface ChangeRequestsPageContainerProps {
  amendmentId: string;
  userId?: string;
  requestedBranchId?: string;
  onBranchChange?: (branchId: string | null, options?: { replace?: boolean }) => void;
}
import { useChangeRequestsPageContainerController } from './useChangeRequestsPageContainerController';
import { ChangeRequestsPageContainerView } from './ChangeRequestsPageContainerView';
export function ChangeRequestsPageContainer({
  amendmentId,
  userId,
  requestedBranchId,
  onBranchChange,
}: ChangeRequestsPageContainerProps) {
  const viewProps = useChangeRequestsPageContainerController({
    amendmentId,
    userId,
    requestedBranchId,
    onBranchChange,
  });

  return <ChangeRequestsPageContainerView {...viewProps} />;
}
