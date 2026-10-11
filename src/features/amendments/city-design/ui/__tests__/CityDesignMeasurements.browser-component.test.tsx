import { render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '@/styles.css';
import { StreetSceneCanvasView } from '../StreetSceneCanvasView';
import { projectLocalPointToCanvasAnchor } from '../StreetSceneCanvasViewView';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import {
  createCorridorCityDesignObject,
  createPointCityDesignObject,
  createPolygonGeometry,
  getCityDesignGeometryCenter,
  getCityDesignGeometryRotationDeg,
  createPathCorridorCityDesignObject,
} from '../../logic/cityDesignPlacement';
import { useCityDesignEditorState } from '../../hooks/useCityDesignEditorState';
import type { CityDesignCameraPose, CityDesignLocalPoint, CityDesignStateV1 } from '../../types';

const pose: CityDesignCameraPose = {
  position: { x: 0, y: 70, z: 55 },
  target: { x: 0, y: 0, z: 0 },
};
const band = (
  id: string,
  type: 'street' | 'bike_lane' | 'parking_area',
  z: number,
  width: number
) => createCorridorCityDesignObject({ id, type, start: { x: -25, z }, end: { x: 25, z }, width });
const initialDesign: CityDesignStateV1 = {
  ...createEmptyCityDesignState(),
  comparisonMode: 'new_design',
  objects: [
    band('road', 'street', 0, 6),
    band('parking', 'parking_area', 4.5, 3),
    band('bike', 'bike_lane', 7, 2),
    createPathCorridorCityDesignObject({
      id: 'crossing-road',
      type: 'street',
      width: 6,
      points: [
        { x: 15, z: -25 },
        { x: 15, z: 0 },
        { x: 15, z: 25 },
        { x: 25, z: 35 },
      ],
    }),
  ],
};
function Harness({
  initialState = initialDesign,
  readOnly = false,
}: {
  initialState?: CityDesignStateV1;
  readOnly?: boolean;
}) {
  const editor = useCityDesignEditorState(initialState);
  return (
    <>
      {initialState.objects.map(object => (
        <button key={object.id} onClick={() => editor.selectObject(object.id)}>
          Edit {object.id}
        </button>
      ))}
      <output hidden data-testid="document">
        {JSON.stringify(editor.design)}
      </output>
      <output hidden data-testid="cost">
        {editor.selectedObjectCostLine?.totalCostMinor}
      </output>
      <output hidden data-testid="selected">
        {editor.state.selectedObjectId}
      </output>
      <output hidden data-testid="dirty">
        {String(editor.state.isDirty)}
      </output>
      <div style={{ width: 1100, height: 650 }}>
        <StreetSceneCanvasView
          fillContainer
          design={editor.design}
          initialCameraPose={pose}
          remoteCursors={[
            {
              userId: 'reference',
              name: 'Reference',
              color: '#ff0000',
              position: { x: 0, z: 0 },
              layer: 'design',
            },
          ]}
          isLoadingOsm={false}
          placementPreview={null}
          placementPreviewType={null}
          placementStart={null}
          placementMode={null}
          placementPointCount={0}
          canFinishPathPlacement={false}
          selectedObjectId={editor.state.selectedObjectId}
          selectedObject={editor.selectedObject}
          selectedObjectCostLine={editor.selectedObjectCostLine}
          selectedObjectFocusRequestKey={0}
          selectedOsmWayId={editor.state.selectedOsmWayId}
          selectedOsmWay={editor.selectedOsmWay}
          selectedOsmFocusRequestKey={0}
          hiddenObjectIds={editor.state.hiddenObjectIds}
          hiddenObjectCategories={editor.state.hiddenObjectCategories}
          interactionMode={editor.interactionMode}
          readOnly={readOnly}
          onPointerDown={editor.handleScenePointerDown}
          onPointerMove={editor.handleScenePointerMove}
          onFinishPlacement={editor.finishPlacement}
          onFinishPathPlacement={editor.finishPathPlacement}
          onCancelPlacement={editor.cancelPlacement}
          onObjectSelect={editor.selectObject}
          onOsmWaySelect={editor.selectOsmWay}
          onObjectVisibilityChange={editor.setObjectVisibility}
          onOsmWayHide={editor.hideOsmWay}
          onObjectRotate={editor.rotateObject}
          onPropertyChange={editor.updateObjectProperty}
          onWidthChange={editor.updateObjectWidth}
          onLengthChange={editor.updateObjectLength}
          onPositionChange={editor.updateObjectPosition}
          onRotationChange={editor.rotateObject}
          onUnitCostChange={editor.updateObjectUnitCost}
          onDeleteObject={editor.deleteObject}
        />
      </div>
    </>
  );
}

it('selects multiple real surfaces, measures without dirtying the document and commits dimensions', async () => {
  await page.viewport(1200, 850);
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  // The first scene imports Three.js and OrbitControls before creating its renderer.
  await waitFor(
    () => {
      expect(canvas.dataset.engine).toContain('three.js');
      expect(canvas.width).toBe(canvas.clientWidth);
    },
    { timeout: 10_000 }
  );
  const click = async (point: CityDesignLocalPoint, control = false) => {
    const anchor = projectLocalPointToCanvasAnchor(point, pose, {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    })!;
    await userEvent.click(canvas, {
      position: {
        x: (anchor.leftPercent / 100) * canvas.clientWidth,
        y: (anchor.topPercent / 100) * canvas.clientHeight,
      },
      ...(control ? { modifiers: ['Control' as const] } : {}),
    });
  };
  await click({ x: -10, z: 0 });
  await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('road'));
  await click({ x: -10, z: 4.5 }, true);
  await waitFor(() => expect(screen.getByText('9.00 m')).toBeTruthy());
  const multi = screen.getByRole('button', { name: 'Multiple selection' });
  multi.focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(multi.getAttribute('aria-pressed')).toBe('true'));
  await click({ x: -10, z: 7 });
  multi.focus();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByText('Sum of element widths')).toBeTruthy();
  expect(screen.getByText('11.00 m')).toBeTruthy();
  expect(screen.getByTestId('dirty').textContent).toBe('false');
  await userEvent.click(screen.getByRole('button', { name: 'Measure cross-section' }));
  await click({ x: -5, z: -8 });
  await click({ x: -5, z: 12 });
  await waitFor(() => expect(screen.getByText('Covered width')).toBeTruthy());
  expect(screen.getByText('Covered width').nextElementSibling?.textContent).toBe('11.00 m');
  expect(screen.getByTestId('dirty').textContent).toBe('false');
  const endpoint = screen.getByRole('button', { name: 'Move the end of the measuring line' });
  endpoint.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByTestId('dirty').textContent).toBe('false');
  const leftBeforePan = endpoint.style.left;
  endpoint.blur();
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(endpoint.style.left).not.toBe(leftBeforePan));
  expect(screen.getByText('Covered width').nextElementSibling?.textContent).toBe('11.00 m');
  expect(screen.getByTestId('dirty').textContent).toBe('false');
  await userEvent.keyboard('{ArrowLeft}');
  await waitFor(() => expect(endpoint.style.left).toBe(leftBeforePan));
  await page.screenshot({
    path: '../../../../../../output/playwright/city-design-cross-section.png',
  });
  await userEvent.click(screen.getByRole('button', { name: 'Measure cross-section' }));
  await userEvent.click(screen.getByRole('button', { name: 'Remove measuring line' }));
  await click({ x: -10, z: 7 });
  const width = screen.getByRole('textbox', { name: 'Width' });
  await userEvent.fill(width, '2.5');
  await waitFor(() => expect(screen.getByTestId('dirty').textContent).toBe('true'));
  await userEvent.keyboard('{Enter}');
  const length = screen.getByRole('textbox', { name: 'Length' });
  await userEvent.fill(length, '30');
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect((length as HTMLInputElement).value).toBe('30'));
}, 30_000);

it('renders multi-lane junctions and keeps crossing roads selectable while editing lane counts', async () => {
  await page.viewport(1200, 850);
  const main = band('main', 'street', 0, 12);
  main.properties.lanes = 4;
  const cross = createCorridorCityDesignObject({
    id: 'cross',
    type: 'street',
    start: { x: 0, z: -25 },
    end: { x: 0, z: 25 },
    width: 6,
  });
  const branch = createCorridorCityDesignObject({
    id: 'branch',
    type: 'street',
    start: { x: -17, z: 0 },
    end: { x: -17, z: 25 },
    width: 6,
  });
  const { container } = render(
    <Harness
      initialState={{
        ...createEmptyCityDesignState(),
        comparisonMode: 'new_design',
        objects: [main, cross, branch],
      }}
    />
  );
  const canvas = container.querySelector('canvas')!;
  await waitFor(() => {
    expect(canvas.dataset.engine).toContain('three.js');
    expect(canvas.width).toBe(canvas.clientWidth);
  });
  const click = async (point: CityDesignLocalPoint) => {
    const anchor = projectLocalPointToCanvasAnchor(point, pose, {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    })!;
    await userEvent.click(canvas, {
      position: {
        x: (anchor.leftPercent / 100) * canvas.clientWidth,
        y: (anchor.topPercent / 100) * canvas.clientHeight,
      },
    });
  };
  await page.screenshot({
    path: '../../../../../../output/playwright/city-design-junction-markings.png',
  });
  await click({ x: 12, z: 0 });
  await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('main'));
  const lanes = screen.getByRole('textbox', { name: /^Lanes$/ });
  expect((lanes as HTMLInputElement).value).toBe('4');
  await userEvent.fill(lanes, '1');
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect((lanes as HTMLInputElement).value).toBe('1'));
  await click({ x: 0, z: -17 });
  await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('cross'));
  expect(screen.getByTestId('dirty').textContent).toBe('true');
}, 30_000);

const liveObjects = [
  createPointCityDesignObject({ id: 'tree', type: 'tree', point: { x: 0, z: 0 } }),
  createPathCorridorCityDesignObject({
    id: 'curved-road',
    type: 'street',
    points: [
      { x: 0, z: -20 },
      { x: 15, z: -20 },
      { x: 15, z: -5 },
    ],
    width: 3,
  }),
  {
    ...createCorridorCityDesignObject({
      id: 'building',
      type: 'building',
      start: { x: 20, z: 5 },
      end: { x: 30, z: 5 },
      width: 8,
    }),
    geometry: createPolygonGeometry([
      { x: 20, z: 5 },
      { x: 30, z: 5 },
      { x: 30, z: 15 },
      { x: 24, z: 12 },
      { x: 20, z: 5 },
    ]),
    provenance: { source: 'osm' as const, featureId: 'osm-building', confidence: 'exact' as const },
  },
];
const liveDesign = {
  ...createEmptyCityDesignState(),
  comparisonMode: 'new_design' as const,
  objects: liveObjects,
};
const documentObject = (id: string) =>
  (JSON.parse(screen.getByTestId('document').textContent!) as CityDesignStateV1).objects.find(
    object => object.id === id
  )!;

it('updates position, rotation, dimensions, object properties and price live without moving the camera', async () => {
  await page.viewport(1200, 850);
  const { container } = render(<Harness initialState={liveDesign} />);
  const canvas = container.querySelector('canvas')!;
  await waitFor(() => expect(canvas.dataset.engine).toContain('three.js'));
  await userEvent.click(screen.getByRole('button', { name: 'Edit tree' }));
  const x = screen.getByRole('textbox', { name: 'Position X' }) as HTMLInputElement;
  await userEvent.fill(x, '-5,20');
  expect(x.value).toBe('-5,20');
  expect(getCityDesignGeometryCenter(documentObject('tree').geometry).x).toBe(-5.2);
  await userEvent.fill(screen.getByRole('textbox', { name: 'Position Z' }), '8');
  await userEvent.fill(screen.getByRole('textbox', { name: 'Rotation' }), '45');
  expect(getCityDesignGeometryRotationDeg(documentObject('tree').geometry)).toBe(45);
  await userEvent.fill(screen.getByRole('textbox', { name: 'Height (m)' }), '8,5');
  expect(documentObject('tree').properties.height).toBe(8.5);
  await userEvent.fill(screen.getByRole('textbox', { name: 'Price' }), '12,34');
  expect(documentObject('tree').cost.customUnitCostMinor).toBe(1234);
  expect(screen.getByTestId('cost').textContent).toBe('1234');
  await userEvent.fill(screen.getByRole('textbox', { name: 'Price' }), '');
  expect(documentObject('tree').cost.customUnitCostMinor).toBe(1234);
  await userEvent.keyboard('{Escape}');
  expect((screen.getByRole('textbox', { name: 'Price' }) as HTMLInputElement).value).toBe('12.34');

  await userEvent.click(screen.getByRole('button', { name: 'Edit curved-road' }));
  const original = documentObject('curved-road').geometry;
  if (original.kind !== 'path_corridor') throw new Error('Expected curve');
  const length = screen.getByRole('textbox', { name: 'Length' });
  await userEvent.fill(length, '5');
  expect(documentObject('curved-road').geometry).not.toEqual(original);
  await userEvent.fill(length, String(original.length));
  expect(documentObject('curved-road').geometry).toEqual(original);
  await userEvent.keyboard('{Enter}');
  await userEvent.fill(screen.getByRole('textbox', { name: 'Width' }), '4');
  const widened = documentObject('curved-road').geometry;
  if (widened.kind !== 'path_corridor') throw new Error('Expected curve');
  expect(widened.width).toBe(4);
  await userEvent.fill(screen.getByRole('textbox', { name: 'Lanes' }), '2');
  expect(documentObject('curved-road').properties.lanes).toBe(2);
  await userEvent.fill(screen.getByRole('textbox', { name: 'Rotation' }), '60');
  expect(getCityDesignGeometryRotationDeg(documentObject('curved-road').geometry)).toBeCloseTo(
    60,
    1
  );

  await userEvent.click(screen.getByRole('button', { name: 'Edit building' }));
  const building = documentObject('building');
  await userEvent.fill(screen.getByRole('textbox', { name: 'Position X' }), '35');
  expect(getCityDesignGeometryCenter(documentObject('building').geometry).x).toBe(35);
  await userEvent.fill(screen.getByRole('textbox', { name: 'Rotation' }), '30');
  await userEvent.fill(screen.getByRole('textbox', { name: 'Rotation' }), '80');
  expect(getCityDesignGeometryRotationDeg(documentObject('building').geometry)).toBeCloseTo(80, 1);
  expect(screen.queryByRole('textbox', { name: 'Length' })).toBeNull();
  const changed = documentObject('building');
  if (changed.geometry.kind !== 'polygon' || building.geometry.kind !== 'polygon')
    throw new Error('Expected building footprint');
  expect(changed.geometry.area).toBeCloseTo(building.geometry.area, 1);
  const reference = screen.getByTestId('city-design-remote-cursor-reference');
  const currentAnchor = reference.style.cssText;
  const rotation = screen.getByRole('textbox', { name: 'Rotation' });
  await userEvent.click(rotation);
  await userEvent.keyboard('{ArrowRight}{ArrowDown}');
  expect(reference.style.cssText).toBe(currentAnchor);
  (rotation as HTMLInputElement).blur();
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(reference.style.cssText).not.toBe(currentAnchor));
  expect(screen.getByTestId('selected').textContent).toBe('building');
}, 30_000);

it('resets same-valued selections and disables every numeric property in read-only mode', async () => {
  await page.viewport(1200, 850);
  const secondTree = { ...liveObjects[0], id: 'other-tree' };
  const initialState = { ...liveDesign, objects: [...liveObjects, secondTree] };
  const view = render(<Harness initialState={initialState} />);
  await userEvent.click(screen.getByRole('button', { name: 'Edit tree' }));
  await userEvent.fill(screen.getByRole('textbox', { name: 'Position X' }), '-');
  expect(screen.getByTestId('dirty').textContent).toBe('false');
  await userEvent.click(screen.getByRole('button', { name: 'Edit other-tree' }));
  expect((screen.getByRole('textbox', { name: 'Position X' }) as HTMLInputElement).value).toBe('0');
  view.rerender(<Harness initialState={initialState} readOnly />);
  for (const object of initialState.objects) {
    await userEvent.click(screen.getByRole('button', { name: `Edit ${object.id}` }));
    for (const input of screen.getAllByRole('textbox'))
      expect((input as HTMLInputElement).disabled).toBe(true);
  }
  expect(screen.getByTestId('dirty').textContent).toBe('false');
}, 30_000);

it('removes the selected real surface with Delete and keeps text editing and read-only elements intact', async () => {
  await page.viewport(1200, 850);
  const view = render(<Harness />);
  const canvas = view.container.querySelector('canvas')!;
  await waitFor(() => expect(canvas.dataset.engine).toContain('three.js'));
  const anchor = projectLocalPointToCanvasAnchor({ x: -10, z: 0 }, pose, {
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  })!;
  await userEvent.click(canvas, {
    position: {
      x: (anchor.leftPercent / 100) * canvas.clientWidth,
      y: (anchor.topPercent / 100) * canvas.clientHeight,
    },
  });
  expect(screen.getByTestId('selected').textContent).toBe('road');
  const width = screen.getByRole('textbox', { name: 'Width' }) as HTMLInputElement;
  await userEvent.click(width);
  await userEvent.keyboard('{Control>}a{/Control}{Delete}');
  expect(documentObject('road')).toBeDefined();
  expect(screen.getByTestId('dirty').textContent).toBe('false');
  width.blur();
  await userEvent.keyboard('{Delete}');
  await waitFor(() => expect(documentObject('road')).toBeUndefined());
  expect(documentObject('parking')).toBeDefined();
  expect(screen.getByTestId('selected').textContent).toBe('');
  expect(screen.queryByRole('complementary')).toBeNull();
  expect(screen.getByTestId('dirty').textContent).toBe('true');
  await userEvent.keyboard('{Delete}');
  expect(documentObject('parking')).toBeDefined();
  await userEvent.click(screen.getByRole('button', { name: 'Edit parking' }));
  (document.activeElement as HTMLElement).blur();
  view.rerender(<Harness readOnly />);
  await userEvent.keyboard('{Delete}');
  expect(documentObject('parking')).toBeDefined();
}, 30_000);
