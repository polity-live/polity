import type {
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignOsmFeature,
  StreetDesignOsmFeatureLayer,
  StreetDesignPropertyValue,
  StreetDesignRenderKind,
  StreetDesignStateV1,
} from '../types';
import {
  getStreetDesignObjectDefinition,
  streetDesignObjectRegistry,
} from './streetDesignObjectRegistry';
import { streetDesignElementSections } from './streetDesignElementSections';
import {
  getStreetDesignHiddenOsmFeatureIds,
  getStreetDesignOsmFeatureLayer,
  getStreetDesignOsmFeatures,
  getStreetDesignOsmLayerVisibility,
} from './streetDesignOsm';

export type StreetDesignLegendSource = 'existing' | 'planned';
export type StreetDesignLegendEntryKind =
  'existing-layer' | 'placement-preset' | 'placement-fallback';

export interface StreetDesignLegendEntry {
  id: string;
  source: StreetDesignLegendSource;
  kind: StreetDesignLegendEntryKind;
  labelKey: string;
  color: string;
  renderKind: StreetDesignRenderKind;
  layer?: StreetDesignOsmFeatureLayer;
  objectType?: StreetDesignObjectType;
  properties?: Record<string, StreetDesignPropertyValue>;
  sectionId?: string;
  width?: number;
}

export interface StreetDesignLegendEntryGroup {
  id: string;
  labelKey: string;
  entries: StreetDesignLegendEntry[];
}

export interface StreetDesignLegendSection {
  id: StreetDesignLegendSource;
  labelKey: string;
  entries: StreetDesignLegendEntry[];
  groups?: StreetDesignLegendEntryGroup[];
}

interface BuildStreetDesignLegendSectionsArgs {
  design: StreetDesignStateV1;
  hiddenObjectIds?: readonly string[];
  hiddenObjectCategories?: readonly StreetDesignObjectCategory[];
}

const legendSectionLabelKeys = {
  existing: 'features.amendments.streetscape.canvas.legendExisting',
  planned: 'features.amendments.streetscape.canvas.legendPlanned',
} satisfies Record<StreetDesignLegendSource, string>;

const sectionByLayer = new Map(
  streetDesignElementSections.map(section => [section.layer, section])
);

export function buildStreetDesignLegendSections({
  design,
}: BuildStreetDesignLegendSectionsArgs): StreetDesignLegendSection[] {
  const existingEntries = buildExistingLegendEntries(design);
  const plannedGroups = buildPlannedLegendEntryGroups();
  const plannedEntries = plannedGroups.flatMap(group => group.entries);

  const sections: StreetDesignLegendSection[] = [
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

function buildExistingLegendEntries(design: StreetDesignStateV1): StreetDesignLegendEntry[] {
  const layerVisibility = getStreetDesignOsmLayerVisibility(design.osmLayerVisibility);
  const hiddenOsmFeatureIds = getStreetDesignHiddenOsmFeatureIds(design);
  const entriesByLayer = new Map<StreetDesignOsmFeatureLayer, StreetDesignLegendEntry[]>();
  const seenKeys = new Set<string>();

  getStreetDesignOsmFeatures(design.osmSnapshot).forEach(feature => {
    const layer = getStreetDesignOsmFeatureLayer(feature.kind);
    if (hiddenOsmFeatureIds.has(feature.id) || !layerVisibility[layer]) return;

    const section = sectionByLayer.get(layer);
    if (!section) return;
    const objectType = feature.mappedObjectType ?? section.objectTypes[0];
    if (!objectType) return;
    const key = `${layer}:${objectType}:${feature.renderProfile ?? feature.subkind ?? ''}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    const definition = getStreetDesignObjectDefinition(objectType);
    const layerEntries = entriesByLayer.get(layer) ?? [];

    layerEntries.push({
      id: layerEntries.length === 0 ? `existing:${layer}` : `existing:${layer}:${objectType}`,
      source: 'existing',
      kind: 'existing-layer',
      labelKey: feature.mappedObjectType ? definition.labelKey : section.labelKey,
      color: muteExistingColor(getExistingLegendColor(feature, layer)),
      renderKind: definition.renderKind,
      layer,
      objectType,
      properties: {
        ...definition.defaultProperties,
        ...(feature.mappedProperties ?? {}),
      },
      sectionId: section.layer,
      width: feature.widthMeters ?? definition.defaultWidth,
    });
    entriesByLayer.set(layer, layerEntries);
  });

  return streetDesignElementSections.flatMap(section => entriesByLayer.get(section.layer) ?? []);
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

function buildPlannedLegendEntryGroups(): StreetDesignLegendEntryGroup[] {
  const seenEntryIds = new Set<string>();

  return streetDesignElementSections.flatMap(section => {
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

    const uniqueEntries = entries.filter(entry => {
      if (seenEntryIds.has(entry.id)) return false;
      seenEntryIds.add(entry.id);
      return true;
    });

    return uniqueEntries.length > 0
      ? [
          {
            id: `planned-group:${section.layer}`,
            labelKey: section.labelKey,
            entries: uniqueEntries,
          },
        ]
      : [];
  });
}

function createPlannedPresetLegendEntry(args: {
  id: string;
  kind: 'placement-preset' | 'placement-fallback';
  objectType: StreetDesignObjectType;
  sectionId: string;
  labelKey?: string;
  propertyOverrides?: Record<string, StreetDesignPropertyValue>;
  width?: number;
}): StreetDesignLegendEntry {
  const definition = getStreetDesignObjectDefinition(args.objectType);
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

function getExistingLegendColor(
  feature: StreetDesignOsmFeature,
  layer: StreetDesignOsmFeatureLayer
) {
  if (feature.renderColor) return feature.renderColor;

  const fallbackType = sectionByLayer.get(layer)?.objectTypes[0];
  return fallbackType ? streetDesignObjectRegistry[fallbackType].color : '#64748b';
}

function getPlannedLegendColor(
  type: StreetDesignObjectType,
  properties: Record<string, StreetDesignPropertyValue>
) {
  const definition = getStreetDesignObjectDefinition(type);
  return (
    stringProperty(properties.renderColor) ?? stringProperty(properties.color) ?? definition.color
  );
}

function stringProperty(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
