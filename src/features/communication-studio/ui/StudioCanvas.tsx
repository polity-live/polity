import './studio-fonts.css';
import { drawStudioElement } from '../logic/draw-element';
import { canvasLayers } from '../logic/canvas-layers';
import { StudioTextEditor, type StudioTextSelectionEditor } from './StudioTextEditor';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Stage,
  Layer,
  Rect,
  Ellipse,
  Text,
  Image as CanvasImage,
  Transformer,
  Group,
} from 'react-konva';
import type Konva from 'konva';
import { formats, type StudioPage, type StudioElement } from '../logic/document';
import type { StudioAsset } from '../hooks/useStudioDocument';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mediaDrawGeometry } from '../logic/media-geometry';
function Media({
  element: e,
  url,
  playing,
  time,
}: {
  element: StudioElement;
  url?: string;
  playing: boolean;
  time: number;
}) {
  const [image, setImage] = useState<HTMLImageElement | HTMLVideoElement>();
  const node = useRef<Konva.Image>(null);
  useEffect(() => {
    if (!url) return;
    let media: HTMLImageElement | HTMLVideoElement;
    if (e.type === 'video') {
      media = document.createElement('video');
      media.crossOrigin = 'anonymous';
      media.src = url;
      media.muted = true;
      media.preload = 'auto';
      media.onloadeddata = () => {
        setImage(media);
      };
      media.onseeked = () => node.current?.getLayer()?.batchDraw();
    } else {
      media = new window.Image();
      media.crossOrigin = 'anonymous';
      media.onload = () => setImage(media);
      media.src = url;
    }
    return () => {
      if (media instanceof HTMLVideoElement) {
        media.pause();
        media.removeAttribute('src');
        media.load();
      } else media.onload = null;
    };
  }, [url, e.type]);
  useEffect(() => {
    if (!(image instanceof HTMLVideoElement)) return;
    image.muted = e.muted;
    const target = Math.min(
      e.trimStart + (playing ? time : 0),
      Math.max(0, (image.duration || 1) - 0.05)
    );
    if (!playing || Math.abs(image.currentTime - target) > 0.25) image.currentTime = target;
    if (playing && image.paused)
      void image.play().catch(() => {
        /* Browser may require another user gesture for sound. */
      });
    else if (!playing) image.pause();
    node.current?.getLayer()?.batchDraw();
  }, [image, e.trimStart, e.muted, playing, time]);
  const iw = image instanceof HTMLVideoElement ? image.videoWidth : (image?.width ?? 1),
    ih = image instanceof HTMLVideoElement ? image.videoHeight : (image?.height ?? 1),
    placement = mediaDrawGeometry(e, iw, ih);
  return (
    <Group clipX={0} clipY={0} clipWidth={e.width} clipHeight={e.height}>
      <Group
        x={e.flipX ? e.width : 0}
        y={e.flipY ? e.height : 0}
        scaleX={e.flipX ? -1 : 1}
        scaleY={e.flipY ? -1 : 1}
      >
        {image ? (
          <CanvasImage
            ref={node}
            image={image}
            width={placement.width}
            height={placement.height}
            x={placement.x}
            y={placement.y}
          />
        ) : (
          <Rect width={e.width} height={e.height} fill="#D9D7D0" />
        )}
      </Group>
    </Group>
  );
}
function ElementImage({ element }: { element: StudioElement }) {
  const [fontVersion, setFontVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!document.fonts) return;
    const families = new Set([
      element.font,
      ...element.richText.flatMap(p => p.children.map(r => r.fontFamily ?? element.font)),
    ]);
    void Promise.all(
      [...families].flatMap(f => [
        document.fonts.load(`400 40px "${f}"`),
        document.fonts.load(`700 40px "${f}"`),
        document.fonts.load(`italic 400 40px "${f}"`),
      ])
    ).then(() => {
      if (!cancelled) setFontVersion(v => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [element.font, element.richText]);
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = element.width;
    c.height = element.height;
    const ctx = c.getContext('2d');
    if (ctx) drawStudioElement(ctx, element);
    return c;
  }, [element, fontVersion]);
  return <CanvasImage image={canvas} width={element.width} height={element.height} />;
}
export interface StudioSelectionGeometry {
  left: number;
  top: number;
  right: number;
  bottom: number;
  interacting: boolean;
}
export interface CanvasProps {
  page: StudioPage;
  dimensions?: readonly [number, number];
  fit?: 'width' | 'contain';
  onGeometry?: (geometry: StudioSelectionGeometry | null) => void;
  registerTextEditor?: (editor: StudioTextSelectionEditor | null) => void;
  assets: StudioAsset[];
  selected: string[];
  select: (ids: string[]) => void;
  patch: (id: string, patch: Partial<StudioElement>) => void;
  move?: (id: string, patch: Partial<StudioElement>) => void;
  transform?: (changes: { id: string; patch: Partial<StudioElement> }[]) => void;
  editable: boolean;
  peers: any[];
  cursor: (x: number, y: number) => void;
  playing?: boolean;
  time?: number;
  guides?: boolean;
}
export default function StudioCanvas({
  page,
  dimensions,
  fit = 'width',
  assets,
  selected,
  select,
  patch,
  move,
  transform,
  editable,
  peers,
  cursor,
  playing = false,
  time = 0,
  guides = true,
  onGeometry,
  registerTextEditor,
}: CanvasProps) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null),
    stage = useRef<Konva.Stage>(null),
    transformer = useRef<Konva.Transformer>(null);
  const [viewport, setViewport] = useState({ width: 600, height: 600 }),
    [editing, setEditing] = useState<string | null>(null),
    [interacting, setInteracting] = useState(false);
  const geometryCallback = useRef(onGeometry);
  geometryCallback.current = onGeometry;
  const [w, h] = dimensions ?? formats[page.format];
  const layers = canvasLayers(page);
  const [nativeDrawings, setNativeDrawings] = useState<
    Record<number, { image: HTMLImageElement; x: number; y: number; width: number; height: number }>
  >({});
  useEffect(() => {
    let cancelled = false;
    if (!page.canvas?.elements.length) {
      setNativeDrawings({});
      return;
    }
    void import('@excalidraw/excalidraw')
      .then(async sdk => {
        const drawings: typeof nativeDrawings = {};
        for (const [index, layer] of layers.entries()) {
          if (layer.kind !== 'native') continue;
          const elements = sdk
            .restoreElements(layer.elements as never, null)
            .filter(e => !e.isDeleted);
          if (!elements.length) continue;
          const [x, y, right, bottom] = sdk.getCommonBounds(elements);
          const svg = await sdk.exportToSvg({
            elements,
            files: page.canvas?.files as never,
            exportPadding: 0,
            appState: { exportBackground: false, exportWithDarkMode: false },
          });
          const image = new Image();
          image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML);
          await image.decode();
          drawings[index] = { image, x, y, width: right - x, height: bottom - y };
        }
        if (!cancelled) setNativeDrawings(drawings);
      })
      .catch(() => {
        if (!cancelled) setNativeDrawings({});
      });
    return () => {
      cancelled = true;
    };
  }, [page.canvas, page.elements]);
  const scale =
    fit === 'contain'
      ? Math.max(
          0.01,
          Math.min(Math.max(1, viewport.width - 32) / w, Math.max(1, viewport.height - 32) / h, 1)
        )
      : Math.min(viewport.width / w, 0.85);
  const report = useCallback(() => {
    const node = stage.current?.findOne('#' + selected[0]);
    const bounds = stage.current?.container().getBoundingClientRect();
    if (!node || !bounds) {
      geometryCallback.current?.(null);
      return;
    }
    const b = node.getClientRect();
    geometryCallback.current?.({
      left: bounds.left + b.x,
      top: bounds.top + b.y,
      right: bounds.left + b.x + b.width,
      bottom: bounds.top + b.y + b.height,
      interacting,
    });
  }, [selected, page, scale, interacting]);
  useEffect(() => {
    report();
    window.addEventListener('scroll', report, true);
    window.addEventListener('resize', report);
    return () => {
      window.removeEventListener('scroll', report, true);
      window.removeEventListener('resize', report);
    };
  }, [report]);
  useEffect(() => {
    if (playing || !selected.includes(editing ?? '') || !page.elements.some(e => e.id === editing))
      setEditing(null);
  }, [selected, page.id, playing, page.elements]);
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setViewport({
        width: Math.max(200, width),
        height: Math.max(1, height || host.current?.clientHeight || 600),
      });
    });
    observer.observe(host.current as HTMLDivElement);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    transformer.current?.nodes(
      selected
        .filter(id => !page.elements.find(e => e.id === id)?.locked)
        .map(id => stage.current?.findOne('#' + id))
        .filter(Boolean) as Konva.Node[]
    );
  }, [selected, page.id, page.elements]);
  return (
    <div
      ref={host}
      className={
        fit === 'contain'
          ? 'relative flex h-full w-full min-w-0 flex-col items-center justify-center overflow-hidden p-4'
          : 'relative flex w-full min-w-0 flex-col items-center overflow-auto p-2'
      }
      data-testid="studio-canvas"
      data-canvas-fit={fit}
      data-canvas-width={w}
      data-canvas-height={h}
    >
      <Stage
        ref={stage}
        width={w * scale}
        height={h * scale}
        scaleX={scale}
        scaleY={scale}
        onPointerDown={e => {
          if (e.target === e.target.getStage()) select([]);
        }}
        onPointerMove={() => {
          const p = stage.current?.getPointerPosition();
          if (p) cursor(p.x / scale, p.y / scale);
        }}
      >
        <Layer>
          <Rect width={w} height={h} fill={page.background} onClick={() => select([])} />
          {layers.map((layer, index) => {
            if (layer.kind === 'native')
              return nativeDrawings[index] ? (
                <CanvasImage key={`native-${index}`} {...nativeDrawings[index]} listening={false} />
              ) : null;
            const e = layer.element;
            return (
              <Group
                key={e.id}
                id={e.id}
                x={e.x}
                y={e.y}
                rotation={e.rotation}
                opacity={
                  e.opacity * (playing && e.animation === 'fade' ? Math.min(1, time / 0.4) : 1)
                }
                width={e.width}
                height={e.height}
                draggable={editable && !e.locked && !playing}
                onClick={event =>
                  select(event.evt.shiftKey ? [...new Set([...selected, e.id])] : [e.id])
                }
                onTap={() => select([e.id])}
                onDragStart={() => {
                  setInteracting(true);
                  setEditing(null);
                }}
                onTransformStart={() => {
                  setInteracting(true);
                  setEditing(null);
                }}
                onDblClick={() => {
                  if (e.type === 'text' && editable && !e.locked) setEditing(e.id);
                }}
                onDblTap={() => {
                  if (e.type === 'text' && editable && !e.locked) setEditing(e.id);
                }}
                onDragEnd={event => {
                  setInteracting(false);
                  const node = event.target;
                  (move ?? patch)(e.id, {
                    x: Math.round(node.x() / 5) * 5,
                    y: Math.round(node.y() / 5) * 5,
                  });
                }}
                onTransformEnd={event => {
                  if (transform) return;
                  setInteracting(false);
                  const n = event.target;
                  patch(e.id, {
                    x: n.x(),
                    y: n.y(),
                    width: Math.max(4, e.width * n.scaleX()),
                    height: Math.max(4, e.height * n.scaleY()),
                    rotation: n.rotation(),
                  });
                  n.scaleX(1);
                  n.scaleY(1);
                }}
              >
                {!['image', 'video'].includes(e.type) ? (
                  <ElementImage element={e} />
                ) : (
                  <Media
                    element={e}
                    url={assets.find(a => a.id === e.assetId)?.url}
                    playing={playing}
                    time={time}
                  />
                )}
              </Group>
            );
          })}
          {playing && page.transition === 'fade' && (
            <Rect
              width={w}
              height={h}
              fill="#000000"
              opacity={
                1 - Math.min(1, Math.max(0, time / 0.3), Math.max(0, (page.duration - time) / 0.3))
              }
              listening={false}
            />
          )}
          {guides && !playing && (
            <Rect
              x={60}
              y={page.format === 'story' ? 220 : 60}
              width={w - 120}
              height={h - (page.format === 'story' ? 480 : 120)}
              stroke="#B88A3B"
              dash={[12, 12]}
              strokeWidth={2}
              listening={false}
            />
          )}
          {editable && !playing && (
            <Transformer
              ref={transformer}
              onTransformEnd={() => {
                if (!transform) return;
                const changes = (transformer.current?.nodes() ?? []).flatMap(n => {
                  const e = page.elements.find(e => e.id === n.id());
                  if (!e || e.locked) return [];
                  const patch = {
                    x: n.x(),
                    y: n.y(),
                    width: Math.max(4, e.width * n.scaleX()),
                    height: Math.max(4, e.height * n.scaleY()),
                    rotation: n.rotation(),
                  };
                  n.scaleX(1);
                  n.scaleY(1);
                  return [{ id: e.id, patch }];
                });
                transform(changes);
                setInteracting(false);
              }}
              boundBoxFunc={(old, next) => (next.width < 4 || next.height < 4 ? old : next)}
              rotateEnabled
            />
          )}
          {peers
            .filter(p => p.cursor?.pageId === page.id)
            .map((p, i) => (
              <Group key={i} x={p.cursor.x} y={p.cursor.y} listening={false}>
                <Ellipse radiusX={8} radiusY={8} fill={p.user?.color || '#B88A3B'} />
                <Text text={p.user?.name || ''} x={12} fontSize={24} fill="#B88A3B" />
              </Group>
            ))}
        </Layer>
      </Stage>
      {editing &&
        !playing &&
        (() => {
          const e = page.elements.find(e => e.id === editing);
          if (!e) return null;
          return (
            <div
              onKeyDown={ev => {
                if (ev.key === 'Escape') {
                  ev.stopPropagation();
                  setEditing(null);
                }
              }}
              style={{
                position: 'absolute',
                left: (viewport.width - w * scale) / 2 + 8 + e.x * scale,
                top: 8 + e.y * scale,
                width: e.width,
                height: e.height,
                transformOrigin: '0 0',
                transform: `scale(${scale}) rotate(${e.rotation}deg)`,
                background: 'var(--background)',
                zIndex: 20,
              }}
            >
              <StudioTextEditor
                key={e.id}
                element={e}
                onChange={p => patch(e.id, p)}
                register={
                  registerTextEditor ??
                  (() => {
                    /* Optional editor bridge. */
                  })
                }
              />
            </div>
          );
        })()}
      <div className="sr-only focus-within:not-sr-only" aria-label={t('features.studio.elements')}>
        <button type="button" onClick={() => select([])}>
          {t('features.studio.clearSelection')}
        </button>
        {page.elements.map((element, index) => (
          <button
            type="button"
            key={element.id}
            aria-pressed={selected.includes(element.id)}
            onClick={event =>
              select(event.shiftKey ? [...new Set([...selected, element.id])] : [element.id])
            }
            onKeyDown={event => {
              if (event.key === 'Escape') {
                select([]);
                return;
              }
              const offsets: Record<string, [number, number]> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              };
              const offset = offsets[event.key];
              if (!offset || !editable || element.locked || playing) return;
              event.preventDefault();
              const step = event.shiftKey ? 10 : 1;
              (move ?? patch)(element.id, {
                x: element.x + offset[0] * step,
                y: element.y + offset[1] * step,
              });
            }}
          >
            {index + 1}. {element.text || t(`features.studio.${element.type}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
