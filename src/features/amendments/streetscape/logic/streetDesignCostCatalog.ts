import type { StreetDesignObjectType } from '../types';
import {
  STREET_DESIGN_COST_CATALOG_VERSION,
  STREET_DESIGN_CURRENCY,
  streetDesignObjectRegistry,
} from './streetDesignObjectRegistry';
import {
  formatCurrencyMinor,
  majorToMinor,
  minorToMajor,
  type CurrencyCode,
} from '@/features/shared/logic/currency';
import { useLanguageStore } from '@/features/shared/global-state/language.store';

export interface StreetDesignCostCatalogEntry {
  type: StreetDesignObjectType;
  rule: (typeof streetDesignObjectRegistry)[StreetDesignObjectType]['costRule'];
  unitCostMinor: number;
  currency: string;
  version: string;
}

export const streetDesignCostCatalog = Object.fromEntries(
  Object.entries(streetDesignObjectRegistry).map(([type, definition]) => [
    type,
    {
      type,
      rule: definition.costRule,
      unitCostMinor: definition.suggestedUnitCostMinor,
      currency: STREET_DESIGN_CURRENCY,
      version: STREET_DESIGN_COST_CATALOG_VERSION,
    },
  ])
) as Record<StreetDesignObjectType, StreetDesignCostCatalogEntry>;

export function getStreetDesignCostCatalogEntry(
  type: StreetDesignObjectType,
  currency: CurrencyCode = STREET_DESIGN_CURRENCY
) {
  const entry = streetDesignCostCatalog[type];
  if (currency === entry.currency) return entry;
  return {
    ...entry,
    currency,
    unitCostMinor: majorToMinor(minorToMajor(entry.unitCostMinor, entry.currency), currency),
  };
}

export function formatMinorCurrency(amountMinor: number, currency = STREET_DESIGN_CURRENCY) {
  return formatCurrencyMinor(amountMinor, currency, useLanguageStore.getState().language);
}
