import { useSubscriptionPlansGridController } from '@/features/payments/hooks/useSubscriptionPlansGridController';

import { SubscriptionPlansGridView } from './SubscriptionPlansGridView';

export type PendingPlanChange = {
  target: 'free';
  effectiveAt: string;
} | null;

interface SubscriptionPlansGridProps {
  activeAmount: number;
  pendingChange: PendingPlanChange;
  isLoading: boolean;
  onSubscribe: (plan: 'running' | 'development') => void;
  onCustomAmount: (euros: number) => void;
  onCancel: () => void;
  isPlanActive: (amount: number) => boolean;
  hasCustomPlan: boolean;
}

export function SubscriptionPlansGrid({ onCustomAmount, ...props }: SubscriptionPlansGridProps) {
  const controller = useSubscriptionPlansGridController(onCustomAmount);

  return <SubscriptionPlansGridView {...props} {...controller} />;
}
