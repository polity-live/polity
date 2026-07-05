export type StreetDesignComparisonMode = 'original' | 'new_design' | 'overlay' | 'split';

export type StreetDesignInteractionMode = 'place' | 'select' | 'camera';

export type StreetDesignGeometryKind = 'point' | 'line' | 'polygon' | 'corridor';

export type StreetDesignCostRule =
  | 'per_item'
  | 'per_meter'
  | 'per_square_meter'
  | 'per_parking_space';

export type StreetDesignToolMode = 'point' | 'drag-band' | 'path' | 'polygon';

export type StreetDesignRenderKind =
  | 'tree'
  | 'bush'
  | 'bench'
  | 'street_furniture'
  | 'utility'
  | 'barrier'
  | 'rail'
  | 'traffic'
  | 'transit'
  | 'playground'
  | 'sports'
  | 'stairs'
  | 'surface'
  | 'lane'
  | 'road'
  | 'parking'
  | 'building';

export type StreetDesignObjectType =
  | 'tree'
  | 'bush'
  | 'bank'
  | 'grass_strip'
  | 'flower_bed'
  | 'water_area'
  | 'wetland_area'
  | 'parking_area'
  | 'loading_zone'
  | 'street'
  | 'car_lane'
  | 'bike_lane'
  | 'sidewalk'
  | 'building'
  | 'street_lamp'
  | 'hydrant'
  | 'bicycle_parking'
  | 'bollard'
  | 'gate'
  | 'fence'
  | 'wall'
  | 'traffic_signal'
  | 'crossing'
  | 'traffic_calming'
  | 'bus_stop'
  | 'rail_track'
  | 'playground'
  | 'sports_pitch'
  | 'waste_bin'
  | 'recycling_container'
  | 'post_box'
  | 'fountain'
  | 'stairs'
  | 'hedge'
  | 'scrub_area'
  | 'heath_area'
  | 'orchard_area'
  | 'vineyard_area'
  | 'construction_area'
  | 'landuse_context_area'
  | 'civic_area'
  | 'station_platform';

export interface StreetDesignLocalPoint {
  x: number;
  z: number;
}

export interface StreetDesignGeoPoint {
  lat: number;
  lon: number;
}

export interface StreetDesignOrigin extends StreetDesignGeoPoint {
  label?: string;
}

export interface StreetDesignBoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface StreetDesignMapSelection {
  center: StreetDesignGeoPoint;
  widthMeters: number;
  heightMeters: number;
  rotationDeg: number;
}

export interface StreetDesignVector3 {
  x: number;
  y: number;
  z: number;
}

export interface StreetDesignCameraPose {
  position: StreetDesignVector3;
  target: StreetDesignVector3;
}

export interface PointGeometry {
  kind: 'point';
  point: StreetDesignLocalPoint;
  rotation: number;
}

export interface PolygonGeometry {
  kind: 'polygon';
  points: StreetDesignLocalPoint[];
  area: number;
}

export interface CorridorGeometry {
  kind: 'corridor';
  start: StreetDesignLocalPoint;
  end: StreetDesignLocalPoint;
  width: number;
  polygon: StreetDesignLocalPoint[];
  length: number;
  area: number;
  rotation: number;
}

export interface PathCorridorGeometry {
  kind: 'path_corridor';
  points: StreetDesignLocalPoint[];
  roundedCenterline: StreetDesignLocalPoint[];
  width: number;
  polygon: StreetDesignLocalPoint[];
  length: number;
  area: number;
  cornerRadius: number;
}

export type StreetDesignGeometry =
  | PointGeometry
  | PolygonGeometry
  | CorridorGeometry
  | PathCorridorGeometry;

export type StreetDesignPropertyValue = string | number | boolean | null;

export interface StreetDesignPropertySchemaField {
  key: string;
  labelKey: string;
  fieldType: 'text' | 'number' | 'select' | 'combobox' | 'boolean';
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { labelKey: string; value: string }[];
}

export interface StreetDesignObjectCost {
  rule: StreetDesignCostRule;
  currency: string;
  suggestedUnitCostMinor: number;
  customUnitCostMinor?: number;
}

export interface StreetDesignObject {
  id: string;
  type: StreetDesignObjectType;
  geometry: StreetDesignGeometry;
  properties: Record<string, StreetDesignPropertyValue>;
  cost: StreetDesignObjectCost;
}

export interface StreetDesignPlacementSettings {
  type: StreetDesignObjectType;
  width: number;
  rotationDeg: number;
  rotationLocked: boolean;
  properties: Record<string, StreetDesignPropertyValue>;
  customUnitCostMinor: number | null;
}

export interface StreetDesignObjectDefinition {
  type: StreetDesignObjectType;
  labelKey: string;
  icon: string;
  category: 'greenery' | 'mobility' | 'street' | 'furniture' | 'building' | 'water';
  geometryKind: StreetDesignGeometryKind;
  defaultProperties: Record<string, StreetDesignPropertyValue>;
  propertySchema: StreetDesignPropertySchemaField[];
  costRule: StreetDesignCostRule;
  suggestedUnitCostMinor: number;
  renderKind: StreetDesignRenderKind;
  toolMode: StreetDesignToolMode;
  defaultWidth?: number;
  color: string;
}

export type StreetDesignObjectCategory = StreetDesignObjectDefinition['category'];

export interface StreetDesignCostLine {
  objectId: string;
  type: StreetDesignObjectType;
  labelKey: string;
  displayLabelKey?: string;
  category: StreetDesignObjectDefinition['category'];
  rule: StreetDesignCostRule;
  quantity: number;
  unitCostMinor: number;
  totalCostMinor: number;
  currency: string;
}

export interface StreetDesignCostSummary {
  currency: string;
  totalCostMinor: number;
  lines: StreetDesignCostLine[];
  categories: {
    category: StreetDesignObjectDefinition['category'];
    totalCostMinor: number;
    quantity: number;
  }[];
}

export type StreetDesignOsmFeatureKind =
  | 'road'
  | 'building'
  | 'green'
  | 'water'
  | 'sidewalk'
  | 'bike_lane'
  | 'parking'
  | 'tree'
  | 'tree_row'
  | 'rail'
  | 'transit'
  | 'barrier'
  | 'street_furniture'
  | 'traffic'
  | 'sports'
  | 'construction'
  | 'landuse_context'
  | 'playground'
  | 'utility'
  | 'civic_area';

export type StreetDesignOsmFeatureGeometryKind = 'point' | 'line' | 'polygon';

export type StreetDesignOsmStructureKind =
  | 'bridge'
  | 'viaduct'
  | 'embankment'
  | 'tunnel'
  | 'cutting'
  | 'steps';

export type StreetDesignOsmElevationSource = 'osm' | 'heuristic' | 'surface';

export type StreetDesignOsmFeatureLayer =
  | 'road'
  | 'building'
  | 'green'
  | 'water'
  | 'sidewalk'
  | 'bike_lane'
  | 'parking'
  | 'trees'
  | 'rail'
  | 'transit'
  | 'barrier'
  | 'street_furniture'
  | 'traffic'
  | 'sports'
  | 'construction'
  | 'landuse_context';

export interface StreetDesignOsmFeature {
  id: string;
  kind: StreetDesignOsmFeatureKind;
  geometryKind: StreetDesignOsmFeatureGeometryKind;
  label?: string;
  points?: StreetDesignGeoPoint[];
  point?: StreetDesignGeoPoint;
  widthMeters?: number;
  offsetMeters?: number;
  side?: 'left' | 'right';
  height?: number;
  subkind?: string;
  renderColor?: string;
  renderVariant?: string;
  semanticUse?: string;
  level?: 'surface' | 'bridge' | 'tunnel';
  access?: 'public' | 'private' | 'destination';
  layerIndex?: number;
  elevationMeters?: number;
  baseElevationMeters?: number;
  deckElevationMeters?: number;
  clearanceMeters?: number;
  incline?: string;
  stepCount?: number;
  structureKind?: StreetDesignOsmStructureKind;
  elevationSource?: StreetDesignOsmElevationSource;
  tags?: Record<string, string>;
  source?: 'osm' | 'derived' | 'fallback' | 'sample';
}

export type StreetDesignOsmWay = StreetDesignOsmFeature;

export interface StreetDesignOsmSnapshot {
  fetchedAt: number;
  bbox: StreetDesignBoundingBox;
  features?: StreetDesignOsmFeature[];
  ways?: StreetDesignOsmWay[];
}

export interface StreetDesignOsmLayerVisibility {
  road: boolean;
  building: boolean;
  green: boolean;
  water: boolean;
  sidewalk: boolean;
  bike_lane: boolean;
  parking: boolean;
  trees: boolean;
  rail: boolean;
  transit: boolean;
  barrier: boolean;
  street_furniture: boolean;
  traffic: boolean;
  sports: boolean;
  construction: boolean;
  landuse_context: boolean;
}

export interface StreetDesignStateV1 {
  schemaVersion: 1;
  origin: StreetDesignOrigin;
  mapSelection?: StreetDesignMapSelection;
  osmSnapshot: StreetDesignOsmSnapshot | null;
  osmLayerVisibility?: StreetDesignOsmLayerVisibility;
  hiddenOsmWayIds?: string[];
  hiddenOsmFeatureIds?: string[];
  showStreetMarkings?: boolean;
  comparisonMode: StreetDesignComparisonMode;
  currency: string;
  costCatalogVersion: string;
  objects: StreetDesignObject[];
}

export interface StreetDesignPlacementDraft {
  type: StreetDesignObjectType;
  mode: 'drag_band' | 'path';
  start: StreetDesignLocalPoint;
  points: StreetDesignLocalPoint[];
  preview: CorridorGeometry | PathCorridorGeometry | null;
}
