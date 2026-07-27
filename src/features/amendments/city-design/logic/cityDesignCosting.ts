import type {
  CityDesignCostLine,
  CityDesignCostSummary,
  CityDesignCostRule,
  CityDesignObject,
} from '../types';
import { getCityDesignObjectDefinition } from './cityDesignObjectRegistry';
import { getCityDesignObjectVariantLabelKey } from './cityDesignVariantCatalog';

function numberProperty(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getCityDesignObjectQuantity(object: CityDesignObject, rule: CityDesignCostRule) {
  if (rule === 'per_item') {
    if (
      object.geometry.kind === 'path_corridor' &&
      (object.type === 'tree' || object.type === 'bush')
    ) {
      const definition = getCityDesignObjectDefinition(object.type);
      const defaultSpacing = numberProperty(definition.defaultProperties.spacing, 2);
      const spacing = Math.max(numberProperty(object.properties.spacing, defaultSpacing), 0.1);
      return Math.max(1, Math.floor(object.geometry.length / spacing) + 1);
    }

    return 1;
  }

  if (rule === 'per_meter') {
    return object.geometry.kind === 'corridor' || object.geometry.kind === 'path_corridor'
      ? object.geometry.length
      : 0;
  }

  if (rule === 'per_square_meter') {
    if (object.geometry.kind === 'corridor') return object.geometry.area;
    if (object.geometry.kind === 'path_corridor') return object.geometry.area;
    if (object.geometry.kind === 'polygon') return object.geometry.area;
    return 0;
  }

  if (rule === 'per_parking_space') {
    const explicitSpaces = numberProperty(object.properties.parkingSpaces, 0);
    if (explicitSpaces > 0) return explicitSpaces;

    const area =
      object.geometry.kind === 'corridor' ||
      object.geometry.kind === 'path_corridor' ||
      object.geometry.kind === 'polygon'
        ? object.geometry.area
        : 0;
    return Math.max(1, Math.round(area / 12.5));
  }

  return 0;
}

export function getCityDesignCostLine(object: CityDesignObject): CityDesignCostLine {
  const definition = getCityDesignObjectDefinition(object.type);
  const rule = object.cost.rule;
  const quantity = getCityDesignObjectQuantity(object, rule);
  const unitCostMinor = object.cost.customUnitCostMinor ?? object.cost.suggestedUnitCostMinor;
  const totalCostMinor = Math.round(quantity * unitCostMinor);

  return {
    objectId: object.id,
    type: object.type,
    labelKey: definition.labelKey,
    displayLabelKey: getCityDesignObjectVariantLabelKey(object) ?? undefined,
    category: definition.category,
    rule,
    quantity,
    unitCostMinor,
    totalCostMinor,
    currency: object.cost.currency,
  };
}

export function getCityDesignCostSummary(
  objects: CityDesignObject[],
  currency = 'EUR'
): CityDesignCostSummary {
  const lines = objects.map(getCityDesignCostLine);
  const categories = Array.from(
    lines
      .reduce((map, line) => {
        const current = map.get(line.category) ?? {
          category: line.category,
          totalCostMinor: 0,
          quantity: 0,
        };
        current.totalCostMinor += line.totalCostMinor;
        current.quantity += line.quantity;
        map.set(line.category, current);
        return map;
      }, new Map<CityDesignCostLine['category'], CityDesignCostSummary['categories'][number]>())
      .values()
  );

  return {
    currency,
    totalCostMinor: lines.reduce((sum, line) => sum + line.totalCostMinor, 0),
    lines,
    categories,
  };
}

export function updateObjectUnitCost(
  object: CityDesignObject,
  customUnitCostMinor: number | null
): CityDesignObject {
  return {
    ...object,
    cost: {
      ...object.cost,
      customUnitCostMinor:
        customUnitCostMinor == null ? undefined : Math.max(0, Math.round(customUnitCostMinor)),
    },
  };
}
