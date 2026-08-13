/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useReactFlowMock = vi.fn();
const getSmoothStepPathMock = vi.fn();
const useEdgeClickContextMock = vi.fn();
const resolveInnerAutoEdgeAnchorsMock = vi.fn();

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => useReactFlowMock(),
  getSmoothStepPath: (...args: unknown[]) => getSmoothStepPathMock(...args),
}));

vi.mock('@/features/network/ui/NetworkFlowBase', () => ({
  useEdgeClickContext: () => useEdgeClickContextMock(),
}));

vi.mock('@/features/network/logic/networkEdgeHelpers', () => ({
  resolveInnerAutoEdgeAnchors: (...args: unknown[]) => resolveInnerAutoEdgeAnchorsMock(...args),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string, fallback: string) => fallback || key }),
}));

import { useRightsLabelEdgeController } from '../useRightsLabelEdgeController';

function edgeProps(data: Record<string, unknown> | undefined = undefined, overrides = {}) {
  return {
    id: 'edge-1',
    source: 'source',
    target: 'target',
    sourceX: 1,
    sourceY: 2,
    targetX: 101,
    targetY: 102,
    sourcePosition: 'right',
    targetPosition: 'left',
    style: { stroke: 'red' },
    markerStart: 'start',
    markerEnd: 'end',
    data,
    ...overrides,
  } as never;
}

function pointerEvent(overrides: Record<string, unknown> = {}) {
  return {
    clientX: 10,
    clientY: 20,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as never;
}

describe('useRightsLabelEdgeController', () => {
  const getInternalNode = vi.fn();
  const screenToFlowPosition = vi.fn(({ x, y }) => ({ x: x + 100, y: y + 200 }));
  const onEdgeClick = vi.fn();

  beforeEach(() => {
    useReactFlowMock.mockReset();
    getSmoothStepPathMock.mockReset();
    useEdgeClickContextMock.mockReset();
    resolveInnerAutoEdgeAnchorsMock.mockReset();
    getInternalNode.mockReset();
    screenToFlowPosition.mockClear();
    onEdgeClick.mockReset();
    useReactFlowMock.mockReturnValue({ getInternalNode, screenToFlowPosition });
    useEdgeClickContextMock.mockReturnValue(onEdgeClick);
    getSmoothStepPathMock.mockImplementation(({ sourceX, sourceY, targetX, targetY }) => [
      `M${sourceX},${sourceY}L${targetX},${targetY}`,
      (sourceX + targetX) / 2,
      (sourceY + targetY) / 2,
    ]);
    resolveInnerAutoEdgeAnchorsMock.mockReturnValue({
      sourceX: 11,
      sourceY: 12,
      targetX: 21,
      targetY: 22,
      sourcePosition: 'bottom',
      targetPosition: 'top',
    });
  });

  it('derives default, filtered-right, and resolved inner-anchor state', () => {
    const { result, rerender } = renderHook(({ props }) => useRightsLabelEdgeController(props), {
      initialProps: { props: edgeProps() },
    });
    expect(result.current.bendPoints).toEqual([]);
    expect(result.current.edgeEditingEnabled).toBe(false);
    expect(result.current.displayRights).toEqual([]);
    expect(result.current.rightRelationshipKinds).toEqual({});
    expect(result.current.resolvedEdgeEndpoints).toMatchObject({ sourceX: 1, targetX: 101 });
    expect(result.current.edgeSegments).toHaveLength(1);
    expect(result.current.middleSegment).not.toBeNull();
    expect(result.current.openRelationshipDetailsLabel).toBe('Open relationship details');
    expect(getInternalNode).not.toHaveBeenCalled();

    rerender({
      props: edgeProps({
        visibleRights: ['amendmentRight'],
        rights: ['informationRight'],
        rightRelationshipKinds: { amendmentRight: 'active' },
      }),
    });
    expect(result.current.displayRights).toEqual(['amendmentRight']);
    expect(result.current.rightRelationshipKinds).toEqual({ amendmentRight: 'active' });

    rerender({ props: edgeProps({ visibleRights: null, rights: ['informationRight'] }) });
    expect(result.current.displayRights).toEqual(['informationRight']);
    rerender({ props: edgeProps({ visibleRights: null, rights: null }) });
    expect(result.current.displayRights).toEqual([]);

    getInternalNode.mockReturnValue(undefined);
    rerender({ props: edgeProps({ anchorStrategy: 'inner-auto' }, { sourceX: 2 }) });
    expect(result.current.resolvedEdgeEndpoints.sourceX).toBe(2);

    getInternalNode.mockImplementation((id: string) =>
      id === 'source'
        ? {
            measured: { width: 100, height: 50 },
            internals: { positionAbsolute: { x: 5, y: 6 } },
          }
        : {
            measured: {},
            width: 80,
            height: 40,
            internals: { positionAbsolute: { x: 30, y: 40 } },
          }
    );
    rerender({
      props: edgeProps({ anchorStrategy: 'outer', useInnerVerticalAnchors: true }, { sourceX: 3 }),
    });
    expect(resolveInnerAutoEdgeAnchorsMock).toHaveBeenCalledWith({
      sourceRect: { x: 5, y: 6, width: 100, height: 50 },
      targetRect: { x: 30, y: 40, width: 80, height: 40 },
    });
    expect(result.current.resolvedEdgeEndpoints.sourceX).toBe(11);
  });

  it('moves existing bend points and inserts and updates segment bend points', () => {
    const onBendPointsChange = vi.fn();
    const data = {
      bendPoints: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      edgeEditingEnabled: true,
      onBendPointsChange,
    };
    const { result, rerender } = renderHook(({ props }) => useRightsLabelEdgeController(props), {
      initialProps: { props: edgeProps(data) },
    });

    act(() =>
      result.current.setDragState({
        kind: 'bend-point',
        bendPointIndex: 0,
        startClientX: 10,
        startClientY: 10,
        isActive: false,
      })
    );
    act(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 12, clientY: 11 })));
    expect(onBendPointsChange).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20 })));
    expect(onBendPointsChange).toHaveBeenLastCalledWith('edge-1', [
      { x: 120, y: 220 },
      { x: 20, y: 20 },
    ]);
    act(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 21, clientY: 22 })));
    act(() => window.dispatchEvent(new MouseEvent('mouseup')));
    expect(result.current.dragState).toBeNull();

    act(() =>
      result.current.setDragState({
        kind: 'segment',
        segmentIndex: 1,
        startClientX: 0,
        startClientY: 0,
        insertedBendPointIndex: null,
      })
    );
    act(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1, clientY: 1 })));
    const callsBeforeInsert = onBendPointsChange.mock.calls.length;
    act(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 })));
    expect(onBendPointsChange.mock.calls.length).toBe(callsBeforeInsert + 1);
    expect(onBendPointsChange).toHaveBeenLastCalledWith('edge-1', [
      { x: 10, y: 10 },
      { x: 110, y: 210 },
      { x: 20, y: 20 },
    ]);
    act(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 11, clientY: 12 })));
    act(() => window.dispatchEvent(new MouseEvent('mouseup')));

    rerender({ props: edgeProps({ ...data, onBendPointsChange: undefined }) });
    act(() =>
      result.current.setDragState({
        kind: 'bend-point',
        bendPointIndex: 0,
        startClientX: 0,
        startClientY: 0,
        isActive: true,
      })
    );
    const callsWithoutHandler = onBendPointsChange.mock.calls.length;
    act(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20 })));
    expect(onBendPointsChange).toHaveBeenCalledTimes(callsWithoutHandler);
  });

  it('opens untouched segments on mouseup and suppresses clicks after editing', () => {
    const { result, rerender } = renderHook(({ props }) => useRightsLabelEdgeController(props), {
      initialProps: { props: edgeProps({ edgeEditingEnabled: true, bendPoints: [] }) },
    });
    act(() =>
      result.current.setDragState({
        kind: 'segment',
        segmentIndex: 0,
        startClientX: 0,
        startClientY: 0,
        insertedBendPointIndex: null,
      })
    );
    act(() => window.dispatchEvent(new MouseEvent('mouseup')));
    expect(onEdgeClick).toHaveBeenCalledWith('edge-1');

    result.current.suppressLabelClickRef.current = true;
    const labelEvent = pointerEvent();
    act(() => result.current.handleLabelClick(labelEvent));
    expect(result.current.suppressLabelClickRef.current).toBe(false);
    expect(onEdgeClick).toHaveBeenCalledTimes(1);
    act(() => result.current.handleLabelClick(labelEvent));
    expect(onEdgeClick).toHaveBeenCalledTimes(2);

    useEdgeClickContextMock.mockReturnValue(null);
    rerender({ props: edgeProps({ edgeEditingEnabled: true }, { sourceX: 4 }) });
    act(() => result.current.handleLabelClick(pointerEvent()));
    act(() =>
      result.current.setDragState({
        kind: 'segment',
        segmentIndex: 0,
        startClientX: 0,
        startClientY: 0,
        insertedBendPointIndex: null,
      })
    );
    act(() => window.dispatchEvent(new MouseEvent('mouseup')));
  });

  it('removes and nudges bend points from pointer and keyboard controls', () => {
    const onBendPointsChange = vi.fn();
    const { result, rerender } = renderHook(({ props }) => useRightsLabelEdgeController(props), {
      initialProps: {
        props: edgeProps({
          edgeEditingEnabled: false,
          bendPoints: [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
          ],
          onBendPointsChange,
        }),
      },
    });

    act(() => result.current.removeBendPoint(0));
    expect(onBendPointsChange).toHaveBeenLastCalledWith('edge-1', [{ x: 30, y: 40 }]);
    act(() => result.current.nudgeBendPoint(99, 1, 1));
    const callsBeforeKeys = onBendPointsChange.mock.calls.length;

    for (const [key, shiftKey] of [
      ['ArrowLeft', false],
      ['ArrowRight', true],
      ['ArrowUp', false],
      ['ArrowDown', true],
      ['Backspace', false],
      ['Delete', false],
      ['Enter', false],
    ] as const) {
      act(() =>
        result.current.handleBendPointKeyDown(
          {
            key,
            shiftKey,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
          } as never,
          0
        )
      );
    }
    expect(onBendPointsChange.mock.calls.length).toBeGreaterThan(callsBeforeKeys);

    const lockedEvent = pointerEvent();
    act(() => result.current.startSegmentDrag(lockedEvent, 0));
    act(() => result.current.startSegmentDrag(lockedEvent, 0, true));
    expect(onEdgeClick).toHaveBeenCalledWith('edge-1');

    rerender({
      props: edgeProps({
        edgeEditingEnabled: true,
        bendPoints: [],
        onBendPointsChange: undefined,
      }),
    });
    act(() => {
      result.current.removeBendPoint(0);
      result.current.nudgeBendPoint(0, 1, 1);
      result.current.startSegmentDrag(pointerEvent({ clientX: 7, clientY: 8 }), 0);
    });
    expect(result.current.dragState).toMatchObject({
      kind: 'segment',
      startClientX: 7,
      startClientY: 8,
    });
    expect(result.current.isDragging).toBe(true);
  });
});
