/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@xyflow/react', () => ({
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/graph', () => ({
  GraphEdgeLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  GraphPositionHandleContainer: ({
    children,
    onMouseMove,
    onMouseUp,
  }: {
    children: React.ReactNode;
    onMouseMove: React.MouseEventHandler;
    onMouseUp: React.MouseEventHandler;
  }) => (
    <div data-testid="handle-container" onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      {children}
    </div>
  ),
  GraphPositionHandle: ({
    active: _active,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) => (
    <button type="button" {...props} />
  ),
}));

import ClickableBaseEdge from '../ClickableBaseEdge';
import { PositionableEdgeView } from '../PositionableEdgeView';

afterEach(cleanup);

describe('positionable edge view', () => {
  it('renders styled visual and optional interaction paths and dispatches pointer actions', () => {
    const onClick = vi.fn();
    const onDoubleClick = vi.fn();
    const { container, rerender } = render(
      <svg>
        <ClickableBaseEdge
          id="edge-1"
          path="M 0 0 L 10 10"
          markerStart="start"
          markerEnd="end"
          style={{ stroke: 'red' }}
          interactionWidth={24}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
        />
      </svg>
    );
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute('marker-start')).toBe('start');
    expect(paths[1].getAttribute('stroke-width')).toBe('24');
    expect(paths[1].getAttribute('data-action-id')).toBe('flow-editor.edge-path.insert-bend');
    expect(paths[1].getAttribute('tabindex')).toBe('0');
    fireEvent.click(paths[1]);
    fireEvent.doubleClick(paths[1]);
    fireEvent.keyDown(paths[1], { key: 'Enter' });
    fireEvent.keyDown(paths[1], { key: ' ' });
    fireEvent.keyDown(paths[1], { key: 'Escape' });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDoubleClick).toHaveBeenCalledTimes(3);

    rerender(
      <svg>
        <ClickableBaseEdge
          id="edge-1"
          path="M 0 0 L 10 10"
          interactionWidth={24}
          onClick={onClick}
        />
      </svg>
    );
    fireEvent.keyDown(container.querySelector('.react-flow__edge-interaction')!, {
      key: 'Enter',
    });
    expect(onClick).toHaveBeenCalledTimes(2);

    rerender(
      <svg>
        <ClickableBaseEdge id="edge-1" path="M 0 0 L 10 10" interactionWidth={0} />
      </svg>
    );
    expect(container.querySelectorAll('path')).toHaveLength(1);
  });

  it('routes segment insertion, dragging, activation, keyboard, removal, and labels', () => {
    const actions = {
      insertPositionHandler: vi.fn(),
      setPositionHandlerActive: vi.fn(),
      movePositionHandlerTo: vi.fn(),
      removePositionHandler: vi.fn(),
      clearActivePositionHandlers: vi.fn(),
      handlePositionHandlerKeyDown: vi.fn(),
    };
    const reactFlowInstance = {
      screenToFlowPosition: vi.fn(({ x, y }) => ({ x: x + 1, y: y + 2 })),
    };
    const props = {
      id: '1',
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      sourcePosition: 'left',
      targetPosition: 'right',
      style: {},
      markerEnd: 'arrow',
      data: {},
      label: 'Decision path',
      reactFlowInstance,
      positionHandlers: [
        { x: 20, y: 30, active: true },
        { x: 40, y: 50, active: false },
      ],
      type: 'straight',
      edgeSegmentsCount: 2,
      edgeSegmentsArray: [
        { edgePath: 'M0', labelX: 10, labelY: 10 },
        { edgePath: 'M1', labelX: 20, labelY: 20 },
      ],
      pathFunction: vi.fn(),
      middleSegmentIndex: 1,
      labelX: 20,
      labelY: 20,
      updatePositionHandlers: vi.fn(),
      movePositionHandlerBy: vi.fn(),
      ...actions,
    };
    const { container } = render(
      <svg>
        <PositionableEdgeView {...props} />
      </svg>
    );

    const interactions = container.querySelectorAll('.react-flow__edge-interaction');
    fireEvent.doubleClick(interactions[0], { clientX: 7, clientY: 9 });
    expect(actions.insertPositionHandler).toHaveBeenCalledWith(0, {
      x: 8,
      y: 11,
      active: false,
    });
    expect(screen.getByText('Decision path')).toBeTruthy();

    const handles = screen.getAllByRole('button', {
      name: 'common.accessibility.moveEdgeBendPoint',
    });
    fireEvent.mouseDown(handles[0]);
    fireEvent.mouseMove(screen.getAllByTestId('handle-container')[0], { clientX: 4, clientY: 5 });
    fireEvent.mouseMove(screen.getAllByTestId('handle-container')[1], { clientX: 99, clientY: 99 });
    fireEvent.mouseUp(screen.getAllByTestId('handle-container')[0]);
    fireEvent.contextMenu(handles[0]);
    fireEvent.keyDown(handles[0], { key: 'ArrowRight' });
    expect(actions.setPositionHandlerActive).toHaveBeenCalledWith(0, true);
    expect(actions.movePositionHandlerTo).toHaveBeenCalledWith(0, 5, 7);
    expect(actions.clearActivePositionHandlers).toHaveBeenCalledTimes(1);
    expect(actions.removePositionHandler).toHaveBeenCalledWith(0);
    expect(actions.handlePositionHandlerKeyDown).toHaveBeenCalledWith(expect.anything(), 0);
  });
});
