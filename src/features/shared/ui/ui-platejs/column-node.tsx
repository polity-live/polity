import * as React from 'react';

import type { TColumnElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import { useDraggable, useDropLine } from '@platejs/dnd';
import { ResizableProvider } from '@platejs/resizable';
import { BlockSelectionPlugin } from '@platejs/selection/react';
import { useComposedRef } from '@udecode/cn';
import { GripHorizontal } from 'lucide-react';
import { PathApi } from 'platejs';
import { useTranslation } from 'react-i18next';
import { PlateElement, usePluginOption, useReadOnly, withHOC } from 'platejs/react';

import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/features/shared/ui/ui/tooltip.tsx';
import { cn } from '@/features/shared/utils/utils.ts';

export const ColumnElement = withHOC(
  ResizableProvider,
  function ColumnElement(props: PlateElementProps<TColumnElement>) {
    const { width } = props.element;
    const readOnly = useReadOnly();
    const isSelectionAreaVisible = usePluginOption(BlockSelectionPlugin, 'isSelectionAreaVisible');

    const { isDragging, previewRef, handleRef } = useDraggable({
      element: props.element,
      orientation: 'horizontal',
      type: 'column',
      canDropNode: ({ dragEntry, dropEntry }) =>
        PathApi.equals(PathApi.parent(dragEntry[1]), PathApi.parent(dropEntry[1])),
    });

    return (
      <div className="group/column relative" style={{ width: width ?? '100%' }}>
        {!readOnly && !isSelectionAreaVisible && (
          <div
            ref={handleRef}
            className={cn(
              'absolute top-2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
              'pointer-events-auto flex items-center',
              'opacity-0 transition-opacity group-hover/column:opacity-100'
            )}
          >
            <ColumnDragHandle />
          </div>
        )}

        <PlateElement
          {...props}
          ref={useComposedRef(props.ref, previewRef)}
          className="h-full px-2 pt-2 group-first/column:pl-0 group-last/column:pr-0"
        >
          <div
            className={cn(
              'relative h-full border border-transparent p-1.5',
              !readOnly && 'border-border rounded-lg border-dashed',
              isDragging && 'opacity-50'
            )}
          >
            {props.children}

            {!readOnly && !isSelectionAreaVisible && <DropLine />}
          </div>
        </PlateElement>
      </div>
    );
  }
);

const ColumnDragHandle = React.memo(function ColumnDragHandle() {
  const { t } = useTranslation();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" className="h-5 !px-1">
            <GripHorizontal
              className="text-muted-foreground"
              onClick={event => {
                event.stopPropagation();
                event.preventDefault();
              }}
            />
          </Button>
        </TooltipTrigger>

        <TooltipContent>{t('columnElement.dragToMove')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

function DropLine() {
  const { dropLine } = useDropLine({ orientation: 'horizontal' });

  if (!dropLine) return null;

  return (
    <div
      className={cn(
        'slate-dropLine',
        'bg-brand/50 absolute',
        dropLine === 'left' && 'inset-y-0 left-[-10.5px] w-1 group-first/column:-left-1',
        dropLine === 'right' && 'inset-y-0 right-[-11px] w-1 group-last/column:-right-1'
      )}
    />
  );
}
import { ColumnGroupElementView } from './ColumnGroupElementView';
export function ColumnGroupElement(props: PlateElementProps) {
  return <ColumnGroupElementView props={props} />;
}
