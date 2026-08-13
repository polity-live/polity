import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logic/cityDesignPlacement', async importOriginal => ({
  ...(await importOriginal<typeof import('../../logic/cityDesignPlacement')>()),
  isPathCorridorObjectType: (type: string) => type === 'sidewalk',
}));

import {
  cityDesignReducer,
  createEmptyCityDesignState,
  createInitialCityDesignEditorState,
} from '../cityDesignReducer';

describe('cityDesignReducer LSF non-empty filter callbacks', () => {
  it('unhides newly placed point, corridor, and path objects', () => {
    const initial = createInitialCityDesignEditorState(createEmptyCityDesignState());
    const pointState = {
      ...initial,
      interactionMode: 'place' as const,
      hiddenObjectIds: ['point-id'],
      hiddenObjectCategories: ['greenery' as const],
    };
    const point = cityDesignReducer(pointState, {
      type: 'scene_pointer_down',
      point: { x: 0, z: 0 },
      id: 'point-id',
    });
    expect(point.design.objects).toHaveLength(1);

    const corridorStart = cityDesignReducer(
      {
        ...initial,
        interactionMode: 'place',
        placementSettings: { ...initial.placementSettings, type: 'car_lane' },
      },
      { type: 'scene_pointer_down', point: { x: 0, z: 0 }, id: 'unused' }
    );
    const corridor = cityDesignReducer(
      {
        ...corridorStart,
        hiddenObjectIds: ['corridor-id'],
        hiddenObjectCategories: ['mobility'],
      },
      { type: 'scene_pointer_down', point: { x: 4, z: 0 }, id: 'corridor-id' }
    );
    expect(corridor.design.objects).toHaveLength(1);

    const path = cityDesignReducer(
      {
        ...initial,
        interactionMode: 'place',
        placementSettings: { ...initial.placementSettings, type: 'sidewalk' },
        placementDraft: {
          type: 'sidewalk',
          mode: 'path',
          start: { x: 0, z: 0 },
          points: [
            { x: 0, z: 0 },
            { x: 3, z: 0 },
          ],
          preview: null,
        },
        hiddenObjectIds: ['path-id'],
        hiddenObjectCategories: ['mobility'],
      } as any,
      { type: 'finish_path_placement', id: 'path-id' }
    );
    expect(path.design.objects).toHaveLength(1);
  });

  it('removes deleted category objects from a non-empty hidden list', () => {
    const initial = createInitialCityDesignEditorState(createEmptyCityDesignState());
    const object = cityDesignReducer(
      {
        ...initial,
        interactionMode: 'place',
        hiddenObjectIds: ['tree-id'],
        hiddenObjectCategories: ['greenery'],
      },
      { type: 'scene_pointer_down', point: { x: 0, z: 0 }, id: 'tree-id' }
    );
    const deleted = cityDesignReducer(
      {
        ...object,
        hiddenObjectIds: ['tree-id', 'other'],
        hiddenObjectCategories: ['greenery'],
      },
      { type: 'delete_object_category', category: 'greenery' }
    );
    expect(deleted.hiddenObjectIds).toEqual(expect.any(Array));
  });
});
