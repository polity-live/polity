export type CityDesignComparisonMode = 'original' | 'new_design' | 'overlay' | 'split';

export type CityDesignComparisonLayer = 'original' | 'design';

export type CityDesignInteractionMode = 'place' | 'select' | 'camera';

export type CityDesignGeometryKind = 'point' | 'line' | 'polygon' | 'corridor';

export type CityDesignCostRule =
  'per_item' | 'per_meter' | 'per_square_meter' | 'per_parking_space';

export type CityDesignToolMode = 'point' | 'drag-band' | 'path' | 'polygon';

export type CityDesignRenderKind =
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

export type CityDesignObjectType =
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
  | 'station_platform'
  | 'kerb'
  | 'traffic_sign'
  | 'traffic_island'
  | 'public_space'
  | 'building_entrance'
  | 'charging_station'
  | 'public_toilet'
  | 'taxi_stand';

export type CityDesignOsmMappingConfidence = 'exact' | 'derived' | 'generic';

export type CityDesignOsmRenderProfile =
  | 'road'
  | 'sidewalk'
  | 'bike_lane'
  | 'parking'
  | 'loading_zone'
  | 'crossing'
  | 'tactile'
  | 'transit'
  | 'barrier'
  | 'green'
  | 'water'
  | 'building'
  | 'public_space'
  | 'utility';

export interface CityDesignLocalPoint {
  x: number;
  z: number;
}

export interface CityDesignGeoPoint {
  lat: number;
  lon: number;
}

export interface CityDesignOrigin extends CityDesignGeoPoint {
  label?: string;
}

export interface CityDesignBoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface CityDesignMapSelection {
  center: CityDesignGeoPoint;
  widthMeters: number;
  heightMeters: number;
  rotationDeg: number;
}

export interface CityDesignSelectionAddress {
  placeId?: string;
  formatted?: string;
  country?: string;
  region?: string;
  city?: string;
  postCode?: string;
  street?: string;
  houseNumber?: string;
}

export interface CityDesignVector3 {
  x: number;
  y: number;
  z: number;
}

export interface CityDesignCameraPose {
  position: CityDesignVector3;
  target: CityDesignVector3;
}

export interface PointGeometry {
  kind: 'point';
  point: CityDesignLocalPoint;
  rotation: number;
}

export interface PolygonGeometry {
  kind: 'polygon';
  points: CityDesignLocalPoint[];
  area: number;
}

export interface CorridorGeometry {
  kind: 'corridor';
  start: CityDesignLocalPoint;
  end: CityDesignLocalPoint;
  width: number;
  polygon: CityDesignLocalPoint[];
  length: number;
  area: number;
  rotation: number;
}

export interface PathCorridorGeometry {
  kind: 'path_corridor';
  points: CityDesignLocalPoint[];
  roundedCenterline: CityDesignLocalPoint[];
  width: number;
  polygon: CityDesignLocalPoint[];
  length: number;
  area: number;
  cornerRadius: number;
}

export type CityDesignGeometry =
  PointGeometry | PolygonGeometry | CorridorGeometry | PathCorridorGeometry;

export type CityDesignPropertyValue = string | number | boolean | null;

export interface CityDesignPropertySchemaField {
  key: string;
  labelKey: string;
  fieldType: 'text' | 'number' | 'select' | 'combobox' | 'boolean';
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { labelKey: string; value: string }[];
}

export interface CityDesignObjectCost {
  rule: CityDesignCostRule;
  currency: string;
  suggestedUnitCostMinor: number;
  customUnitCostMinor?: number;
}

export interface CityDesignObject {
  id: string;
  type: CityDesignObjectType;
  geometry: CityDesignGeometry;
  properties: Record<string, CityDesignPropertyValue>;
  cost: CityDesignObjectCost;
  provenance?: {
    source: 'osm';
    featureId: string;
    confidence: CityDesignOsmMappingConfidence;
  };
}

export interface CityDesignPlacementSettings {
  type: CityDesignObjectType;
  width: number;
  rotationDeg: number;
  rotationLocked: boolean;
  properties: Record<string, CityDesignPropertyValue>;
  customUnitCostMinor: number | null;
}

export interface CityDesignObjectDefinition {
  type: CityDesignObjectType;
  labelKey: string;
  icon: string;
  category: 'greenery' | 'mobility' | 'street' | 'furniture' | 'building' | 'water';
  geometryKind: CityDesignGeometryKind;
  defaultProperties: Record<string, CityDesignPropertyValue>;
  propertySchema: CityDesignPropertySchemaField[];
  costRule: CityDesignCostRule;
  suggestedUnitCostMinor: number;
  renderKind: CityDesignRenderKind;
  toolMode: CityDesignToolMode;
  defaultWidth?: number;
  color: string;
}

export type CityDesignObjectCategory = CityDesignObjectDefinition['category'];

export interface CityDesignCostLine {
  objectId: string;
  type: CityDesignObjectType;
  labelKey: string;
  displayLabelKey?: string;
  category: CityDesignObjectDefinition['category'];
  rule: CityDesignCostRule;
  quantity: number;
  unitCostMinor: number;
  totalCostMinor: number;
  currency: string;
}

export interface CityDesignCostSummary {
  currency: string;
  totalCostMinor: number;
  lines: CityDesignCostLine[];
  categories: {
    category: CityDesignObjectDefinition['category'];
    totalCostMinor: number;
    quantity: number;
  }[];
}

export type CityDesignOsmFeatureKind =
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

export type CityDesignOsmFeatureGeometryKind = 'point' | 'line' | 'polygon';

export type CityDesignOsmStructureKind =
  'bridge' | 'viaduct' | 'embankment' | 'tunnel' | 'cutting' | 'steps';

export type CityDesignOsmElevationSource = 'osm' | 'heuristic' | 'surface';

export type CityDesignOsmFeatureLayer =
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

export interface CityDesignOsmFeature {
  id: string;
  kind: CityDesignOsmFeatureKind;
  geometryKind: CityDesignOsmFeatureGeometryKind;
  label?: string;
  points?: CityDesignGeoPoint[];
  point?: CityDesignGeoPoint;
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
  structureKind?: CityDesignOsmStructureKind;
  elevationSource?: CityDesignOsmElevationSource;
  tags?: Record<string, string>;
  source?: 'osm' | 'derived' | 'fallback' | 'sample';
  mappedObjectType?: CityDesignObjectType;
  mappedProperties?: Record<string, CityDesignPropertyValue>;
  mappingConfidence?: CityDesignOsmMappingConfidence;
  renderProfile?: CityDesignOsmRenderProfile;
}

export type CityDesignOsmWay = CityDesignOsmFeature;

export interface CityDesignOsmSnapshot {
  fetchedAt: number;
  bbox: CityDesignBoundingBox;
  features?: CityDesignOsmFeature[];
  ways?: CityDesignOsmWay[];
}

export interface CityDesignOsmLayerVisibility {
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

export interface CityDesignStateV1 {
  schemaVersion: 1;
  origin: CityDesignOrigin;
  mapSelection?: CityDesignMapSelection;
  selectionAddress?: CityDesignSelectionAddress;
  osmSnapshot: CityDesignOsmSnapshot | null;
  osmLayerVisibility?: CityDesignOsmLayerVisibility;
  hiddenOsmWayIds?: string[];
  hiddenOsmFeatureIds?: string[];
  showStreetMarkings?: boolean;
  comparisonMode: CityDesignComparisonMode;
  currency: string;
  costCatalogVersion: string;
  objects: CityDesignObject[];
}

export interface CityDesignPlacementDraft {
  type: CityDesignObjectType;
  mode: 'drag_band' | 'path';
  start: CityDesignLocalPoint;
  points: CityDesignLocalPoint[];
  preview: CorridorGeometry | PathCorridorGeometry | null;
}
