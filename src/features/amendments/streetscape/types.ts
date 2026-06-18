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
  | 'parking_area'
  | 'street'
  | 'car_lane'
  | 'bike_lane'
  | 'sidewalk'
  | 'building';

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
  label: string;
  fieldType: 'text' | 'number' | 'select' | 'boolean';
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
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
  label: string;
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
  label: string;
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

export interface StreetDesignOsmWay {
  id: string;
  kind: 'road' | 'building' | 'green' | 'water';
  label?: string;
  points: StreetDesignGeoPoint[];
  height?: number;
  tags?: Record<string, string>;
}

export interface StreetDesignOsmSnapshot {
  fetchedAt: number;
  bbox: StreetDesignBoundingBox;
  ways: StreetDesignOsmWay[];
}

export interface StreetDesignOsmLayerVisibility {
  road: boolean;
  building: boolean;
  green: boolean;
  water: boolean;
}

export interface StreetDesignStateV1 {
  schemaVersion: 1;
  origin: StreetDesignOrigin;
  mapSelection?: StreetDesignMapSelection;
  osmSnapshot: StreetDesignOsmSnapshot | null;
  osmLayerVisibility?: StreetDesignOsmLayerVisibility;
  hiddenOsmWayIds?: string[];
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
