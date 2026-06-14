import * as React from 'react';

import type { VariantProps } from 'class-variance-authority';

import {
  type ResizeHandle as ResizeHandlePrimitive,
  Resizable as ResizablePrimitive,
  useResizeHandle,
  useResizeHandleState,
} from '@platejs/resizable';
import { cva } from 'class-variance-authority';

import { cn } from '@/features/shared/utils/utils.ts';

export const mediaResizeHandleVariants = cva(
  cn(
    'top-0 flex w-6 flex-col justify-center select-none',
    "after:flex after:h-16 after:w-[3px] after:rounded-[6px] after:bg-ring after:opacity-0 after:content-['_'] group-hover:after:opacity-100"
  ),
  {
    variants: {
      direction: {
        left: '-left-3 -ml-3 pl-3',
        right: '-right-3 -mr-3 items-end pr-3',
      },
    },
  }
);

const resizeHandleVariants = cva('absolute z-40', {
  variants: {
    direction: {
      bottom: 'w-full cursor-row-resize',
      left: 'h-full cursor-col-resize',
      right: 'h-full cursor-col-resize',
      top: 'w-full cursor-row-resize',
    },
  },
});

export function ResizeHandle({
  className,
  options,
  ...props
}: React.ComponentProps<typeof ResizeHandlePrimitive> & VariantProps<typeof resizeHandleVariants>) {
  const state = useResizeHandleState(options ?? {});
  const resizeHandle = useResizeHandle(state);

  if (state.readOnly) return null;

  return (
    <ResizeHandleView
      className={className}
      options={options}
      isResizing={state.isResizing}
      resizeHandleProps={resizeHandle.props}
      props={props}
    />
  );
}

interface ResizeHandleViewProps {
  className?: string;
  options: (React.ComponentProps<typeof ResizeHandlePrimitive> &
    VariantProps<typeof resizeHandleVariants>)['options'];
  isResizing: boolean;
  resizeHandleProps: React.HTMLAttributes<HTMLDivElement>;
  props: Omit<
    React.ComponentProps<typeof ResizeHandlePrimitive> & VariantProps<typeof resizeHandleVariants>,
    'className' | 'options'
  >;
}

function ResizeHandleView({
  className,
  options,
  isResizing,
  resizeHandleProps,
  props,
}: ResizeHandleViewProps) {
  return (
    <div
      className={cn(resizeHandleVariants({ direction: options?.direction }), className)}
      data-resizing={isResizing}
      {...resizeHandleProps}
      {...props}
    />
  );
}

const resizableVariants = cva('', {
  variants: {
    align: {
      center: 'mx-auto',
      left: 'mr-auto',
      right: 'ml-auto',
    },
  },
});

export function Resizable({
  align,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive> & VariantProps<typeof resizableVariants>) {
  return <ResizablePrimitive {...props} className={cn(resizableVariants({ align }), className)} />;
}
