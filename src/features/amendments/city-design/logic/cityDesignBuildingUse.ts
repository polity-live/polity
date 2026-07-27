import type { CityDesignPropertyValue } from '../types';

export const cityDesignBuildingUses = [
  'mixed',
  'residential',
  'commercial',
  'retail',
  'office',
  'hospitality',
  'industrial',
  'civic',
] as const;

export type CityDesignBuildingUse = (typeof cityDesignBuildingUses)[number];

export const CITY_DESIGN_DEFAULT_BUILDING_USE: CityDesignBuildingUse = 'mixed';

const cityDesignBuildingUseSet = new Set<string>(cityDesignBuildingUses);

const cityDesignBuildingUseColors = {
  mixed: '#b6aa9b',
  residential: '#c8bda7',
  commercial: '#b46b55',
  retail: '#b46b55',
  office: '#6f7a82',
  hospitality: '#c9a45c',
  industrial: '#6b7280',
  civic: '#8ba77f',
} satisfies Record<CityDesignBuildingUse, string>;

export function getCityDesignBuildingUse(value: unknown): CityDesignBuildingUse {
  return typeof value === 'string' && cityDesignBuildingUseSet.has(value)
    ? (value as CityDesignBuildingUse)
    : CITY_DESIGN_DEFAULT_BUILDING_USE;
}

export function getCityDesignBuildingUseColor(value: unknown) {
  return cityDesignBuildingUseColors[getCityDesignBuildingUse(value)];
}

export function getCityDesignBuildingUseProperties(
  value: unknown
): Record<string, CityDesignPropertyValue> {
  const use = getCityDesignBuildingUse(value);
  const color = cityDesignBuildingUseColors[use];

  return {
    use,
    semanticUse: use,
    color,
    renderColor: color,
  };
}

export function updateCityDesignBuildingProperties(
  properties: Record<string, CityDesignPropertyValue>,
  key: string,
  value: CityDesignPropertyValue
) {
  if (key === 'use' || key === 'semanticUse') {
    return {
      ...properties,
      ...getCityDesignBuildingUseProperties(value),
    };
  }

  if (key === 'color' || key === 'renderColor') {
    const color = typeof value === 'string' ? value : getCityDesignBuildingUseColor(properties.use);

    return {
      ...properties,
      color,
      renderColor: color,
    };
  }

  return {
    ...properties,
    [key]: value,
  };
}
