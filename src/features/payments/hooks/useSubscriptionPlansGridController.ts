import { useState } from 'react';

const PRICE_IDS = {
  running: import.meta.env.VITE_STRIPE_PRICE_RUNNING || '',
  development: import.meta.env.VITE_STRIPE_PRICE_DEVELOPMENT || '',
} as const;

export function useSubscriptionPlansGridController(onCustomAmount: (euros: number) => void) {
  const [customAmount, setCustomAmount] = useState('');

  const getCustomAmountValue = (): string => {
    return customAmount || '0';
  };

  const handleAmountChange = (value: string) => {
    if (value && !/^\d$/.test(value)) return;

    if (value === '') {
      setCustomAmount(current => current.slice(0, -1));
      return;
    }

    setCustomAmount(current => (current.length < 3 ? current + value : current));
  };

  const handleCustomSubmit = () => {
    const euros = Number(getCustomAmountValue());
    if (euros > 0) {
      onCustomAmount(euros);
    }
  };

  return {
    customAmount,
    customAmountValue: getCustomAmountValue(),
    priceIds: PRICE_IDS,
    onAmountChange: handleAmountChange,
    onCustomSubmit: handleCustomSubmit,
  };
}
