import { useSubscriptionPlansGridController } from '@/features/payments/hooks/useSubscriptionPlansGridController';

import { SubscriptionPlansGridView } from './SubscriptionPlansGridView';

interface SubscriptionPlansGridProps {
  activeAmount: number;
  isLoading: boolean;
  onSubscribe: (priceId: string) => void;
  onCustomAmount: (euros: number) => void;
  onCancel: () => void;
  isPlanActive: (amount: number) => boolean;
  hasCustomPlan: boolean;
}

export function SubscriptionPlansGrid({ onCustomAmount, ...props }: SubscriptionPlansGridProps) {
  const controller = useSubscriptionPlansGridController(onCustomAmount);

  return <SubscriptionPlansGridView {...props} {...controller} />;
}
