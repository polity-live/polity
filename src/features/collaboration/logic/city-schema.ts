import { z } from 'zod';
import { cityDesignObjectTypes } from '@/features/amendments/city-design/logic/cityDesignObjectRegistry';
const finite = z.number().finite();
const point = z.strictObject({ x: finite, z: finite });
const points = z.array(point).max(100_000);
const geometry = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('point'), point, rotation: finite }),
  z.strictObject({ kind: z.literal('polygon'), points, area: finite.nonnegative() }),
  z.strictObject({
    kind: z.literal('corridor'),
    start: point,
    end: point,
    width: finite.positive(),
    polygon: points,
    length: finite.nonnegative(),
    area: finite.nonnegative(),
    rotation: finite,
  }),
  z.strictObject({
    kind: z.literal('path_corridor'),
    points,
    roundedCenterline: points,
    width: finite.positive(),
    polygon: points,
    length: finite.nonnegative(),
    area: finite.nonnegative(),
    cornerRadius: finite.nonnegative(),
  }),
]);
export const cityProjectionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  origin: z.object({
    lat: finite.min(-90).max(90),
    lon: finite.min(-180).max(180),
    label: z.string().optional(),
  }),
  mapSelection: z.unknown().optional(),
  selectionAddress: z.unknown().optional(),
  osmSnapshot: z.unknown(),
  osmLayerVisibility: z.unknown().optional(),
  hiddenOsmWayIds: z.array(z.string()).optional(),
  hiddenOsmFeatureIds: z.array(z.string()).optional(),
  showStreetMarkings: z.boolean().optional(),
  comparisonMode: z.enum(['original', 'new_design', 'overlay', 'split']),
  currency: z.string().length(3),
  costCatalogVersion: z.string().max(100),
  objects: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(200),
        type: z.enum(cityDesignObjectTypes),
        geometry,
        properties: z.record(z.string(), z.union([z.string(), finite, z.boolean(), z.null()])),
        cost: z.strictObject({
          rule: z.enum(['per_item', 'per_meter', 'per_square_meter', 'per_parking_space']),
          currency: z.string().length(3),
          suggestedUnitCostMinor: finite.nonnegative(),
          customUnitCostMinor: finite.nonnegative().optional(),
        }),
        provenance: z
          .strictObject({
            source: z.literal('osm'),
            featureId: z.string(),
            confidence: z.enum(['exact', 'derived', 'generic']),
          })
          .optional(),
      })
    )
    .max(50_000),
});
