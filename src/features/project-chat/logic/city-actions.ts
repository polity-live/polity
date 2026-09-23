import type {
  CityDesignStateV1,
  CityDesignObject,
  CityDesignGeometry,
  CityDesignPropertyValue,
} from '@/features/amendments/city-design/types';
import {
  getCityDesignObjectDefinition,
  cityDesignObjectRegistry,
} from '@/features/amendments/city-design/logic/cityDesignObjectRegistry';
import {
  createPointCityDesignObject,
  createCorridorCityDesignObject,
  createPathCorridorCityDesignObject,
  createPolygonGeometry,
  rotateCityDesignObject,
  updateCorridorWidth,
  createCorridorGeometry,
  createPathCorridorGeometry,
} from '@/features/amendments/city-design/logic/cityDesignPlacement';
import { getCityDesignOsmFeatures } from '@/features/amendments/city-design/logic/cityDesignOsm';
import { convertCityDesignOsmFeature } from '@/features/amendments/city-design/logic/cityDesignOsmConversion';
import { getCityDesignCostSummary } from '@/features/amendments/city-design/logic/cityDesignCosting';
import { cityProjectionSchema } from '@/features/amendments/city-design/logic/projection-schema';
import { ProjectToolError, registerRef, resolveRef, type CityAction } from './contracts';

export function validateCityProperties(
  type: CityDesignObject['type'],
  values: Record<string, CityDesignPropertyValue>
) {
  const fields = getCityDesignObjectDefinition(type).propertySchema;
  for (const [key, value] of Object.entries(values)) {
    const field = fields.find(f => f.key === key);
    if (!field || value === null)
      throw new ProjectToolError('invalid_action', `Unsupported property: ${key}`);
    if (
      field.fieldType === 'number' &&
      (typeof value !== 'number' ||
        !Number.isFinite(value) ||
        (field.min !== undefined && value < field.min) ||
        (field.max !== undefined && value > field.max))
    )
      throw new ProjectToolError('invalid_action', `Invalid number: ${key}`);
    if (field.fieldType === 'boolean' && typeof value !== 'boolean')
      throw new ProjectToolError('invalid_action', `Invalid boolean: ${key}`);
    if (['text', 'select', 'combobox'].includes(field.fieldType) && typeof value !== 'string')
      throw new ProjectToolError('invalid_action', `Invalid text: ${key}`);
    if (field.fieldType === 'select' && !field.options?.some(o => o.value === value))
      throw new ProjectToolError('invalid_action', `Invalid option: ${key}`);
  }
}
type GeometryInput = Extract<CityAction, { type: 'object.add' }>['geometry'];
function createObject(
  id: string,
  type: CityDesignObject['type'],
  geometry: GeometryInput,
  properties: Record<string, CityDesignPropertyValue>,
  currency: string
): CityDesignObject {
  validateCityProperties(type, properties);
  const overrides = { properties, currency };
  const definition = getCityDesignObjectDefinition(type);
  switch (geometry.kind) {
    case 'point':
      return createPointCityDesignObject({
        id,
        type,
        point: geometry.point,
        overrides: { ...overrides, rotationDeg: geometry.rotationDeg },
      });
    case 'corridor':
      return createCorridorCityDesignObject({
        id,
        type,
        start: geometry.start,
        end: geometry.end,
        width: geometry.widthMeters,
        overrides,
      });
    case 'path_corridor':
      return createPathCorridorCityDesignObject({
        id,
        type,
        points: geometry.points,
        width: geometry.widthMeters,
        overrides,
      });
    case 'polygon': {
      if (definition.geometryKind !== 'polygon')
        throw new ProjectToolError('unsupported_operation');
      const result = createPolygonGeometry(geometry.points);
      if (result.area <= 0) throw new ProjectToolError('invalid_action', 'Degenerate polygon');
      return {
        id,
        type,
        geometry: result,
        properties: { ...definition.defaultProperties, ...properties },
        cost: {
          rule: definition.costRule,
          currency,
          suggestedUnitCostMinor: definition.suggestedUnitCostMinor,
        },
      };
    }
  }
}
function translate(geometry: CityDesignGeometry, dx: number, dz: number): CityDesignGeometry {
  const move = (p: { x: number; z: number }) => ({ x: p.x + dx, z: p.z + dz });
  switch (geometry.kind) {
    case 'point':
      return { ...geometry, point: move(geometry.point) };
    case 'polygon':
      return createPolygonGeometry(geometry.points.map(move));
    case 'corridor':
      return createCorridorGeometry(move(geometry.start), move(geometry.end), geometry.width);
    case 'path_corridor':
      return createPathCorridorGeometry(geometry.points.map(move), geometry.width);
  }
}
export function applyCityActions(
  input: CityDesignStateV1,
  actions: CityAction[],
  createId = () => crypto.randomUUID()
) {
  const value = structuredClone(input);
  const createdRefs: Record<string, string> = Object.create(null);
  for (const action of actions) {
    if (action.type === 'object.add') {
      value.objects.push(
        createObject(
          registerRef(action.ref, createdRefs, createId),
          action.objectType,
          action.geometry,
          action.properties,
          value.currency
        )
      );
      continue;
    }
    if (action.type === 'osm.import_feature') {
      const feature = getCityDesignOsmFeatures(value.osmSnapshot).find(
        f => f.id === action.featureId
      );
      if (!feature) throw new ProjectToolError('invalid_reference');
      if (value.objects.some(o => o.provenance?.featureId === feature.id))
        throw new ProjectToolError('invalid_action', 'Feature already imported');
      const objects = convertCityDesignOsmFeature({
        feature,
        origin: value.origin,
        createId,
        currency: value.currency,
      });
      if (!objects.length)
        throw new ProjectToolError('unsupported_operation', 'Feature cannot be converted');
      value.objects.push(...objects);
      continue;
    }
    const id = resolveRef(action.object, createdRefs);
    const index = value.objects.findIndex(o => o.id === id);
    if (index < 0) throw new ProjectToolError('invalid_reference');
    const object = value.objects[index];
    switch (action.type) {
      case 'object.patch':
        validateCityProperties(object.type, action.properties);
        Object.assign(object.properties, action.properties);
        break;
      case 'object.set_geometry':
        object.geometry = createObject(
          id,
          object.type,
          action.geometry,
          {},
          value.currency
        ).geometry;
        break;
      case 'object.translate':
        object.geometry = translate(object.geometry, action.dxMeters, action.dzMeters);
        break;
      case 'object.rotate':
        value.objects[index] = rotateCityDesignObject(object, action.rotationDeg);
        break;
      case 'object.set_width': {
        if (!['corridor', 'path_corridor'].includes(object.geometry.kind))
          throw new ProjectToolError('unsupported_operation');
        value.objects[index] = updateCorridorWidth(object, action.widthMeters);
        break;
      }
      case 'object.set_unit_cost':
        if (action.unitCostMinor === null) delete object.cost.customUnitCostMinor;
        else object.cost.customUnitCostMinor = action.unitCostMinor;
        break;
      case 'object.remove':
        value.objects.splice(index, 1);
        break;
    }
  }
  cityProjectionSchema.parse(value);
  return { value, createdRefs, costs: getCityDesignCostSummary(value.objects, value.currency) };
}
export function cityCatalog(types?: string[]) {
  return Object.values(cityDesignObjectRegistry).filter(
    def => !types?.length || types.includes(def.type)
  );
}
