import type { StreetDesignObjectType } from '../types';
import {
  STREET_DESIGN_COST_CATALOG_VERSION,
  STREET_DESIGN_CURRENCY,
  streetDesignObjectRegistry,
} from './streetDesignObjectRegistry';

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

export function getStreetDesignCostCatalogEntry(type: StreetDesignObjectType) {
  return streetDesignCostCatalog[type];
}

export function formatMinorCurrency(amountMinor: number, currency = STREET_DESIGN_CURRENCY) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}
