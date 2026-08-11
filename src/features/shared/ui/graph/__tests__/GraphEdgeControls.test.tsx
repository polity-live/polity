/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getGraphEdgeDragPathClassName,
  GraphBendPointButton,
  GraphBendPointContainer,
  GraphBendPointDeleteButton,
  GraphEdgeLabel,
  GraphEdgeLabelButton,
  GraphEdgeLabelSurface,
  GraphPositionHandle,
  GraphPositionHandleContainer,
} from '../GraphEdgeControls';

afterEach(cleanup);

describe('graph edge control primitives', () => {
  it('positions labels, surfaces, and handles and preserves consumer callbacks', () => {
    const onClick = vi.fn();
    const onMove = vi.fn();
    const onPositionClick = vi.fn();
    render(
      <>
        <GraphEdgeLabel x={12} y={34} className="custom-label">
          Label
        </GraphEdgeLabel>
        <GraphEdgeLabelButton x={20} y={30} interaction="drag" onClick={onClick}>
          Move label
        </GraphEdgeLabelButton>
        <GraphEdgeLabelButton x={21} y={31}>
          Click label
        </GraphEdgeLabelButton>
        <GraphEdgeLabelSurface>Surface</GraphEdgeLabelSurface>
        <GraphPositionHandleContainer x={40} y={50} active onMouseMove={onMove}>
          <GraphPositionHandle active aria-label="Move bend" onClick={onPositionClick} />
        </GraphPositionHandleContainer>
        <GraphBendPointContainer x={60} y={70}>
          Bend
        </GraphBendPointContainer>
      </>
    );

    expect(screen.getByText('Label').getAttribute('style')).toContain('12px,34px');
    expect(screen.getByText('Label').className).toContain('custom-label');
    const labelButton = screen.getByRole('button', { name: 'Move label' });
    expect(labelButton.className).toContain('cursor-grab');
    expect(screen.getByRole('button', { name: 'Click label' }).className).toContain(
      'cursor-pointer'
    );
    fireEvent.click(labelButton);
    fireEvent.click(screen.getByRole('button', { name: 'Move bend' }));
    fireEvent.mouseMove(screen.getByRole('button', { name: 'Move bend' }).parentElement!);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onPositionClick).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Move bend' }).className).toContain('is-active');
    expect(screen.getByText('Bend').getAttribute('style')).toContain('60px,70px');
    expect(screen.getByText('Surface')).toBeTruthy();
    labelButton.focus();
    expect(document.activeElement).toBe(labelButton);
    screen.getByRole('button', { name: 'Move bend' }).focus();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move bend' }));
  });

  it('renders bend and delete states and computes editable drag-path classes', () => {
    const onDelete = vi.fn();
    const onDrag = vi.fn();
    const { rerender } = render(
      <>
        <GraphBendPointButton dragging aria-label="Drag bend" onClick={onDrag} />
        <GraphBendPointDeleteButton aria-label="Delete bend" onClick={onDelete} />
      </>
    );
    expect(screen.getByRole('button', { name: 'Drag bend' }).className).toContain('is-dragging');
    fireEvent.click(screen.getByRole('button', { name: 'Drag bend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete bend' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDrag).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Delete bend' }).querySelector('svg')).toBeTruthy();
    screen.getByRole('button', { name: 'Drag bend' }).focus();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Drag bend' }));

    rerender(
      <GraphBendPointDeleteButton aria-label="Delete bend">Remove</GraphBendPointDeleteButton>
    );
    expect(screen.getByText('Remove')).toBeTruthy();
    expect(getGraphEdgeDragPathClassName(false, false)).toBe('react-flow__edge-interaction');
    expect(getGraphEdgeDragPathClassName(true, false)).toContain('sharedEdgeDragPath');
    expect(getGraphEdgeDragPathClassName(true, true)).toContain('is-dragging');
    screen.getByRole('button', { name: 'Delete bend' }).focus();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete bend' }));
  });
});
