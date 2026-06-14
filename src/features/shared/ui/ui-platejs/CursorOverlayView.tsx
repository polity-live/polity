import { AIChatPlugin } from '@platejs/ai/react';
import { type CursorData, type CursorOverlayState } from '@platejs/selection/react';
import { RangeApi } from 'platejs';
import { usePluginOption } from 'platejs/react';

import { cn } from '@/features/shared/utils/utils.ts';

function Cursor({
  id,
  caretPosition,
  data,
  selection,
  selectionRects,
}: CursorOverlayState<CursorData>) {
  const streaming = usePluginOption(AIChatPlugin, 'streaming');
  const { style, selectionStyle = style } = data ?? ({} as CursorData);
  const isCursor = RangeApi.isCollapsed(selection);

  if (streaming) return null;

  return (
    <>
      {selectionRects.map((position: any, i: number) => {
        return (
          <div
            key={i}
            className={cn(
              'pointer-events-none absolute z-10',
              id === 'selection' && 'bg-brand/25',
              id === 'selection' && isCursor && 'bg-primary'
            )}
            style={{
              ...selectionStyle,
              ...position,
            }}
          />
        );
      })}
      {caretPosition && (
        <div
          className={cn(
            'pointer-events-none absolute z-10 w-0.5',
            id === 'drag' && 'bg-brand w-px'
          )}
          style={{ ...caretPosition, ...style }}
        />
      )}
    </>
  );
}

export interface CursorOverlayViewProps {
  cursors: any;
}

export function CursorOverlayView({ cursors }: CursorOverlayViewProps) {
  return (
    <>
      {cursors.map((cursor: any) => (
        <Cursor key={cursor.id} {...cursor} />
      ))}
    </>
  );
}
