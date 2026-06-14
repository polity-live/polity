'use client';
interface AmendmentProcessFlowProps {
  amendmentId: string;
}

import { useAmendmentProcessFlowController } from './useAmendmentProcessFlowController';
import { AmendmentProcessFlowView } from './AmendmentProcessFlowView';

export function AmendmentProcessFlow({ amendmentId }: AmendmentProcessFlowProps) {
  const viewProps = useAmendmentProcessFlowController({ amendmentId });

  return <AmendmentProcessFlowView {...viewProps} />;
}
