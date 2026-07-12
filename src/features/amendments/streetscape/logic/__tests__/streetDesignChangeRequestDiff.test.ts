import { describe, expect, it } from 'vitest';
import type { StreetDesignObject, StreetDesignStateV1 } from '../../types';
import { createEmptyStreetDesignState } from '../../state/streetDesignReducer';
import {
  applyStreetDesignChangeRequestToDesign,
  createStreetDesignChangeRequestPayloads,
} from '../streetDesignChangeRequestDiff';

function object(overrides: Partial<StreetDesignObject> = {}): StreetDesignObject {
  return {
    id: 'object-1',
    type: 'tree',
    geometry: {
      kind: 'point',
      point: { x: 2, z: 3 },
      rotation: 0,
    },
    properties: { species: 'oak' },
    cost: {
      rule: 'per_item',
      currency: 'EUR',
      suggestedUnitCostMinor: 100_00,
    },
    ...overrides,
  };
}

function state(objects: StreetDesignObject[]): StreetDesignStateV1 {
  return {
    ...createEmptyStreetDesignState(),
    objects,
  };
}

describe('street design change request diffs', () => {
  it('does not create broad scene CRs for map context or presentation changes', () => {
    const base = createEmptyStreetDesignState();
    const draft: StreetDesignStateV1 = {
      ...base,
      mapSelection: {
        center: { lat: 52.517, lon: 13.3889 },
        widthMeters: 180,
        heightMeters: 120,
        rotationDeg: 15,
      },
      selectionAddress: { formatted: 'Unter den Linden 1, Berlin' },
      comparisonMode: 'split',
      showStreetMarkings: false,
    };

    expect(
      createStreetDesignChangeRequestPayloads({
        amendmentId: 'amendment-1',
        streetDesignId: 'street-design-1',
        baseDesign: base,
        draftDesign: draft,
      })
    ).toEqual([]);
  });

  it('creates an insert payload with only new properties', () => {
    const inserted = object();
    const [payload] = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      processBranchId: 'branch-1',
      streetDesignId: 'street-design-1',
      baseDesign: state([]),
      draftDesign: state([inserted]),
      createId: () => 'cr-1',
    });

    expect(payload).toMatchObject({
      id: 'cr-1',
      source_type: 'street_design_object',
      source_id: 'object-1',
      change_type: 'insert',
      original_properties: null,
      new_text: 'tree object-1',
    });
    expect(payload?.new_properties).toMatchObject({
      streetDesignId: 'street-design-1',
      objectId: 'object-1',
      object: inserted,
    });
  });

  it('creates a delete payload with only original properties', () => {
    const removed = object();
    const [payload] = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      baseDesign: state([removed]),
      draftDesign: state([]),
      createId: () => 'cr-1',
    });

    expect(payload).toMatchObject({
      source_type: 'street_design_object',
      source_id: 'object-1',
      change_type: 'delete',
      new_properties: null,
      original_text: 'tree object-1',
    });
    expect(payload?.original_properties).toMatchObject({
      objectId: 'object-1',
      object: removed,
    });
  });

  it('creates an update payload with before and after snapshots', () => {
    const before = object();
    const after = object({ properties: { species: 'lime' } });
    const [payload] = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      baseDesign: state([before]),
      draftDesign: state([after]),
      createId: () => 'cr-1',
    });

    expect(payload).toMatchObject({
      change_type: 'update',
      source_id: 'object-1',
    });
    expect(payload?.original_properties).toMatchObject({ object: before });
    expect(payload?.new_properties).toMatchObject({ object: after });
  });

  it('creates one payload per changed object', () => {
    const existing = object({ id: 'object-1' });
    const updated = object({ id: 'object-1', properties: { species: 'lime' } });
    const inserted = object({ id: 'object-2' });

    const payloads = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      baseDesign: state([existing]),
      draftDesign: state([updated, inserted]),
      createId: () => crypto.randomUUID(),
    });

    expect(payloads.map(payload => payload.change_type).sort()).toEqual(['insert', 'update']);
  });

  it('creates one readable CR for a unit-price-only change', () => {
    const before = object();
    const after = object({
      cost: { ...before.cost, customUnitCostMinor: 12_345 },
    });
    const [payload] = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      processBranchId: 'branch-1',
      streetDesignId: 'street-design-1',
      baseDesign: state([before]),
      draftDesign: state([after]),
      createId: () => 'cr-price',
    });

    expect(payload).toMatchObject({
      id: 'cr-price',
      change_type: 'update',
      description: expect.stringContaining('unit price changed'),
      original_text: 'Unit price: 100.00 EUR',
      new_text: 'Unit price: 123.45 EUR',
    });
    expect(payload?.new_properties).toMatchObject({
      object: { cost: { customUnitCostMinor: 12_345 } },
    });
    expect(payload?.changed_character_count).toBeGreaterThan(0);
    expect(payload?.changed_character_count).toBeLessThan(200);
  });

  it('keeps price and geometry changes for one element in one CR', () => {
    const before = object();
    const after = object({
      geometry: { kind: 'point', point: { x: 8, z: 3 }, rotation: 0 },
      cost: { ...before.cost, customUnitCostMinor: 12_345 },
    });

    const payloads = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      baseDesign: state([before]),
      draftDesign: state([after]),
      createId: () => 'cr-combined',
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.new_properties).toMatchObject({ object: after });
  });

  it('records resetting a custom price to the suggested catalog price', () => {
    const before = object({
      cost: {
        rule: 'per_item',
        currency: 'EUR',
        suggestedUnitCostMinor: 100_00,
        customUnitCostMinor: 12_345,
      },
    });
    const after = object();
    const [payload] = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      baseDesign: state([before]),
      draftDesign: state([after]),
      createId: () => 'cr-reset-price',
    });

    expect(payload?.original_text).toBe('Unit price: 123.45 EUR');
    expect(payload?.new_text).toBe('Unit price: 100.00 EUR');
    expect(payload?.new_properties).not.toMatchObject({
      object: { cost: { customUnitCostMinor: expect.anything() } },
    });
  });

  it('applies accepted insert, update and delete payloads to a design state', () => {
    const before = object();
    const after = object({ properties: { species: 'lime' } });
    const inserted = object({ id: 'object-2' });
    const base = state([before]);

    const [updatePayload] = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      baseDesign: base,
      draftDesign: state([after]),
      createId: () => 'cr-update',
    });
    const [insertPayload] = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      baseDesign: state([after]),
      draftDesign: state([after, inserted]),
      createId: () => 'cr-insert',
    });
    const [deletePayload] = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      baseDesign: state([after, inserted]),
      draftDesign: state([inserted]),
      createId: () => 'cr-delete',
    });
    expect(updatePayload).toBeDefined();
    expect(insertPayload).toBeDefined();
    expect(deletePayload).toBeDefined();

    const updated = applyStreetDesignChangeRequestToDesign(
      base,
      updatePayload as NonNullable<typeof updatePayload>
    );
    expect(updated.objects.find(item => item.id === 'object-1')?.properties.species).toBe('lime');

    const withInsert = applyStreetDesignChangeRequestToDesign(
      updated,
      insertPayload as NonNullable<typeof insertPayload>
    );
    expect(withInsert.objects.map(item => item.id).sort()).toEqual(['object-1', 'object-2']);

    const withDelete = applyStreetDesignChangeRequestToDesign(
      withInsert,
      deletePayload as NonNullable<typeof deletePayload>
    );
    expect(withDelete.objects.map(item => item.id)).toEqual(['object-2']);
  });

  it('merges accepted updates fieldwise and lets the later CR win only overlapping fields', () => {
    const baseObject = object();
    const priceObject = object({
      cost: { ...baseObject.cost, customUnitCostMinor: 12_345 },
    });
    const geometryObject = object({
      geometry: { kind: 'point', point: { x: 9, z: 3 }, rotation: 0 },
    });
    const laterPriceObject = object({
      cost: { ...baseObject.cost, customUnitCostMinor: 15_000 },
    });
    const [priceCr] = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      baseDesign: state([baseObject]),
      draftDesign: state([priceObject]),
      createId: () => 'cr-price',
    });
    const [geometryCr] = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      baseDesign: state([baseObject]),
      draftDesign: state([geometryObject]),
      createId: () => 'cr-geometry',
    });
    const [laterPriceCr] = createStreetDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      baseDesign: state([baseObject]),
      draftDesign: state([laterPriceObject]),
      createId: () => 'cr-later-price',
    });
    if (!priceCr || !geometryCr || !laterPriceCr) {
      throw new Error('Expected price and geometry change requests');
    }

    const afterPrice = applyStreetDesignChangeRequestToDesign(state([baseObject]), priceCr);
    const afterGeometry = applyStreetDesignChangeRequestToDesign(afterPrice, geometryCr);
    expect(afterGeometry.objects[0]).toMatchObject({
      geometry: geometryObject.geometry,
      cost: { customUnitCostMinor: 12_345 },
    });

    const afterLaterPrice = applyStreetDesignChangeRequestToDesign(afterGeometry, laterPriceCr);
    expect(afterLaterPrice.objects[0]).toMatchObject({
      geometry: geometryObject.geometry,
      cost: { customUnitCostMinor: 15_000 },
    });
  });
});
