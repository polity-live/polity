import { create } from 'zustand';
import type { CurrencyCode } from '@/features/shared/logic/currency';

interface CurrencyState {
  displayCurrency: CurrencyCode;
  setDisplayCurrency: (currency: CurrencyCode) => void;
}

/** In-memory display preference; signed-out and SSR views intentionally default to EUR. */
export const useDisplayCurrencyStore = create<CurrencyState>(set => ({
  displayCurrency: 'EUR',
  setDisplayCurrency: displayCurrency => set({ displayCurrency }),
}));
