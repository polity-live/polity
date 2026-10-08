/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { useCityDesignMeasurements } from '../useCityDesignMeasurements';
import {
  CityDesignMeasurementPanel,
  CityDesignMeasurementTools,
} from '../CityDesignMeasurementPanel';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import { createCorridorCityDesignObject } from '../../logic/cityDesignPlacement';
import type { CityDesignSceneController } from '../../logic/cityDesignScene';
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').pop() }),
}));
afterEach(cleanup);
const design = {
  ...createEmptyCityDesignState(),
  comparisonMode: 'overlay' as const,
  objects: [
    createCorridorCityDesignObject({
      id: 'road',
      type: 'street',
      start: { x: -20, z: 0 },
      end: { x: 20, z: 0 },
      width: 6,
    }),
    createCorridorCityDesignObject({
      id: 'bridge',
      type: 'street',
      start: { x: -20, z: 0 },
      end: { x: 20, z: 0 },
      width: 8,
      overrides: {
        properties: {
          layerIndex: 1,
          deckElevationMeters: 5,
          structureKind: 'bridge',
          level: 'bridge',
        },
      },
    }),
  ],
};
function Harness({ split = false }: { split?: boolean }) {
  const [selectedObjectId, onObjectSelect] = useState<string | null>(null);
  const [selectedOsmWayId, onOsmWaySelect] = useState<string | null>(null);
  const m = useCityDesignMeasurements({
    design: split ? { ...design, comparisonMode: 'split' } : design,
    selectedObjectId,
    selectedOsmWayId,
    onObjectSelect,
    onOsmWaySelect,
    hiddenObjectIds: [],
    hiddenObjectCategories: [],
    sceneControllerRef: useRef<CityDesignSceneController | null>(null),
  });
  return (
    <>
      <CityDesignMeasurementTools measurements={m} />
      <CityDesignMeasurementPanel measurements={m} design={design} />
      <button onClick={() => m.selectObject('road')}>road</button>
      <button onClick={() => m.selectObject('bridge')}>bridge</button>
      <button onClick={() => m.onMeasurementPoint({ x: 0, z: -10 }, 'design')}>start design</button>
      <button onClick={() => m.onMeasurementPoint({ x: 0, z: 10 }, 'original')}>
        end original
      </button>
      <button onClick={() => m.onMeasurementPoint({ x: 0, z: 10 }, 'design')}>end design</button>
      <output data-testid="state">
        {JSON.stringify({
          selection: m.selection,
          measurement: m.measurement,
          awaitingEnd: m.awaitingEnd,
          covered: m.measurementResult?.covered,
        })}
      </output>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');
it('toggles touch selection and measures isolated comparison layers and elevations through focused controls', () => {
  const before = JSON.stringify(design);
  render(<Harness />);
  const multi = screen.getByRole('button', { name: 'multiSelect' });
  multi.focus();
  fireEvent.click(multi);
  expect(multi.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByText('road'));
  fireEvent.click(screen.getByText('bridge'));
  expect(state().selection).toHaveLength(2);
  fireEvent.click(screen.getByText('road'));
  expect(state().selection).toHaveLength(1);
  fireEvent.click(multi);
  expect(multi.getAttribute('aria-pressed')).toBe('false');
  const tool = screen.getByRole('button', { name: 'tool' });
  tool.focus();
  fireEvent.click(tool);
  expect(tool.getAttribute('aria-pressed')).toBe('true');
  const level = screen.getByRole('combobox', { name: 'level' });
  level.focus();
  const options = (level as HTMLSelectElement).options;
  fireEvent.change(level, { target: { value: options[1].value } });
  fireEvent.click(screen.getByText('start design'));
  fireEvent.click(screen.getByText('end design'));
  expect(state().covered).toBeCloseTo(8);
  fireEvent.change(level, { target: { value: options[0].value } });
  expect(state().covered).toBeCloseTo(6);
  const clear = screen.getByRole('button', { name: 'clear' });
  clear.focus();
  fireEvent.click(clear);
  expect(state().measurement).toBeNull();
  const layer = screen.getByRole('combobox', { name: 'layer' });
  layer.focus();
  fireEvent.change(layer, { target: { value: 'original' } });
  fireEvent.click(screen.getByText('start design'));
  expect(state().measurement.layer).toBe('original');
  expect(state().covered).toBe(0);
  fireEvent.change(layer, { target: { value: 'design' } });
  expect(state().measurement).toBeNull();
  fireEvent.click(tool);
  expect(tool.getAttribute('aria-pressed')).toBe('false');
  expect(JSON.stringify(design)).toBe(before);
});
it('keeps a split measurement on the side where its first point was placed', () => {
  render(<Harness split />);
  fireEvent.click(screen.getByText('start design'));
  fireEvent.click(screen.getByText('end original'));
  expect(state().awaitingEnd).toBe(true);
  expect(state().measurement.end).toEqual({ x: 0, z: -10 });
  fireEvent.click(screen.getByText('end design'));
  expect(state().awaitingEnd).toBe(false);
  expect(state().covered).toBeCloseTo(6);
});

it('labels original surface widths from OSM names, mapped types and missing feature identities', () => {
  const ids = ['named', 'mapped', 'missing'];
  const measurements = {
    selection: ids.map(id => ({ id, layer: 'original' })),
    selectedWidths: ids.map(id => ({
      id,
      layer: 'original',
      width: 2,
      kind: 'road',
      estimated: false,
    })),
    measurementActive: false,
    measurement: null,
  } as unknown as Parameters<typeof CityDesignMeasurementPanel>[0]['measurements'];
  render(
    <CityDesignMeasurementPanel
      measurements={measurements}
      design={{
        ...design,
        osmSnapshot: {
          fetchedAt: 1,
          bbox: { south: 0, north: 1, west: 0, east: 1 },
          features: [
            {
              id: 'named',
              kind: 'road',
              geometryKind: 'line',
              points: [
                { lat: 0, lon: 0 },
                { lat: 0, lon: 1 },
              ],
              label: 'Named road',
            },
            {
              id: 'mapped',
              kind: 'road',
              geometryKind: 'line',
              points: [
                { lat: 0, lon: 0 },
                { lat: 0, lon: 1 },
              ],
              mappedObjectType: 'street',
            },
          ],
        },
      }}
    />
  );
  expect(screen.getByText('Named road')).toBeTruthy();
  expect(screen.getByText('label')).toBeTruthy();
  expect(screen.getByText('missing')).toBeTruthy();
  expect(screen.getByText('6.00 m')).toBeTruthy();
});

it('reports gaps and estimated sections and retains labels for objects deleted during a measurement', () => {
  const measurements = {
    selection: [
      { id: 'road', layer: 'design' },
      { id: 'deleted', layer: 'design' },
    ],
    selectedWidths: [
      { id: 'road', layer: 'design', width: 6, estimated: true },
      { id: 'deleted', layer: 'design', width: 2, estimated: false },
    ],
    measurement: { start: { x: 0, z: -10 }, end: { x: 0, z: 10 }, layer: 'design' },
    levels: [],
    measurementLayer: 'design',
    setMeasurementLevel: vi.fn(),
    clearMeasurement: vi.fn(),
    measurementResult: {
      span: 10,
      covered: 8,
      gaps: 2,
      overlaps: 0,
      length: 20,
      sections: [
        { start: 0, end: 6, ids: ['road'] },
        { start: 6, end: 8, ids: [] },
        { start: 8, end: 10, ids: ['deleted'] },
      ],
      intervals: [{ estimated: true }],
    },
  } as unknown as Parameters<typeof CityDesignMeasurementPanel>[0]['measurements'];
  const view = render(<CityDesignMeasurementPanel measurements={measurements} design={design} />);
  expect(screen.getByText('gap')).toBeTruthy();
  expect(screen.getByText('estimatedDescription')).toBeTruthy();
  expect(screen.getAllByText('deleted')).toHaveLength(2);
  view.rerender(
    <CityDesignMeasurementPanel
      measurements={{
        ...measurements,
        measurementResult: { ...measurements.measurementResult!, intervals: [], sections: [] },
      }}
      design={design}
    />
  );
  expect(screen.getByText('noHits')).toBeTruthy();
});
