import type { StreetDesignPropertyValue } from '../types';

export const streetDesignBuildingUses = [
  'mixed',
  'residential',
  'commercial',
  'retail',
  'office',
  'hospitality',
  'industrial',
  'civic',
] as const;

export type StreetDesignBuildingUse = (typeof streetDesignBuildingUses)[number];

export const STREET_DESIGN_DEFAULT_BUILDING_USE: StreetDesignBuildingUse = 'mixed';

const streetDesignBuildingUseSet = new Set<string>(streetDesignBuildingUses);

const streetDesignBuildingUseColors = {
  mixed: '#b6aa9b',
  residential: '#c8bda7',
  commercial: '#b46b55',
  retail: '#b46b55',
  office: '#6f7a82',
  hospitality: '#c9a45c',
  industrial: '#6b7280',
  civic: '#8ba77f',
} satisfies Record<StreetDesignBuildingUse, string>;

export function getStreetDesignBuildingUse(value: unknown): StreetDesignBuildingUse {
  return typeof value === 'string' && streetDesignBuildingUseSet.has(value)
    ? (value as StreetDesignBuildingUse)
    : STREET_DESIGN_DEFAULT_BUILDING_USE;
}

export function getStreetDesignBuildingUseColor(value: unknown) {
  return streetDesignBuildingUseColors[getStreetDesignBuildingUse(value)];
}

export function getStreetDesignBuildingUseProperties(
  value: unknown
): Record<string, StreetDesignPropertyValue> {
  const use = getStreetDesignBuildingUse(value);
  const color = streetDesignBuildingUseColors[use];

  return {
    use,
    semanticUse: use,
    color,
    renderColor: color,
  };
}

export function updateStreetDesignBuildingProperties(
  properties: Record<string, StreetDesignPropertyValue>,
  key: string,
  value: StreetDesignPropertyValue
) {
  if (key === 'use' || key === 'semanticUse') {
    return {
      ...properties,
      ...getStreetDesignBuildingUseProperties(value),
    };
  }

  if (key === 'color' || key === 'renderColor') {
    const color =
      typeof value === 'string' ? value : getStreetDesignBuildingUseColor(properties.use);

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
