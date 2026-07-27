import type { CityDesignObjectType } from '../types';
import {
  CITY_DESIGN_COST_CATALOG_VERSION,
  CITY_DESIGN_CURRENCY,
  cityDesignObjectRegistry,
} from './cityDesignObjectRegistry';
import {
  formatCurrencyMinor,
  majorToMinor,
  minorToMajor,
  type CurrencyCode,
} from '@/features/shared/logic/currency';
import { useLanguageStore } from '@/features/shared/global-state/language.store';

export interface CityDesignCostCatalogEntry {
  type: CityDesignObjectType;
  rule: (typeof cityDesignObjectRegistry)[CityDesignObjectType]['costRule'];
  unitCostMinor: number;
  currency: string;
  version: string;
}

export const cityDesignCostCatalog = Object.fromEntries(
  Object.entries(cityDesignObjectRegistry).map(([type, definition]) => [
    type,
    {
      type,
      rule: definition.costRule,
      unitCostMinor: definition.suggestedUnitCostMinor,
      currency: CITY_DESIGN_CURRENCY,
      version: CITY_DESIGN_COST_CATALOG_VERSION,
    },
  ])
) as Record<CityDesignObjectType, CityDesignCostCatalogEntry>;

export function getCityDesignCostCatalogEntry(
  type: CityDesignObjectType,
  currency: CurrencyCode = CITY_DESIGN_CURRENCY
) {
  const entry = cityDesignCostCatalog[type];
  if (currency === entry.currency) return entry;
  return {
    ...entry,
    currency,
    unitCostMinor: majorToMinor(minorToMajor(entry.unitCostMinor, entry.currency), currency),
  };
}

export function formatMinorCurrency(amountMinor: number, currency = CITY_DESIGN_CURRENCY) {
  return formatCurrencyMinor(amountMinor, currency, useLanguageStore.getState().language);
}
