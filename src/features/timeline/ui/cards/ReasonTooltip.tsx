'use client';

import { useReasonTooltipController } from '@/features/timeline/hooks/useReasonTooltipController';
import { ReasonBadge, type ReasonCategory } from '@/features/shared/ui/status';
import { ReasonTooltipView } from './ReasonTooltipView';

export { ReasonBadge, type ReasonCategory };

export interface ReasonTooltipProps {
  category: ReasonCategory;
  context?: string;
  className?: string;
}

export function ReasonTooltip({ category, context, className }: ReasonTooltipProps) {
  return (
    <ReasonTooltipView
      className={className}
      {...useReasonTooltipController({ category, context })}
    />
  );
}
