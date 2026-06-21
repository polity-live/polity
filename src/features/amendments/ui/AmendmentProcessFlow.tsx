'use client';
interface AmendmentProcessFlowProps {
  amendmentId: string;
  requestedBranchId?: string | null;
  onBranchChange?: (branchId: string | null, options?: { replace?: boolean }) => void;
}

import { useAmendmentProcessFlowController } from './useAmendmentProcessFlowController';
import { AmendmentProcessFlowView } from './AmendmentProcessFlowView';

export function AmendmentProcessFlow({
  amendmentId,
  requestedBranchId,
  onBranchChange,
}: AmendmentProcessFlowProps) {
  const viewProps = useAmendmentProcessFlowController({
    amendmentId,
    requestedBranchId,
    onBranchChange,
  });

  return <AmendmentProcessFlowView {...viewProps} />;
}
