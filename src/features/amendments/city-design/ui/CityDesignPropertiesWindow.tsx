import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

/** A canvas-relative inspector: selecting another element keeps its position. */
export function CityDesignPropertiesWindow({
  selectionKey,
  canvasSize,
  onClose,
  children,
}: {
  selectionKey: string | null;
  canvasSize: { width: number; height: number } | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`features.amendments.cityDesign.inspector.${key}`);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [collapsedSelection, setCollapsedSelection] = useState<string | null>(null);
  const collapsed = collapsedSelection === selectionKey;
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
  } | null>(null);
  const bodyId = useId();
  const clampPosition = useCallback(
    (x: number, y: number) => {
      if (!canvasSize) return { x, y };
      const width =
        panel.current?.offsetWidth || Math.min(collapsed ? 224 : 352, canvasSize.width - 32);
      return {
        x: Math.max(0, Math.min(x, canvasSize.width - width)),
        y: Math.max(0, Math.min(y, canvasSize.height - 44)),
      };
    },
    [canvasSize, collapsed]
  );
  useEffect(() => {
    setCollapsedSelection(null);
  }, [selectionKey]);
  useEffect(() => {
    setPosition(current => {
      const next = clampPosition(current.x, current.y);
      return next.x === current.x && next.y === current.y ? current : next;
    });
  }, [clampPosition, selectionKey]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      setPosition(
        clampPosition(
          current.x + event.clientX - current.clientX,
          current.y + event.clientY - current.clientY
        )
      );
    };
    const end = () => {
      drag.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', end);
    };
  }, [clampPosition]);

  if (!selectionKey) return null;
  const anchor = clampPosition(position.x, position.y);
  const opensUp = !!canvasSize && anchor.y + 22 > canvasSize.height / 2;
  const room = canvasSize
    ? opensUp
      ? anchor.y + 44 - 16
      : canvasSize.height - anchor.y - 16
    : 400;

  return (
    <aside
      ref={panel}
      data-slot="city-design-properties"
      data-canvas-focus-occluder
      data-collapsed={collapsed}
      aria-label={tr('title')}
      className="bg-popover/95 text-popover-foreground pointer-events-auto absolute z-30 flex max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border text-sm shadow-xl backdrop-blur-md"
      style={{
        left: anchor.x,
        top: anchor.y,
        width: collapsed ? '14rem' : '22rem',
        maxHeight: `min(50dvh, ${Math.max(44, room)}px)`,
        ...(opensUp
          ? { flexDirection: 'column-reverse', transform: 'translateY(calc(-100% + 2.75rem))' }
          : {}),
      }}
      onPointerDown={event => event.stopPropagation()}
      onWheel={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    >
      <div className="flex min-h-11 shrink-0 items-center">
        <button
          data-action-id="amendments.city-inspector.move.window"
          data-action-kind="interaction"
          type="button"
          aria-label={tr('move')}
          className="focus-visible:ring-ring flex min-h-11 min-w-0 flex-1 cursor-grab touch-none items-center gap-2 px-3.5 text-left font-semibold select-none focus-visible:ring-2 active:cursor-grabbing"
          onPointerDown={event => {
            if (event.button !== 0) return;
            drag.current = {
              pointerId: event.pointerId,
              clientX: event.clientX,
              clientY: event.clientY,
              ...anchor,
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onKeyDown={event => {
            const direction: Record<string, [number, number]> = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            };
            const delta = direction[event.key];
            if (!delta) return;
            event.preventDefault();
            const step = event.shiftKey ? 20 : 10;
            setPosition(clampPosition(anchor.x + delta[0] * step, anchor.y + delta[1] * step));
          }}
        >
          <GripVertical className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{tr('title')}</span>
        </button>
        <button
          data-action-id="amendments.city-inspector.toggle.window"
          type="button"
          aria-label={tr(collapsed ? 'expand' : 'collapse')}
          aria-controls={bodyId}
          aria-expanded={!collapsed}
          className="hover:bg-accent focus-visible:ring-ring grid size-11 shrink-0 place-items-center focus-visible:ring-2"
          onClick={() => setCollapsedSelection(collapsed ? null : selectionKey)}
        >
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
        <button
          data-action-id="amendments.city-inspector.close.window"
          type="button"
          aria-label={tr('close')}
          className="hover:bg-accent focus-visible:ring-ring grid size-11 shrink-0 place-items-center focus-visible:ring-2"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>
      <div id={bodyId} hidden={collapsed} className="min-h-0 overflow-auto p-3.5">
        {children}
      </div>
    </aside>
  );
}
