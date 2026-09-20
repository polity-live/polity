import { useEffect, useRef, useState } from 'react';
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
    ih = image instanceof HTMLVideoElement ? image.videoHeight : (image?.height ?? 1);
  const ratio =
    e.fit === 'cover'
      ? Math.max(e.width / iw, e.height / ih)
      : Math.min(e.width / iw, e.height / ih);
  const w = iw * ratio,
    h = ih * ratio;
  return (
    <Group clipX={0} clipY={0} clipWidth={e.width} clipHeight={e.height}>
      {image ? (
        <CanvasImage
          ref={node}
          image={image}
          width={w}
          height={h}
          x={(e.width - w) * e.cropX}
          y={(e.height - h) * e.cropY}
        />
      ) : (
        <Rect width={e.width} height={e.height} fill="#D9D7D0" />
      )}
    </Group>
  );
}
export interface CanvasProps {
  page: StudioPage;
  assets: StudioAsset[];
  selected: string[];
  select: (ids: string[]) => void;
  patch: (id: string, patch: Partial<StudioElement>) => void;
  editable: boolean;
  peers: any[];
  cursor: (x: number, y: number) => void;
  playing?: boolean;
  time?: number;
  guides?: boolean;
}
export default function StudioCanvas({
  page,
  assets,
  selected,
  select,
  patch,
  editable,
  peers,
  cursor,
  playing = false,
  time = 0,
  guides = true,
}: CanvasProps) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null),
    stage = useRef<Konva.Stage>(null),
    transformer = useRef<Konva.Transformer>(null);
  const [width, setWidth] = useState(600);
  const [w, h] = formats[page.format];
  const scale = Math.min(width / w, 0.65);
  useEffect(() => {
    const observer = new ResizeObserver(entries =>
      setWidth(Math.max(200, entries[0].contentRect.width))
    );
    observer.observe(host.current as HTMLDivElement);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    transformer.current?.nodes(
      selected.map(id => stage.current?.findOne('#' + id)).filter(Boolean) as Konva.Node[]
    );
  }, [selected, page.id, page.elements]);
  return (
    <div
      ref={host}
      className="flex w-full min-w-0 flex-col items-center overflow-auto p-2"
      data-testid="studio-canvas"
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
          {page.elements.map(e => (
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
              onDragMove={event => {
                const node = event.target;
                patch(e.id, { x: Math.round(node.x() / 5) * 5, y: Math.round(node.y() / 5) * 5 });
              }}
              onTransformEnd={event => {
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
              {e.type === 'text' ? (
                <Text
                  text={e.text}
                  width={e.width}
                  height={e.height}
                  fill={e.fill}
                  fontSize={e.fontSize}
                  fontFamily={e.font}
                  fontStyle={e.bold ? 'bold' : 'normal'}
                  align={e.align}
                  lineHeight={1.2}
                  wrap="word"
                />
              ) : e.type === 'rect' ? (
                <Rect width={e.width} height={e.height} fill={e.fill} />
              ) : e.type === 'ellipse' ? (
                <Ellipse
                  x={e.width / 2}
                  y={e.height / 2}
                  radiusX={e.width / 2}
                  radiusY={e.height / 2}
                  fill={e.fill}
                />
              ) : (
                <Media
                  element={e}
                  url={assets.find(a => a.id === e.assetId)?.url}
                  playing={playing}
                  time={time}
                />
              )}
            </Group>
          ))}
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
              patch(element.id, {
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
