import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/features/shared/utils/utils';
import './GraphEdgeControls.css';

function edgeTransform(x: number, y: number) {
  return `translate(-50%, -50%) translate(${x}px,${y}px)`;
}

export function GraphEdgeLabel({
  x,
  y,
  children,
  className,
}: {
  x: number;
  y: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('sharedEdgeLabel nodrag nopan', className)}
      style={{ transform: edgeTransform(x, y) }}
    >
      {children}
    </div>
  );
}

export function GraphEdgeLabelButton({
  x,
  y,
  children,
  className,
  interaction = 'click',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  x: number;
  y: number;
  children: ReactNode;
  interaction?: 'click' | 'drag';
}) {
  return (
    <button
      type="button"
      className={cn(
        'sharedEdgeLabelButton nodrag nopan',
        interaction === 'drag' ? 'cursor-grab' : 'cursor-pointer',
        className
      )}
      style={{ transform: edgeTransform(x, y) }}
      {...props}
    >
      {children}
    </button>
  );
}

export function GraphEdgeLabelSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border/60 bg-background/95 flex flex-wrap gap-0.5 rounded-md border px-1.5 py-1 shadow-sm backdrop-blur-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

export function GraphPositionHandleContainer({
  x,
  y,
  active,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  x: number;
  y: number;
  active?: boolean;
}) {
  return (
    <div
      className={cn('sharedEdgeOverlay nopan', className)}
      style={{ transform: edgeTransform(x, y) }}
    >
      <div className={cn('sharedEdgeBendPointEventContainer', active && 'is-active')} {...props}>
        {children}
      </div>
    </div>
  );
}

export function GraphPositionHandle({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn('sharedEdgePositionHandle', active && 'is-active', className)}
      {...props}
    />
  );
}

export function GraphBendPointContainer({
  x,
  y,
  children,
  className,
}: {
  x: number;
  y: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('sharedEdgeBendPointContainer nodrag nopan', className)}
      style={{ transform: edgeTransform(x, y) }}
    >
      {children}
    </div>
  );
}

export function GraphBendPointButton({
  dragging,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  dragging?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn('sharedEdgeBendPointHandle', dragging && 'is-dragging', className)}
      {...props}
    />
  );
}

export function GraphBendPointDeleteButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn('sharedEdgeBendPointDeleteButton', className)} {...props}>
      {children ?? <X className="h-3 w-3" />}
    </button>
  );
}

export function getGraphEdgeDragPathClassName(editable: boolean, isDragging: boolean) {
  return cn(
    'react-flow__edge-interaction',
    editable && 'sharedEdgeDragPath',
    editable && isDragging && 'is-dragging'
  );
}
