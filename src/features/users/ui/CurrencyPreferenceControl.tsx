import { CurrencySelect } from '@/features/shared/ui/form/CurrencySelect';
import { usePreferenceActions } from '@/zero/preferences/usePreferenceActions';
import { usePreferenceState } from '@/zero/preferences/usePreferenceState';
import { useDisplayCurrencyStore } from '@/features/shared/global-state/currency.store';

export function CurrencyPreferenceControl() {
  const { displayCurrency, isLoading } = usePreferenceState();
  const { updateDisplayCurrency } = usePreferenceActions();
  const setDisplayCurrency = useDisplayCurrencyStore(state => state.setDisplayCurrency);
  return (
    <CurrencySelect
      value={displayCurrency}
      onChange={currency => {
        setDisplayCurrency(currency);
        updateDisplayCurrency(currency);
      }}
      disabled={isLoading}
    />
  );
}
