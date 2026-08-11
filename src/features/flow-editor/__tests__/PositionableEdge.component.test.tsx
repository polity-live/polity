/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flow = vi.hoisted(() => ({
  edges: [] as Record<string, any>[],
  setEdges: vi.fn(),
  getBezierPath: vi.fn(() => ['bezier', 10, 11]),
  getSmoothStepPath: vi.fn(() => ['smooth', 20, 21]),
  getStraightPath: vi.fn(() => ['straight', 30, 31]),
}));
const view = vi.hoisted(() => ({ props: undefined as undefined | Record<string, any> }));

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ setEdges: flow.setEdges }),
  getBezierPath: flow.getBezierPath,
  getSmoothStepPath: flow.getSmoothStepPath,
  getStraightPath: flow.getStraightPath,
}));
vi.mock('../PositionableEdgeView', () => ({
  PositionableEdgeView: (props: Record<string, any>) => {
    view.props = props;
    return <output>{props.type}</output>;
  },
}));

import PositionableEdge from '../PositionableEdge';

const baseProps = {
  id: 'edge-1',
  source: 'a',
  target: 'b',
  sourceX: 0,
  sourceY: 1,
  targetX: 100,
  targetY: 101,
  sourcePosition: 'right',
  targetPosition: 'left',
  selected: false,
  animated: false,
  deletable: true,
  selectable: true,
  draggable: true,
  data: { positionHandlers: [{ x: 30, y: 40, active: false }], type: 'straight' },
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  flow.edges = [
    { id: 'other', data: { positionHandlers: [{ x: 1, y: 1, active: true }] } },
    { id: 'edge-1', data: { positionHandlers: [{ x: 30, y: 40, active: false }] } },
    { id: 'without-handlers', data: {} },
  ];
  flow.setEdges.mockImplementation(updater => {
    flow.edges = updater(flow.edges);
  });
});

describe('positionable edge controller', () => {
  it('selects path algorithms and builds one segment around every bend point', () => {
    const { rerender } = render(<PositionableEdge {...(baseProps as any)} />);
    expect(flow.getStraightPath).toHaveBeenCalledTimes(2);
    expect(view.props?.edgeSegmentsArray).toEqual([
      { edgePath: 'straight', labelX: 30, labelY: 31 },
      { edgePath: 'straight', labelX: 30, labelY: 31 },
    ]);
    expect(view.props?.middleSegmentIndex).toBe(1);

    rerender(
      <PositionableEdge
        {...(baseProps as any)}
        data={{ positionHandlers: [], type: 'smoothstep' }}
      />
    );
    expect(flow.getSmoothStepPath).toHaveBeenCalledTimes(1);
    rerender(
      <PositionableEdge {...(baseProps as any)} data={{ positionHandlers: [], type: 'default' }} />
    );
    expect(flow.getBezierPath).toHaveBeenCalledTimes(1);
    rerender(<PositionableEdge {...(baseProps as any)} data={undefined} />);
    expect(view.props?.positionHandlers).toEqual([]);
    expect(view.props?.type).toBe('default');
  });

  it('updates only the target edge for insert, active, move, delta, remove, and clear operations', () => {
    render(<PositionableEdge {...(baseProps as any)} />);
    const props = view.props!;

    props.insertPositionHandler(1, { x: 50, y: 60, active: false });
    expect(flow.edges[1].data.positionHandlers).toHaveLength(2);
    props.setPositionHandlerActive(0, true);
    expect(flow.edges[1].data.positionHandlers[0].active).toBe(true);
    props.movePositionHandlerTo(0, 70, 80);
    expect(flow.edges[1].data.positionHandlers[0]).toMatchObject({ x: 70, y: 80 });
    props.movePositionHandlerBy(0, -8, 20);
    expect(flow.edges[1].data.positionHandlers[0]).toMatchObject({ x: 62, y: 100 });
    props.removePositionHandler(1);
    expect(flow.edges[1].data.positionHandlers).toHaveLength(1);
    flow.edges[1] = { id: 'edge-1', data: {} };
    props.insertPositionHandler(0, { x: 9, y: 9, active: false });
    expect(flow.edges[1].data.positionHandlers).toEqual([{ x: 9, y: 9, active: false }]);
    props.clearActivePositionHandlers();
    expect(flow.edges[0].data.positionHandlers[0].active).toBe(false);
    expect(flow.edges[1].data.positionHandlers[0].active).toBe(false);
    expect(flow.edges[2]).toEqual({ id: 'without-handlers', data: {} });
  });

  it('maps keyboard movement, shifted movement, deletion, and unrelated keys deterministically', () => {
    render(<PositionableEdge {...(baseProps as any)} />);
    const props = view.props!;
    const event = (key: string, shiftKey = false) => ({
      key,
      shiftKey,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });

    props.handlePositionHandlerKeyDown(event('ArrowLeft'), 0);
    expect(flow.edges[1].data.positionHandlers[0].x).toBe(22);
    props.handlePositionHandlerKeyDown(event('ArrowRight', true), 0);
    expect(flow.edges[1].data.positionHandlers[0].x).toBe(42);
    props.handlePositionHandlerKeyDown(event('ArrowUp'), 0);
    expect(flow.edges[1].data.positionHandlers[0].y).toBe(32);
    props.handlePositionHandlerKeyDown(event('ArrowDown', true), 0);
    expect(flow.edges[1].data.positionHandlers[0].y).toBe(52);
    props.handlePositionHandlerKeyDown(event('Escape'), 0);
    expect(flow.edges[1].data.positionHandlers).toHaveLength(1);
    props.handlePositionHandlerKeyDown(event('Backspace'), 0);
    expect(flow.edges[1].data.positionHandlers).toHaveLength(0);

    flow.edges[1].data.positionHandlers = [{ x: 1, y: 1, active: false }];
    props.handlePositionHandlerKeyDown(event('Delete'), 0);
    expect(flow.edges[1].data.positionHandlers).toHaveLength(0);
  });
});
