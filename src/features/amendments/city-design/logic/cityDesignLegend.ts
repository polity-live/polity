import type {
  CityDesignObjectCategory,
  CityDesignObjectType,
  CityDesignOsmFeature,
  CityDesignOsmFeatureLayer,
  CityDesignPropertyValue,
  CityDesignRenderKind,
  CityDesignStateV1,
} from '../types';
import {
  getCityDesignObjectDefinition,
  cityDesignObjectRegistry,
} from './cityDesignObjectRegistry';
import { cityDesignElementSections } from './cityDesignElementSections';
import {
  getCityDesignHiddenOsmFeatureIds,
  getCityDesignOsmFeatureLayer,
  getCityDesignOsmFeatures,
  getCityDesignOsmLayerVisibility,
} from './cityDesignOsm';

export type CityDesignLegendSource = 'existing' | 'planned';
export type CityDesignLegendEntryKind =
  'existing-layer' | 'placement-preset' | 'placement-fallback';

export interface CityDesignLegendEntry {
  id: string;
  source: CityDesignLegendSource;
  kind: CityDesignLegendEntryKind;
  labelKey: string;
  color: string;
  renderKind: CityDesignRenderKind;
  layer?: CityDesignOsmFeatureLayer;
  objectType?: CityDesignObjectType;
  properties?: Record<string, CityDesignPropertyValue>;
  sectionId?: string;
  width?: number;
}

export interface CityDesignLegendEntryGroup {
  id: string;
  labelKey: string;
  entries: CityDesignLegendEntry[];
}

export interface CityDesignLegendSection {
  id: CityDesignLegendSource;
  labelKey: string;
  entries: CityDesignLegendEntry[];
  groups?: CityDesignLegendEntryGroup[];
}

interface BuildCityDesignLegendSectionsArgs {
  design: CityDesignStateV1;
  hiddenObjectIds?: readonly string[];
  hiddenObjectCategories?: readonly CityDesignObjectCategory[];
}

const legendSectionLabelKeys = {
  existing: 'features.amendments.cityDesign.canvas.legendExisting',
  planned: 'features.amendments.cityDesign.canvas.legendPlanned',
} satisfies Record<CityDesignLegendSource, string>;

const sectionByLayer = new Map(cityDesignElementSections.map(section => [section.layer, section]));

export function buildCityDesignLegendSections({
  design,
}: BuildCityDesignLegendSectionsArgs): CityDesignLegendSection[] {
  const existingEntries = buildExistingLegendEntries(design);
  const plannedGroups = buildPlannedLegendEntryGroups();
  const plannedEntries = plannedGroups.flatMap(group => group.entries);

  const sections: CityDesignLegendSection[] = [
    {
      id: 'existing',
      labelKey: legendSectionLabelKeys.existing,
      entries: existingEntries,
    },
    {
      id: 'planned',
      labelKey: legendSectionLabelKeys.planned,
      entries: plannedEntries,
      groups: plannedGroups,
    },
  ];

  return sections.filter(section => section.entries.length > 0);
}

function buildExistingLegendEntries(design: CityDesignStateV1): CityDesignLegendEntry[] {
  const layerVisibility = getCityDesignOsmLayerVisibility(design.osmLayerVisibility);
  const hiddenOsmFeatureIds = getCityDesignHiddenOsmFeatureIds(design);
  const entriesByLayer = new Map<CityDesignOsmFeatureLayer, CityDesignLegendEntry[]>();
  const seenKeys = new Set<string>();

  getCityDesignOsmFeatures(design.osmSnapshot).forEach(feature => {
    const layer = getCityDesignOsmFeatureLayer(feature.kind);
    if (hiddenOsmFeatureIds.has(feature.id) || !layerVisibility[layer]) return;

    const section = sectionByLayer.get(layer) as (typeof cityDesignElementSections)[number];
    const objectType = feature.mappedObjectType as CityDesignObjectType;
    const key = `${layer}:${objectType}:${feature.renderProfile as string}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    const definition = getCityDesignObjectDefinition(objectType);
    const layerEntries = entriesByLayer.get(layer) ?? [];

    layerEntries.push({
      id: layerEntries.length === 0 ? `existing:${layer}` : `existing:${layer}:${objectType}`,
      source: 'existing',
      kind: 'existing-layer',
      labelKey: definition.labelKey,
      color: muteExistingColor(getExistingLegendColor(feature, layer)),
      renderKind: definition.renderKind,
      layer,
      objectType,
      properties: {
        ...definition.defaultProperties,
        ...(feature.mappedProperties as Record<string, CityDesignPropertyValue>),
      },
      sectionId: section.layer,
      width: feature.widthMeters ?? definition.defaultWidth,
    });
    entriesByLayer.set(layer, layerEntries);
  });

  return cityDesignElementSections.flatMap(section => entriesByLayer.get(section.layer) ?? []);
}

function muteExistingColor(color: string) {
  const normalized = color.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!normalized) return color;
  const neutral = [0x9a, 0xa0, 0xa3];
  const mixed = [0, 2, 4].map((offset, index) => {
    const channel = Number.parseInt(normalized.slice(offset, offset + 2), 16);
    return Math.round(channel * 0.45 + neutral[index] * 0.55)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${mixed.join('')}`;
}

function buildPlannedLegendEntryGroups(): CityDesignLegendEntryGroup[] {
  return cityDesignElementSections.flatMap(section => {
    const entries =
      section.tools && section.tools.length > 0
        ? section.tools.map(tool =>
            createPlannedPresetLegendEntry({
              id: `planned-preset:${tool.id}`,
              kind: 'placement-preset',
              labelKey: tool.labelKey,
              objectType: tool.objectType,
              propertyOverrides: tool.propertyOverrides,
              sectionId: section.layer,
              width: tool.widthOverride,
            })
          )
        : section.objectTypes.map(type =>
            createPlannedPresetLegendEntry({
              id: `planned-fallback:${type}`,
              kind: 'placement-fallback',
              objectType: type,
              sectionId: section.layer,
            })
          );

    return [
      {
        id: `planned-group:${section.layer}`,
        labelKey: section.labelKey,
        entries,
      },
    ];
  });
}

function createPlannedPresetLegendEntry(args: {
  id: string;
  kind: 'placement-preset' | 'placement-fallback';
  objectType: CityDesignObjectType;
  sectionId: string;
  labelKey?: string;
  propertyOverrides?: Record<string, CityDesignPropertyValue>;
  width?: number;
}): CityDesignLegendEntry {
  const definition = getCityDesignObjectDefinition(args.objectType);
  const properties = {
    ...definition.defaultProperties,
    ...(args.propertyOverrides ?? {}),
  };

  return {
    id: args.id,
    source: 'planned',
    kind: args.kind,
    labelKey: args.labelKey ?? definition.labelKey,
    color: getPlannedLegendColor(args.objectType, properties),
    renderKind: definition.renderKind,
    objectType: args.objectType,
    properties,
    sectionId: args.sectionId,
    width: args.width ?? definition.defaultWidth,
  };
}

function getExistingLegendColor(feature: CityDesignOsmFeature, layer: CityDesignOsmFeatureLayer) {
  if (feature.renderColor) return feature.renderColor;

  const fallbackType = sectionByLayer.get(layer)?.objectTypes[0];
  return fallbackType ? cityDesignObjectRegistry[fallbackType].color : '#64748b';
}

function getPlannedLegendColor(
  type: CityDesignObjectType,
  properties: Record<string, CityDesignPropertyValue>
) {
  const definition = getCityDesignObjectDefinition(type);
  return (
    stringProperty(properties.renderColor) ?? stringProperty(properties.color) ?? definition.color
  );
}

function stringProperty(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export const cityDesignLegendInternals = {
  buildExistingLegendEntries,
  buildPlannedLegendEntryGroups,
  createPlannedPresetLegendEntry,
  getExistingLegendColor,
  getPlannedLegendColor,
  muteExistingColor,
  stringProperty,
};
