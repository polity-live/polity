import { useTranslation } from '@/features/shared/hooks/use-translation';
import './studio-fonts.css';
import './studio-canvas.css';
import { canvasFocusTarget, canvasFocusView, freeCanvasRectangle } from '../logic/canvas-focus';
import { createPortal, flushSync } from 'react-dom';
import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
const {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} = React;
import {
  Stage,
  Layer,
  Group,
  Rect,
  Ellipse,
  Line,
  Shape,
  Image as CanvasImage,
  Transformer,
  Text,
} from 'react-konva';
import Konva from 'konva';
import { CanvasChangeRequestMarker } from '@/features/shared/ui/change-requests/CanvasChangeRequestMarker';
import type { StudioChangeRequestAnnotation } from '../logic/change-request-annotations';
import type { StudioAsset } from '../hooks/useStudioDocument';
import type {
  StudioDocumentV3,
  StudioNode,
  RichTextNode,
  StudioPlateElement,
  FrameNode,
} from '../logic/document-v3';
import { studioSceneChildren, studioScenePaintOrder } from '../logic/studio-scene';
import { getStudioRootFramesInLayerOrder } from '../logic/frame-order';
import { paintStudioRichText } from '../logic/rich-text-paint';
import { isDescendantOf, worldBounds, type Bounds } from '../logic/selection-geometry';
import { studioCanvasSelectionBounds } from '../logic/canvas-selection-bounds';
import { studioCanvasAncestors } from '../logic/canvas-ancestry';
import { observeStudioCanvasContent } from '../logic/canvas-content';
import { canvasMarqueeSelectionIds, canvasSelectionIds } from '../logic/studio-selection';
import { drawStudioElement } from '../logic/draw-element';
import { semanticElement } from '../logic/v3-adapter';
import { configureStudioCanvasSurfaces } from '../logic/canvas-surfaces';
import {
  createStudioCropGesture,
  updateStudioCropGesture,
  type CanvasCropDraft,
  type CanvasCropGesture,
} from '../logic/canvas-crop-gesture';
import {
  createStudioDragPreview,
  updateStudioDragPreview,
  clearStudioDragPreview,
  type CanvasDragPreview,
} from '../logic/canvas-drag-preview';
import {
  collectStudioCanvasTransforms,
  restoreStudioCanvasTransforms,
} from '../logic/canvas-transforms';
import type { StudioElement, StudioMediaCrop } from '../logic/document';
import {
  initialMediaCrop,
  studioMediaGeometry,
  zoomMediaCrop,
  type CropHandle,
  type MediaCropState,
} from '../logic/studio-crop';
import type { StudioTextSelectionEditor } from './StudioTextEditor';
import { StudioInlineTextEditor } from './StudioInlineTextEditor';
import type { StudioTool } from '../state/studio-viewport-store';
import { StudioIntroBackground } from './StudioIntroBackground';
import { frameIntro } from '../logic/event-intro';
import type { StudioThemeSnapshot } from '../logic/theme';

export interface StudioCanvasNodeChange {
  nodeId: string;
  transform?: {
    dx: number;
    dy: number;
    width: number;
    height: number;
    rotation: number;
    flipX: boolean;
    flipY: boolean;
    crop?: StudioMediaCrop | null;
  };
  style?: Partial<StudioNode['style']>;
}

export interface StudioCanvasChangeContext {
  source: 'drag' | 'transform';
}

export interface StudioCanvasState {
  activeTool: StudioTool;
  toolLocked: boolean;
  zoom: number;
  viewBounds: Bounds | null;
}

export type StudioCanvasChangeRequestMarker = StudioChangeRequestAnnotation;

interface InspectorDrag {
  pointerId: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
}

export type StudioCanvasCommand =
  | { type: 'setTool'; tool: StudioTool; locked?: boolean; rounded?: boolean }
  | { type: 'focus'; nodeId: string }
  | { type: 'zoom'; mode: 'in' | 'out' | 'reset' | 'selection' | 'all' }
  | { type: 'search'; query: string }
  | { type: 'clipboard'; action: 'copy' | 'cut' | 'paste' }
  | { type: 'crop'; action: 'start' | 'apply' | 'cancel' | 'reset' };

export interface StudioCanvasHandle {
  execute(command: StudioCanvasCommand): Promise<void>;
  scenePoint(
    clientX: number,
    clientY: number
  ): {
    x: number;
    y: number;
    targetFrameId: string | null;
  };
}

interface Props {
  showCue?: string;
  /** Local preview timeline; omitted for audience playback. */
  showPosition?: number;
  clockOffset?: number;
  document: StudioDocumentV3;
  activeFrameId: string;
  assets: StudioAsset[];
  selected: string[];
  selectExact?: (ids: string[]) => void;
  applyCanvasChanges?: (
    changes: StudioCanvasNodeChange[],
    context?: StudioCanvasChangeContext
  ) => void;
  onNodeDragMove?: (
    nodeId: string,
    selectedIds: string[],
    clientX: number,
    clientY: number
  ) => void;
  onNodeDragEnd?: (
    nodeId: string,
    selectedIds: string[],
    clientX: number,
    clientY: number
  ) => boolean;
  onElementSetDrop?: (setId: string, point: ReturnType<StudioCanvasHandle['scenePoint']>) => void;
  onCreateNode?: (
    tool: StudioTool,
    start: { x: number; y: number },
    end: { x: number; y: number },
    rounded: boolean,
    points?: [number, number][]
  ) => string | null;
  onDeleteNodes?: (ids: string[]) => void;
  onTextChange?: (id: string, content: StudioPlateElement[]) => void;
  onClipboard?: (action: 'copy' | 'cut' | 'paste') => Promise<void> | void;
  onCanvasStateChange?: (state: StudioCanvasState) => void;
  registerTextEditor?: (editor: StudioTextSelectionEditor | null) => void;
  contextToolbar?: ReactNode;
  contextToolbarLabel?: string;
  inspector?: ReactNode;
  inspectorLabels?: { title: string; collapse: string; expand: string; move: string };
  changeRequestMarkers?: StudioCanvasChangeRequestMarker[];
  changeRequestOverlay?: ReactNode;
  onChangeRequestSelect?: (id: string) => void;
  editable: boolean;
  fit?: 'workspace' | 'contain';
  guides?: boolean;
  peers?: {
    cursor?: { pageId?: string; x: number; y: number };
    user?: { color?: string; name?: string };
  }[];
  cursor?: (x: number, y: number) => void;
  activateFrame?: (frameId: string) => void;
  onCropCommit?: (nodeId: string, state: MediaCropState) => void;
  cropLabels?: {
    crop: string;
    apply: string;
    cancel: string;
    reset: string;
    zoom: string;
    loading: string;
    failed: string;
  };
}

function flattenText(node: RichTextNode) {
  const read = (children: StudioPlateElement['children']): string =>
    children.map(child => ('text' in child ? child.text : read(child.children))).join('');
  return node.content.map(block => read(block.children)).join('\n');
}

function fontFamilies(node: RichTextNode): string[] {
  const families = new Set([node.typography.fontFamily]);
  const visit = (children: StudioPlateElement['children']) => {
    for (const child of children) {
      if ('text' in child) {
        if (child.fontFamily) families.add(child.fontFamily);
      } else visit(child.children);
    }
  };
  node.content.forEach(block => visit(block.children));
  return [...families];
}

function DirectText({ node }: { node: RichTextNode }) {
  const shape = useRef<Konva.Shape>(null);
  useEffect(() => {
    if (!document.fonts) return;
    let cancelled = false;
    void Promise.all(
      fontFamilies(node).flatMap(family => [
        document.fonts.load(`400 ${node.typography.fontSize}px "${family}"`),
        document.fonts.load(`700 ${node.typography.fontSize}px "${family}"`),
        document.fonts.load(`italic 400 ${node.typography.fontSize}px "${family}"`),
      ])
    ).then(() => {
      if (!cancelled) shape.current?.getLayer()?.batchDraw();
    });
    return () => {
      cancelled = true;
    };
  }, [node]);
  return (
    <Shape
      ref={shape}
      fill="#000000"
      width={node.transform.width}
      height={node.transform.height}
      sceneFunc={context =>
        paintStudioRichText(
          (context as unknown as { _context: CanvasRenderingContext2D })._context,
          node
        )
      }
      hitFunc={(context, item) => {
        context.beginPath();
        context.rect(0, 0, node.transform.width, node.transform.height);
        context.fillStrokeShape(item);
      }}
    />
  );
}

function DirectData({ node }: { node: Extract<StudioNode, { type: 'chart' | 'table' }> }) {
  const shape = useRef<Konva.Shape>(null);
  const element = semanticElement(node) as StudioElement;
  const family = element.chart?.fontFamily ?? element.font;
  useEffect(() => {
    if (!document.fonts) return;
    let cancelled = false;
    const redraw = () => {
      if (!cancelled) shape.current?.getLayer()?.batchDraw();
    };
    // Canvas text does not repaint automatically when a web font finishes loading.
    void Promise.all([
      document.fonts.load(`400 12px "${family}"`),
      document.fonts.load(`700 12px "${family}"`),
    ]).then(redraw, redraw);
    return () => {
      cancelled = true;
    };
  }, [family]);
  return (
    <Shape
      ref={shape}
      width={node.transform.width}
      height={node.transform.height}
      fill="#000000"
      sceneFunc={context =>
        drawStudioElement((context as unknown as { _context: CanvasRenderingContext2D })._context, {
          ...element,
          x: 0,
          y: 0,
          rotation: 0,
          opacity: 1,
        })
      }
      hitFunc={(context, item) => {
        context.beginPath();
        context.rect(0, 0, node.transform.width, node.transform.height);
        context.fillStrokeShape(item);
      }}
    />
  );
}

function DirectMedia({
  node,
  url,
  showOutside = false,
}: {
  node: Extract<StudioNode, { type: 'media' }>;
  url?: string;
  showOutside?: boolean;
}) {
  const [image, setImage] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const rendered = useRef<Konva.Image>(null);
  useEffect(() => {
    if (!url) return;
    if (node.mediaType === 'video') {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = url;
      video.muted = true;
      video.preload = 'auto';
      video.onloadeddata = () => setImage(video);
      video.onseeked = () => rendered.current?.getLayer()?.batchDraw();
      return () => {
        video.onloadeddata = null;
        video.onseeked = null;
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
    }
    const next = new window.Image();
    next.crossOrigin = 'anonymous';
    next.onload = () => setImage(next);
    next.src = url;
    return () => {
      next.onload = null;
    };
  }, [url, node.mediaType]);
  if (!image)
    return <Rect width={node.transform.width} height={node.transform.height} fill="#D9D7D0" />;
  const naturalWidth = Math.max(
    1,
    image instanceof HTMLVideoElement ? image.videoWidth : image.naturalWidth
  );
  const naturalHeight = Math.max(
    1,
    image instanceof HTMLVideoElement ? image.videoHeight : image.naturalHeight
  );
  const { width, height } = node.transform;
  const placement = studioMediaGeometry(
    { frame: node.transform, fit: node.fit, focus: node.focus, crop: node.crop },
    naturalWidth,
    naturalHeight
  );
  return (
    <Group>
      {showOutside && <CanvasImage image={image} {...placement} opacity={0.35} listening={false} />}
      <Group clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
        <CanvasImage ref={rendered} image={image} {...placement} />
      </Group>
    </Group>
  );
}

function NodeContent({
  node,
  assets,
  frameBackground,
  cropEditing = false,
  theme,
  introAnimate = false,
  clockOffset,
}: {
  node: StudioNode;
  assets: StudioAsset[];
  frameBackground: string;
  cropEditing?: boolean;
  theme?: StudioThemeSnapshot;
  introAnimate?: boolean;
  clockOffset?: number;
}) {
  const { width, height } = node.transform;
  const stroke = node.style.stroke ?? undefined;
  const fill = node.style.fill ?? undefined;
  const dash =
    node.style.strokeStyle === 'dashed'
      ? [10, 7]
      : node.style.strokeStyle === 'dotted'
        ? [2, 5]
        : undefined;
  if (node.type === 'frame')
    return (
      <>
        <Rect
          width={width}
          height={height}
          fill={fill ?? frameBackground}
          stroke={stroke}
          strokeWidth={node.style.strokeWidth}
          dash={dash}
          cornerRadius={node.style.cornerRadius}
          listening={false}
        />
        {theme && (
          <StudioIntroBackground
            frame={node}
            theme={theme}
            url={assets.find(asset => asset.id === frameIntro(node)?.assetId)?.url}
            animate={introAnimate}
            clockOffset={clockOffset}
          />
        )}
      </>
    );
  if (node.type === 'richText') return <DirectText node={node} />;
  if (node.type === 'media')
    return (
      <DirectMedia
        node={node}
        url={assets.find(asset => asset.id === node.assetId)?.url}
        showOutside={cropEditing}
      />
    );
  if (node.type === 'shape') {
    if (node.shape === 'ellipse')
      return (
        <Ellipse
          x={width / 2}
          y={height / 2}
          radiusX={width / 2}
          radiusY={height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={node.style.strokeWidth}
          dash={dash}
        />
      );
    if (node.shape === 'diamond')
      return (
        <Line
          points={[width / 2, 0, width, height / 2, width / 2, height, 0, height / 2]}
          closed
          fill={fill}
          stroke={stroke}
          strokeWidth={node.style.strokeWidth}
          dash={dash}
        />
      );
    if (node.shape === 'line' || node.shape === 'arrow')
      return (
        <Shape
          width={width}
          height={height}
          sceneFunc={(context, item) => {
            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(width, height);
            if (node.shape === 'arrow') {
              const angle = Math.atan2(height, width);
              const size = 18;
              context.moveTo(
                width - size * Math.cos(angle - 0.5),
                height - size * Math.sin(angle - 0.5)
              );
              context.lineTo(width, height);
              context.lineTo(
                width - size * Math.cos(angle + 0.5),
                height - size * Math.sin(angle + 0.5)
              );
            }
            context.fillStrokeShape(item);
          }}
          stroke={stroke ?? '#12362D'}
          strokeWidth={Math.max(2, node.style.strokeWidth)}
          dash={dash}
        />
      );
    return (
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={node.style.strokeWidth}
        dash={dash}
        cornerRadius={
          node.shape === 'rounded-rectangle'
            ? Math.max(12, node.style.cornerRadius)
            : node.style.cornerRadius
        }
      />
    );
  }
  if (node.type === 'drawing')
    return (
      <Line
        points={node.points.flat()}
        stroke={stroke ?? '#12362D'}
        strokeWidth={Math.max(2, node.style.strokeWidth)}
        lineCap="round"
        lineJoin="round"
      />
    );
  if (node.type === 'table' || node.type === 'chart') {
    return <DirectData node={node} />;
  }
  return (
    <Rect
      width={width}
      height={height}
      fill={fill ?? '#EEEEEE'}
      stroke={stroke}
      strokeWidth={node.style.strokeWidth}
    />
  );
}

function ChangeRequestGhost({
  annotation,
  node,
  assets,
  frameBackground,
}: {
  annotation: StudioChangeRequestAnnotation;
  node: StudioNode;
  assets: StudioAsset[];
  frameBackground: string;
}) {
  const chain: StudioNode[] = [node];
  let parentId = node.parentFrameId;
  while (parentId) {
    const parent = annotation.sourceDocument.nodes.find(item => item.id === parentId);
    if (!parent) break;
    chain.unshift(parent);
    parentId = parent.parentFrameId;
  }
  let content: ReactNode = (
    <NodeContent node={node} assets={assets} frameBackground={frameBackground} />
  );
  for (const item of [...chain].reverse()) {
    const t = item.transform;
    content = (
      <Group
        key={item.id}
        x={t.x + t.width / 2}
        y={t.y + t.height / 2}
        offsetX={t.width / 2}
        offsetY={t.height / 2}
        rotation={t.rotation}
        scaleX={t.flipX ? -1 : 1}
        scaleY={t.flipY ? -1 : 1}
        listening={false}
      >
        {content}
      </Group>
    );
  }
  return (
    <Group opacity={0.45} listening={false}>
      {content}
    </Group>
  );
}

function changeRequestOutlineColors(tone: StudioChangeRequestAnnotation['tone']) {
  if (tone === 'add')
    return {
      border: 'var(--badge-success-border, #51b77c)',
      glow: 'var(--badge-success-bg, rgb(81 183 124 / 0.18))',
    };
  if (tone === 'remove')
    return {
      border: 'var(--badge-danger-border, #e36b68)',
      glow: 'var(--badge-danger-bg, rgb(227 107 104 / 0.18))',
    };
  return { border: '#f59e0b', glow: 'rgb(245 158 11 / 0.16)' };
}

function EditorPortal({
  document,
  node,
  zoom,
  pan,
  children,
}: {
  document: StudioDocumentV3;
  node: RichTextNode;
  zoom: number;
  pan: { x: number; y: number };
  children: ReactNode;
}) {
  const ancestors = studioCanvasAncestors(document.nodes, node.parentFrameId);
  const wrap = (item: StudioNode, content: ReactNode) => {
    const t = item.transform;
    const style: CSSProperties = {
      position: 'absolute',
      left: t.x,
      top: t.y,
      width: t.width,
      height: t.height,
      transformOrigin: 'center center',
      transform: `rotate(${t.rotation}deg) scale(${t.flipX ? -1 : 1}, ${t.flipY ? -1 : 1})`,
      opacity: item.style.opacity,
      overflow: item.type === 'frame' && item.clipContent ? 'hidden' : 'visible',
    };
    return (
      <div key={item.id} style={style}>
        {content}
      </div>
    );
  };
  let content: ReactNode = wrap(node, children);
  for (const ancestor of [...ancestors].reverse()) content = wrap(ancestor, content);
  return (
    <div
      data-testid="studio-inline-text-layer"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        transformOrigin: '0 0',
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{content}</div>
    </div>
  );
}

interface CanvasToolGesture {
  mode: 'pan' | 'tool';
  start: { x: number; y: number };
  end: { x: number; y: number };
  points: [number, number][];
}

interface CanvasTextGesture {
  pointerId: number;
  nodeId: string | null;
  start: { x: number; y: number };
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  active: boolean;
}

interface CanvasMarquee {
  pointerId: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  clientX: number;
  clientY: number;
  additive: boolean;
  previous: string[];
  active: boolean;
}

interface CanvasTouchGesture {
  center: { x: number; y: number };
  distance: number;
}

interface CanvasPanPointer {
  x: number;
  y: number;
}

const KonvaStudioCanvas = forwardRef<StudioCanvasHandle, Props>(
  function KonvaStudioCanvas(props, ref) {
    const t = useTranslation().t;
    const host = useRef<HTMLDivElement>(null);
    const stage = useRef<Konva.Stage>(null);
    useEffect(() => {
      const frame = props.document.nodes.find(
        n => n.id === props.activeFrameId && n.type === 'frame'
      );
      if (
        !props.showCue ||
        props.showPosition !== undefined ||
        (frame?.type === 'frame' &&
          frameIntro(frame)?.mode !== undefined &&
          frameIntro(frame)?.mode !== 'static') ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )
        return;
      const tweens: Konva.Tween[] = [];
      const timers: ReturnType<typeof setTimeout>[] = [];
      const resets: (() => void)[] = [];
      const pulses: (() => void)[] = [];
      const paint = requestAnimationFrame(() => {
        let animationIndex = 0;
        props.document.nodes.forEach(node => {
          if (
            node.type === 'frame' ||
            !node.visible ||
            !node.showAnimation ||
            node.showAnimation.preset === 'none'
          )
            return;
          const target = stage.current?.findOne(`#${node.id}-show`);
          if (!target) return;
          const index = animationIndex++;
          const original = {
            x: 0,
            y: 0,
            opacity: 1,
            scaleX: 1,
            scaleY: 1,
          };
          resets.push(() => target.setAttrs(original));
          const spec = node.showAnimation;
          const slide = spec.preset === 'slide' || spec.preset === 'stagger';
          if (spec.preset === 'pulse') {
            const start = performance.now();
            let id = 0;
            const pulse = () => {
              const phase = (performance.now() - start) / (spec.duration * 1000);
              target.opacity(
                original.opacity *
                  (1 - spec.intensity * 0.25 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2)))
              );
              target.getLayer()?.batchDraw();
              id = requestAnimationFrame(pulse);
            };
            id = requestAnimationFrame(pulse);
            pulses.push(() => cancelAnimationFrame(id));
            return;
          }
          target.opacity(0);
          if (slide) target.x(original.x + 80 * spec.intensity);
          const tween = new Konva.Tween({
            node: target,
            duration: spec.duration,
            easing: Konva.Easings.EaseOut,
            ...original,
          });
          tweens.push(tween);
          if (spec.preset === 'stagger') timers.push(setTimeout(() => tween.play(), index * 90));
          else tween.play();
        });
      });
      return () => {
        cancelAnimationFrame(paint);
        timers.forEach(clearTimeout);
        pulses.forEach(stop => stop());
        tweens.forEach(t => t.destroy());
        resets.forEach(reset => reset());
      };
    }, [props.showCue, props.activeFrameId]);
    useEffect(() => {
      if (props.showPosition === undefined || !props.showCue) return;
      const showPosition = props.showPosition;
      const frame = props.document.nodes.find(
        n => n.id === props.activeFrameId && n.type === 'frame'
      );
      const suppressed =
        frame?.type === 'frame' &&
        frameIntro(frame)?.mode !== undefined &&
        frameIntro(frame)?.mode !== 'static';
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const paint = requestAnimationFrame(() => {
        let index = 0;
        for (const node of props.document.nodes) {
          const spec = node.showAnimation;
          if (node.type === 'frame' || !node.visible || !spec || spec.preset === 'none') continue;
          const target = stage.current?.findOne(`#${node.id}-show`);
          if (!target) continue;
          const delay = spec.preset === 'stagger' ? index * 0.09 : 0;
          index++;
          const time = Math.max(0, showPosition - delay);
          const progress =
            suppressed || reduced ? 1 : Math.min(1, time / Math.max(0.001, spec.duration));
          const eased = 1 - (1 - progress) ** 3;
          target.setAttrs({
            x:
              spec.preset === 'slide' || spec.preset === 'stagger'
                ? 80 * spec.intensity * (1 - eased)
                : 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            opacity:
              spec.preset === 'pulse'
                ? suppressed || reduced
                  ? 1
                  : 1 -
                    spec.intensity *
                      0.25 *
                      (0.5 - 0.5 * Math.cos((time / spec.duration) * Math.PI * 2))
                : eased,
          });
          target.getLayer()?.batchDraw();
        }
      });
      return () => cancelAnimationFrame(paint);
    }, [props.showPosition, props.showCue, props.activeFrameId, props.document]);
    const lower = useRef<Konva.Layer>(null);
    const upper = useRef<Konva.Layer>(null);
    const controls = useRef<Konva.Layer>(null);
    const transformer = useRef<Konva.Transformer>(null);
    const [viewport, setViewport] = useState({ width: 1, height: 1 });
    const initialFit = useRef(false);
    const focusSequence = useRef(0);
    const latestDocument = useRef(props.document);
    latestDocument.current = props.document;
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [activeTool, setActiveTool] = useState<StudioTool>('selection');
    const [toolLocked, setToolLocked] = useState(false);
    const [rounded, setRounded] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const [pendingTextEdit, setPendingTextEdit] = useState<string | null>(null);
    const contextToolbarRef = useRef<HTMLDivElement>(null);
    const [contextToolbarSize, setContextToolbarSize] = useState({ width: 0, height: 0 });
    const [contextToolbarBounds, setContextToolbarBounds] = useState<Bounds | null>(null);
    const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
    const [inspectorPosition, setInspectorPosition] = useState({ x: 16, y: 16 });
    const inspectorPanel = useRef<HTMLElement>(null);
    const inspectorDrag = useRef<InspectorDrag | null>(null);
    const inspectorBodyId = useId();
    const cropState = useState<CanvasCropDraft | null>(null);
    const cropDraft = cropState[0];
    const setCropDraft = cropState[1];
    const [cropLoading, setCropLoading] = useState(false);
    const [cropError, setCropError] = useState(false);
    const cropGesture = useRef<CanvasCropGesture | null>(null);
    const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
    const [gesture, setGesture] = useState<CanvasToolGesture | null>(null);
    const textGesture = useRef<CanvasTextGesture | null>(null);
    const suppressTextClick = useRef(false);
    const [marquee, setMarquee] = useState<CanvasMarquee | null>(null);
    const marqueeRef = useRef(marquee);
    marqueeRef.current = marquee;
    const dragPreview = useRef<CanvasDragPreview | null>(null);
    const ignoredFollowerDrags = useRef(new Set<string>());
    const [spacePressed, setSpacePressed] = useState(false);
    const spacePressedRef = useRef(false);
    const touchSuppressed = useRef(false);
    const touchGesture = useRef<CanvasTouchGesture | null>(null);
    const touchResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const panPointer = useRef<CanvasPanPointer | null>(null);
    useEffect(() => {
      const cancel = () => {
        if (!textGesture.current) return;
        textGesture.current = null;
        suppressTextClick.current = true;
        setGesture(null);
      };
      const keyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && textGesture.current) {
          event.preventDefault();
          cancel();
        }
      };
      window.addEventListener('keydown', keyDown);
      window.addEventListener('blur', cancel);
      return () => {
        window.removeEventListener('keydown', keyDown);
        window.removeEventListener('blur', cancel);
      };
    }, []);
    const panRef = useRef(pan);
    const zoomRef = useRef(zoom);
    panRef.current = pan;
    zoomRef.current = zoom;
    useEffect(() => {
      if (!props.editable || props.fit === 'contain') return;
      const content = stage.current?.content;
      if (!content) return;
      let drag: { pointerId: number; x: number; y: number; cursor: string } | null = null;
      const stop = () => {
        if (!drag) return;
        const { pointerId, cursor } = drag;
        drag = null;
        content.style.cursor = cursor;
        if (content.hasPointerCapture(pointerId)) content.releasePointerCapture(pointerId);
      };
      const onDown = (event: PointerEvent) => {
        // Capture the gesture before Konva can select, crop, or drag an element.
        if (
          event.pointerType !== 'mouse' ||
          event.button !== 1 ||
          !(event.target instanceof HTMLCanvasElement)
        )
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
        drag = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          cursor: content.style.cursor,
        };
        content.style.cursor = 'grabbing';
        try {
          content.setPointerCapture(event.pointerId);
        } catch {
          // Synthetic events have no active pointer; window listeners still end the gesture.
        }
      };
      const onMove = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!(event.buttons & 4)) {
          stop();
          return;
        }
        const nextPan = {
          x: panRef.current.x + event.clientX - drag.x,
          y: panRef.current.y + event.clientY - drag.y,
        };
        drag.x = event.clientX;
        drag.y = event.clientY;
        panRef.current = nextPan;
        setPan(nextPan);
      };
      const onEnd = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (event.type === 'pointerup' && event.buttons & 4) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        stop();
      };
      const preventMiddleClick = (event: MouseEvent) => {
        if (
          event.button !== 1 ||
          !(event.target instanceof HTMLCanvasElement || event.target === content)
        )
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      content.addEventListener('pointerdown', onDown, true);
      content.addEventListener('mousedown', preventMiddleClick, true);
      content.addEventListener('auxclick', preventMiddleClick, true);
      content.addEventListener('lostpointercapture', onEnd, true);
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onEnd, true);
      window.addEventListener('pointercancel', onEnd, true);
      window.addEventListener('blur', stop);
      return () => {
        stop();
        content.removeEventListener('pointerdown', onDown, true);
        content.removeEventListener('mousedown', preventMiddleClick, true);
        content.removeEventListener('auxclick', preventMiddleClick, true);
        content.removeEventListener('lostpointercapture', onEnd, true);
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onEnd, true);
        window.removeEventListener('pointercancel', onEnd, true);
        window.removeEventListener('blur', stop);
      };
    }, [props.editable, props.fit]);
    useEffect(() => {
      const cancel = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || !marqueeRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        marqueeRef.current = null;
        setMarquee(null);
      };
      window.addEventListener('keydown', cancel, true);
      return () => window.removeEventListener('keydown', cancel, true);
    }, []);
    const paintOrder = useMemo(
      () =>
        studioScenePaintOrder(
          props.document,
          props.fit === 'contain' ? props.activeFrameId : undefined
        ),
      [props.document, props.fit, props.activeFrameId]
    );
    const paintIndex = useMemo(
      () => new Map(paintOrder.map((node, index) => [node.id, index])),
      [paintOrder]
    );
    const frameLabelElements = useRef(new Map<string, HTMLSpanElement>());
    const frameLabels = useMemo(() => {
      if (props.fit === 'contain') return [];
      const numbers = new Map(
        getStudioRootFramesInLayerOrder(props.document)
          .filter(frame => frame.visible)
          .map((frame, index) => [frame.id, index + 1])
      );
      return paintOrder.flatMap(node => {
        if (node.type !== 'frame' || node.id === props.document.masterLayout.frameId) return [];
        const number = numbers.get(node.id);
        return [{ frame: node, text: number ? `${number} · ${node.name}` : node.name }];
      });
    }, [paintOrder, props.document, props.fit]);
    useLayoutEffect(() => {
      const stageNode = stage.current;
      if (!stageNode || !frameLabels.length) return;
      const targets = frameLabels.map(({ frame }) => ({
        frame,
        element: frameLabelElements.current.get(frame.id),
        rendered: stageNode.findOne(`#${frame.id}`),
      }));
      const positionLabels = () => {
        const placed: { left: number; top: number; right: number; bottom: number }[] = [];
        for (const { frame, element, rendered } of targets) {
          if (!element || !rendered) continue;
          // Use the frame's own corners, not its children, and include live drag/resize transforms.
          const transform = rendered.getAbsoluteTransform();
          const corners = [
            { x: 0, y: 0 },
            { x: frame.transform.width, y: 0 },
            { x: 0, y: frame.transform.height },
            { x: frame.transform.width, y: frame.transform.height },
          ].map(point => transform.point(point));
          const left = Math.min(...corners.map(point => point.x));
          const top = Math.min(...corners.map(point => point.y));
          const right = Math.max(...corners.map(point => point.x));
          element.style.left = `${left}px`;
          element.style.maxWidth = `${Math.max(1, right - left)}px`;
          const width = element.offsetWidth;
          const height = element.offsetHeight;
          let bottom = top - 6;
          // Parent and nested frames can share an origin. Keep each name on its own line.
          let overlap;
          do {
            overlap = placed.find(
              label =>
                left < label.right + 2 &&
                left + width + 2 > label.left &&
                bottom - height < label.bottom + 2 &&
                bottom + 2 > label.top
            );
            if (overlap) bottom = overlap.top - 2;
          } while (overlap);
          element.style.top = `${bottom}px`;
          placed.push({ left, top: bottom - height, right: left + width, bottom });
        }
      };
      positionLabels();
      const layers = [lower.current, upper.current];
      layers.forEach(layer => layer?.on('draw.frameLabels', positionLabels));
      return () => {
        layers.forEach(layer => layer?.off('draw.frameLabels', positionLabels));
      };
    }, [frameLabels, zoom, pan.x, pan.y, viewport, editing]);
    const editingNode = props.document.nodes.find(
      node => node.id === editing && node.type === 'richText'
    ) as RichTextNode | undefined;
    const selectedTextNode =
      props.selected.length === 1
        ? props.document.nodes.find(
            node => node.id === props.selected[0] && node.type === 'richText' && !node.locked
          )
        : undefined;
    const hasContextToolbar = Boolean(props.contextToolbar || selectedTextNode);
    const splitIndex = editingNode ? (paintIndex.get(editingNode.id) ?? -1) : Infinity;
    const refreshContextToolbarBounds = useCallback(() => {
      const stageNode = stage.current;
      if (!stageNode || !hasContextToolbar || !props.selected.length) {
        setContextToolbarBounds(null);
        return;
      }
      const next = studioCanvasSelectionBounds(stageNode, props.selected, zoom, pan);
      setContextToolbarBounds(current =>
        current &&
        next &&
        Object.keys(next).every(key => current[key as keyof Bounds] === next[key as keyof Bounds])
          ? current
          : next
      );
    }, [hasContextToolbar, props.selected, pan.x, pan.y, zoom]);
    useLayoutEffect(() => {
      refreshContextToolbarBounds();
    }, [refreshContextToolbarBounds, props.document, viewport]);
    useLayoutEffect(() => {
      const toolbar = contextToolbarRef.current;
      if (!toolbar) return;
      const resize = () =>
        setContextToolbarSize(current =>
          current.width === toolbar.offsetWidth && current.height === toolbar.offsetHeight
            ? current
            : { width: toolbar.offsetWidth, height: toolbar.offsetHeight }
        );
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(toolbar);
      return () => observer.disconnect();
    }, [props.contextToolbar, selectedTextNode, editing, contextToolbarBounds]);

    useEffect(() => {
      if (!host.current) return;
      const observer = new ResizeObserver(([entry]) =>
        setViewport({
          width: Math.max(1, entry.contentRect.width),
          height: Math.max(1, entry.contentRect.height),
        })
      );
      observer.observe(host.current);
      return () => observer.disconnect();
    }, []);
    useEffect(() => {
      setPortalTarget(stage.current?.content ?? null);
    }, [viewport]);
    const clampInspectorPosition = useCallback(
      (x: number, y: number) => {
        const panelWidth = inspectorPanel.current?.offsetWidth ?? 352;
        return {
          x: Math.max(0, Math.min(x, viewport.width - panelWidth)),
          y: Math.max(0, Math.min(y, viewport.height - 44)),
        };
      },
      [viewport.width, viewport.height]
    );
    useEffect(() => {
      const move = (event: PointerEvent) => {
        const drag = inspectorDrag.current;
        if (!drag || event.pointerId !== drag.pointerId) return;
        setInspectorPosition(
          clampInspectorPosition(
            drag.x + event.clientX - drag.clientX,
            drag.y + event.clientY - drag.clientY
          )
        );
      };
      const end = (event: PointerEvent) => {
        if (inspectorDrag.current?.pointerId === event.pointerId) inspectorDrag.current = null;
      };
      const cancel = () => {
        inspectorDrag.current = null;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      window.addEventListener('blur', cancel);
      return () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        window.removeEventListener('blur', cancel);
      };
    }, [clampInspectorPosition]);
    useEffect(() => {
      if (!props.editable || props.fit === 'contain') return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.code !== 'Space') return;
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest('input,textarea,select,button,[contenteditable="true"],[role="button"]')
        )
          return;
        event.preventDefault();
        if (!spacePressedRef.current) {
          spacePressedRef.current = true;
          setSpacePressed(true);
        }
      };
      const release = () => {
        spacePressedRef.current = false;
        setSpacePressed(false);
        setGesture(current => (current?.mode === 'pan' ? null : current));
        panPointer.current = null;
      };
      const onKeyUp = (event: KeyboardEvent) => {
        if (event.code === 'Space' && spacePressedRef.current) release();
      };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', release);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', release);
      };
    }, [props.editable, props.fit]);
    useEffect(() => {
      if (!props.editable || props.fit === 'contain') return;
      return observeStudioCanvasContent(stage.current, content => {
        const geometry = (touches: TouchList) => {
          const bounds = content.getBoundingClientRect();
          const first = touches[0];
          const second = touches[1];
          return {
            center: {
              x: (first.clientX + second.clientX) / 2 - bounds.left,
              y: (first.clientY + second.clientY) / 2 - bounds.top,
            },
            distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY),
          };
        };
        const onTouchStart = (event: TouchEvent) => {
          if (
            event.target instanceof Element &&
            event.target.closest('[contenteditable="true"],input,textarea,select')
          )
            return;
          if (touchResetTimer.current) clearTimeout(touchResetTimer.current);
          if (event.touches.length < 2) {
            if (event.touches.length === 1 && !touchGesture.current)
              touchSuppressed.current = false;
            return;
          }
          event.preventDefault();
          touchSuppressed.current = true;
          textGesture.current = null;
          suppressTextClick.current = true;
          setGesture(null);
          marqueeRef.current = null;
          setMarquee(null);
          panPointer.current = null;
          cropGesture.current = null;
          if (transformer.current?.isTransforming()) transformer.current.stopTransform();
          stage.current
            ?.find((node: Konva.Node) => node.isDragging())
            .forEach(node => node.stopDrag());
          touchGesture.current = geometry(event.touches);
        };
        const onTouchMove = (event: TouchEvent) => {
          if (event.touches.length < 2 || !touchGesture.current) return;
          event.preventDefault();
          const next = geometry(event.touches);
          const previous = touchGesture.current;
          const currentZoom = zoomRef.current;
          const nextZoom = Math.max(
            0.05,
            Math.min(4, currentZoom * (next.distance / Math.max(1, previous.distance)))
          );
          const nextPan = {
            x: next.center.x - ((previous.center.x - panRef.current.x) * nextZoom) / currentZoom,
            y: next.center.y - ((previous.center.y - panRef.current.y) * nextZoom) / currentZoom,
          };
          zoomRef.current = nextZoom;
          panRef.current = nextPan;
          setZoom(nextZoom);
          setPan(nextPan);
          touchGesture.current = next;
        };
        const onTouchEnd = (event: TouchEvent) => {
          if (touchGesture.current || touchSuppressed.current) event.preventDefault();
          if (event.touches.length < 2) touchGesture.current = null;
          if (event.touches.length === 0 && touchSuppressed.current) {
            touchResetTimer.current = setTimeout(() => {
              touchSuppressed.current = false;
            }, 350);
          }
        };
        content.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
        content.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
        content.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
        content.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: false });
        return () => {
          if (touchResetTimer.current) clearTimeout(touchResetTimer.current);
          content.removeEventListener('touchstart', onTouchStart, true);
          content.removeEventListener('touchmove', onTouchMove, true);
          content.removeEventListener('touchend', onTouchEnd, true);
          content.removeEventListener('touchcancel', onTouchEnd, true);
        };
      });
    }, [props.editable, props.fit, viewport.width, viewport.height]);
    useEffect(() => {
      props.onCanvasStateChange?.({
        activeTool,
        toolLocked,
        zoom,
        viewBounds:
          viewport.width > 1 && viewport.height > 1
            ? {
                left: -pan.x / zoom,
                top: -pan.y / zoom,
                right: (viewport.width - pan.x) / zoom,
                bottom: (viewport.height - pan.y) / zoom,
              }
            : null,
      });
    }, [activeTool, toolLocked, zoom, pan, viewport, props.onCanvasStateChange]);
    useLayoutEffect(() => {
      if (!pendingTextEdit) return;
      if (!props.editable) {
        setPendingTextEdit(null);
        return;
      }
      if (!props.selected.includes(pendingTextEdit)) return;
      const node = props.document.nodes.find(candidate => candidate.id === pendingTextEdit);
      if (node?.type !== 'richText') return;
      if (node.locked || props.selected.length !== 1) {
        setPendingTextEdit(null);
        return;
      }
      setEditing(pendingTextEdit);
      setPendingTextEdit(null);
    }, [pendingTextEdit, props.document, props.editable, props.selected]);
    useEffect(() => {
      if (
        editing &&
        (!editingNode ||
          editingNode.locked ||
          !props.editable ||
          props.selected.length !== 1 ||
          !props.selected.includes(editing))
      )
        setEditing(null);
    }, [editing, editingNode, props.editable, props.selected]);
    useEffect(() => {
      if (cropDraft && (!props.editable || !props.selected.includes(cropDraft.nodeId))) {
        setCropDraft(null);
        cropGesture.current = null;
      }
    }, [cropDraft, props.editable, props.selected]);
    useEffect(() => {
      if (!cropDraft) return;
      const stop = () => {
        cropGesture.current = null;
      };
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
      return () => {
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
      };
    }, [cropDraft]);
    useEffect(() => {
      if (cropDraft) {
        transformer.current?.nodes([]);
        return;
      }
      const nodes = props.selected
        .filter(id => !props.document.nodes.find(node => node.id === id)?.locked)
        .map(id => stage.current?.findOne(`#${id}`))
        .filter((node): node is Konva.Node => !!node);
      transformer.current?.nodes(nodes);
      transformer.current?.getLayer()?.batchDraw();
    }, [props.selected, props.document, editing, cropDraft]);
    useEffect(() => {
      configureStudioCanvasSurfaces({
        lower: lower.current?.getCanvas()._canvas,
        upper: upper.current?.getCanvas()._canvas,
        controls: controls.current?.getCanvas()._canvas,
        editable: props.editable,
        contain: props.fit === 'contain',
        editingText: Boolean(editingNode),
      });
    }, [editingNode, paintOrder, props.editable, props.fit]);

    const scenePoint = useCallback(
      (clientX: number, clientY: number) => {
        const bounds = stage.current?.container().getBoundingClientRect();
        const x = (clientX - (bounds?.left ?? 0) - pan.x) / zoom;
        const y = (clientY - (bounds?.top ?? 0) - pan.y) / zoom;
        const targetFrameId =
          [...paintOrder].reverse().find(node => {
            if (node.type !== 'frame' || !node.visible) return false;
            const b = worldBounds(props.document, node);
            return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
          })?.id ?? null;
        return { x, y, targetFrameId };
      },
      [paintOrder, pan, props.document, zoom]
    );

    const fit = useCallback(
      (mode: 'all' | 'selection') => {
        const targets =
          mode === 'selection'
            ? paintOrder.filter(node => props.selected.includes(node.id))
            : paintOrder.filter(node => node.parentFrameId === null);
        if (!targets.length) return;
        const bounds = targets.map(node => worldBounds(props.document, node));
        const left = Math.min(...bounds.map(item => item.left));
        const top = Math.min(...bounds.map(item => item.top));
        const right = Math.max(...bounds.map(item => item.right));
        const bottom = Math.max(...bounds.map(item => item.bottom));
        const padding = props.fit === 'contain' && !props.editable ? 0 : 64;
        const next = Math.max(
          0.05,
          Math.min(
            4,
            (viewport.width - padding) / Math.max(1, right - left),
            (viewport.height - padding) / Math.max(1, bottom - top)
          )
        );
        setZoom(next);
        setPan({
          x: (viewport.width - (left + right) * next) / 2,
          y: (viewport.height - (top + bottom) * next) / 2,
        });
      },
      [paintOrder, props.document, props.selected, viewport, props.fit, props.editable]
    );

    const fitRef = useRef(fit);
    fitRef.current = fit;
    const activeFrameTransform = props.document.nodes.find(
      node => node.id === props.activeFrameId
    )?.transform;

    useEffect(() => {
      if (viewport.width <= 1 || viewport.height <= 1) return;
      if (props.fit === 'contain') fitRef.current('all');
      else if (!initialFit.current) {
        initialFit.current = true;
        fitRef.current('all');
      }
    }, [
      props.fit,
      props.activeFrameId,
      viewport.width,
      viewport.height,
      activeFrameTransform?.width,
      activeFrameTransform?.height,
    ]);

    const startCrop = useCallback(
      async (nodeId: string) => {
        const node = props.document.nodes.find(candidate => candidate.id === nodeId);
        if (
          !props.editable ||
          node?.type !== 'media' ||
          !['image', 'video'].includes(node.mediaType) ||
          node.locked
        )
          return;
        const url = props.assets.find(asset => asset.id === node.assetId)?.url;
        if (!url) {
          setCropError(true);
          return;
        }
        setCropError(false);
        setCropLoading(true);
        try {
          const dimensions = await new Promise<{ width: number; height: number }>(
            (resolve, reject) => {
              if (node.mediaType === 'video') {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () =>
                  resolve({ width: video.videoWidth, height: video.videoHeight });
                video.onerror = () => reject(new Error('Video metadata unavailable'));
                video.src = url;
              } else {
                const image = new window.Image();
                image.onload = () =>
                  resolve({ width: image.naturalWidth, height: image.naturalHeight });
                image.onerror = () => reject(new Error('Image metadata unavailable'));
                image.src = url;
              }
            }
          );
          if (!dimensions.width || !dimensions.height)
            throw new Error('Media dimensions unavailable');
          const initial = initialMediaCrop(
            node.transform,
            node.fit,
            node.focus,
            node.crop,
            dimensions.width,
            dimensions.height
          );
          props.selectExact?.([nodeId]);
          setCropDraft({ nodeId, state: initial, zoom: 1 });
          setActiveTool('selection');
        } catch {
          setCropError(true);
        } finally {
          setCropLoading(false);
        }
      },
      [props.document, props.assets, props.editable, props.selectExact]
    );

    const finishCrop = useCallback(
      (action: 'apply' | 'cancel' | 'reset') => {
        if (!cropDraft) return;
        if (action === 'reset') {
          const { naturalWidth, naturalHeight } = cropDraft.state.crop;
          setCropDraft(
            current =>
              current && {
                ...current,
                zoom: 1,
                state: {
                  ...current.state,
                  fit: 'contain',
                  focus: { x: 0.5, y: 0.5 },
                  crop: {
                    x: 0,
                    y: 0,
                    width: naturalWidth,
                    height: naturalHeight,
                    naturalWidth,
                    naturalHeight,
                  },
                },
              }
          );
          return;
        }
        if (action === 'apply') props.onCropCommit?.(cropDraft.nodeId, cropDraft.state);
        setCropDraft(null);
        cropGesture.current = null;
      },
      [cropDraft, props.onCropCommit]
    );

    const focusNode = useCallback(
      async (nodeId: string) => {
        const requestId = ++focusSequence.current;
        const target = canvasFocusTarget(props.document, nodeId);
        const element = host.current;
        if (!element) throw new Error('Canvas unavailable');
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        // Select by ID first; wait for the inspector and chat layout before measuring.
        props.selectExact?.([nodeId]);
        if (target.frameId) props.activateFrame?.(target.frameId);
        setEditing(null);
        setPendingTextEdit(null);
        setActiveTool('selection');
        setToolLocked(false);
        const nextFrame = () =>
          new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        let lastLayout = '';
        for (let pass = 0; pass < 3; pass++) {
          await nextFrame();
          await nextFrame();
          if (requestId !== focusSequence.current) return;
          if (!element.isConnected) throw new Error('Canvas unavailable');
          const currentTarget = canvasFocusTarget(latestDocument.current, nodeId);
          const rect = element.getBoundingClientRect();
          const viewportBounds = {
            left: Math.max(0, -rect.left),
            top: Math.max(0, -rect.top),
            right: Math.min(rect.width, window.innerWidth - rect.left),
            bottom: Math.min(rect.height, window.innerHeight - rect.top),
          };
          const obstacles = [
            ...document.querySelectorAll<HTMLElement>(
              '[data-project-chat-dock] section[role="dialog"], [data-canvas-focus-occluder], .polity-canvas-properties'
            ),
          ]
            .filter(
              panel =>
                !panel.hidden &&
                panel.getAttribute('aria-hidden') !== 'true' &&
                getComputedStyle(panel).visibility !== 'hidden'
            )
            .map(panel => {
              const bounds = panel.getBoundingClientRect();
              return {
                left: bounds.left - rect.left,
                top: bounds.top - rect.top,
                right: bounds.right - rect.left,
                bottom: bounds.bottom - rect.top,
              };
            });
          const free = freeCanvasRectangle(viewportBounds, obstacles);
          if (!free) throw new Error('No free canvas area');
          const layout = JSON.stringify(free);
          if (pass > 0 && layout === lastLayout) break;
          lastLayout = layout;
          const next = canvasFocusView(currentTarget.bounds, free, zoom);
          setZoom(next.zoom);
          setPan(next.pan);
        }
      },
      [props.document, props.selectExact, props.activateFrame, zoom]
    );

    useImperativeHandle(
      ref,
      () => ({
        scenePoint,
        execute: async command => {
          if (command.type === 'focus') return focusNode(command.nodeId);
          if (command.type === 'setTool') {
            if (textGesture.current) suppressTextClick.current = true;
            textGesture.current = null;
            setGesture(null);
            marqueeRef.current = null;
            setMarquee(null);
            panPointer.current = null;
            if (command.tool === 'text') {
              setEditing(null);
              setPendingTextEdit(null);
            }
            setActiveTool(command.tool);
            setToolLocked(command.locked ?? false);
            setRounded(command.rounded ?? false);
            return;
          }
          if (command.type === 'zoom') {
            if (command.mode === 'all' || command.mode === 'selection') fit(command.mode);
            else
              setZoom(current =>
                command.mode === 'reset'
                  ? 1
                  : Math.max(0.05, Math.min(4, current * (command.mode === 'in' ? 1.2 : 1 / 1.2)))
              );
            return;
          }
          if (command.type === 'clipboard') return void (await props.onClipboard?.(command.action));
          if (command.type === 'crop') {
            if (command.action === 'start') {
              if (props.selected.length === 1) await startCrop(props.selected[0]);
            } else finishCrop(command.action);
            return;
          }
          const found = paintOrder.find(
            node =>
              node.name.toLowerCase().includes(command.query.toLowerCase()) ||
              (node.type === 'richText' &&
                flattenText(node).toLowerCase().includes(command.query.toLowerCase()))
          );
          if (found) {
            props.selectExact?.([found.id]);
          }
        },
      }),
      [
        scenePoint,
        focusNode,
        fit,
        paintOrder,
        props.onClipboard,
        props.selectExact,
        props.selected,
        startCrop,
        finishCrop,
      ]
    );

    const beginTextEdit = (node: StudioNode) => {
      if (node.type !== 'richText' || !props.editable || node.locked || cropDraft) return;
      // Mount and focus the editor within the user gesture so mobile browsers open the keyboard.
      flushSync(() => {
        props.selectExact?.([node.id]);
        setPendingTextEdit(node.id);
      });
    };
    const finishTextEdit = () => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.closest('[data-slate-editor="true"]'))
        focused.blur();
      setPendingTextEdit(null);
      setEditing(null);
      host.current?.focus({ preventScroll: true });
    };
    const openNode = (node: StudioNode) => {
      if (node.type === 'richText') {
        if (props.selected.length > 1 || !['selection', 'text'].includes(activeTool)) return;
        beginTextEdit(node);
      }
      if (
        !cropDraft &&
        node.type === 'media' &&
        props.editable &&
        !node.locked &&
        (node.mediaType === 'image' || node.mediaType === 'video')
      ) {
        void startCrop(node.id);
      }
    };
    const selectNode = (id: string, shift: boolean) => {
      props.selectExact?.(canvasSelectionIds(props.document, props.selected, id, shift));
    };
    const clickNode = (
      node: StudioNode,
      event: Konva.KonvaEventObject<MouseEvent | TouchEvent>
    ) => {
      event.cancelBubble = true;
      if (
        !(event.evt.target instanceof HTMLCanvasElement) ||
        suppressTextClick.current ||
        spacePressedRef.current ||
        touchSuppressed.current
      )
        return;
      if (activeTool === 'eraser') props.onDeleteNodes?.([node.id]);
      else if (activeTool === 'selection' || (activeTool === 'text' && node.type === 'richText')) {
        activateNodeFrame(node);
        if (activeTool === 'text' && !node.locked && !event.evt.shiftKey) beginTextEdit(node);
        else selectNode(node.id, event.evt.shiftKey);
      }
    };

    const dragClientPoint = (event: MouseEvent | TouchEvent) =>
      'changedTouches' in event ? event.changedTouches[0] : event;
    const dragOptions = (driverId: string, clientX: number, clientY: number) => ({
      document: props.document,
      selected: props.selected.includes(driverId)
        ? props.selected
        : canvasSelectionIds(props.document, props.selected, driverId, false),
      stage: stage.current,
      driverId,
      clientX,
      clientY,
    });
    const beginDragPreview = (driverId: string, clientX: number, clientY: number) => {
      dragPreview.current = createStudioDragPreview(dragOptions(driverId, clientX, clientY));
      props.selectExact?.(dragPreview.current.selectedIds);
    };
    const updateDragPreview = (driverId: string, clientX: number, clientY: number) => {
      const preview = updateStudioDragPreview({
        ...dragOptions(driverId, clientX, clientY),
        preview: dragPreview.current,
        zoom,
      });
      dragPreview.current = preview;
      refreshContextToolbarBounds();
      return preview;
    };
    const clearDragPreview = () => {
      clearStudioDragPreview(stage.current, dragPreview.current);
      dragPreview.current = null;
    };

    useEffect(() => {
      const cancel = (event: Event) => {
        if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
        const preview = dragPreview.current;
        if (!preview) {
          return;
        }
        event.preventDefault();
        ignoredFollowerDrags.current.add(preview.driverId);
        stage.current?.findOne(`#${preview.driverId}`)?.stopDrag();
        clearStudioDragPreview(stage.current, preview);
        dragPreview.current = null;
        props.onNodeDragEnd?.(preview.driverId, preview.selectedIds, Number.NaN, Number.NaN);
      };
      window.addEventListener('pointercancel', cancel, true);
      window.addEventListener('keydown', cancel, true);
      window.addEventListener('blur', cancel);
      return () => {
        window.removeEventListener('pointercancel', cancel, true);
        window.removeEventListener('keydown', cancel, true);
        window.removeEventListener('blur', cancel);
      };
    }, [props.onNodeDragEnd]);

    const beginCropGesture = (
      nodeId: string,
      kind: 'pan' | CropHandle,
      clientX: number,
      clientY: number
    ) => {
      cropGesture.current = createStudioCropGesture({
        draft: cropDraft,
        stage: stage.current,
        nodeId,
        kind,
        clientX,
        clientY,
        zoom,
      });
    };

    const cropControls = (node: StudioNode) => {
      if (!cropDraft || cropDraft.nodeId !== node.id) return null;
      const { width, height } = cropDraft.state.frame;
      const size = Math.max(8, 12 / zoom);
      const handles: { kind: CropHandle; x: number; y: number }[] = [
        { kind: 'top-left', x: 0, y: 0 },
        { kind: 'top', x: width / 2, y: 0 },
        { kind: 'top-right', x: width, y: 0 },
        { kind: 'right', x: width, y: height / 2 },
        { kind: 'bottom-right', x: width, y: height },
        { kind: 'bottom', x: width / 2, y: height },
        { kind: 'bottom-left', x: 0, y: height },
        { kind: 'left', x: 0, y: height / 2 },
      ];
      return (
        <Group>
          <Rect
            width={width}
            height={height}
            fill="#6856c8"
            opacity={0.08}
            onPointerDown={event => {
              event.cancelBubble = true;
              beginCropGesture(node.id, 'pan', event.evt.clientX, event.evt.clientY);
            }}
          />
          <Rect
            width={width}
            height={height}
            stroke="#6856c8"
            strokeWidth={2 / zoom}
            listening={false}
          />
          {handles.map(handle => (
            <Rect
              key={handle.kind}
              x={handle.x - size / 2}
              y={handle.y - size / 2}
              width={size}
              height={size}
              fill="#ffffff"
              stroke="#6856c8"
              strokeWidth={2 / zoom}
              onPointerDown={event => {
                event.cancelBubble = true;
                beginCropGesture(node.id, handle.kind, event.evt.clientX, event.evt.clientY);
              }}
            />
          ))}
        </Group>
      );
    };

    const activateNodeFrame = (node: StudioNode) => {
      let parentId = node.type === 'frame' ? node.id : node.parentFrameId;
      let rootId: string | null = null;
      while (parentId) {
        rootId = parentId;
        parentId =
          props.document.nodes.find(candidate => candidate.id === parentId)?.parentFrameId ?? null;
      }
      if (rootId && rootId !== props.activeFrameId) props.activateFrame?.(rootId);
    };

    const masterFrame = props.document.masterLayout.frameId
      ? (props.document.nodes.find(
          node => node.id === props.document.masterLayout.frameId && node.type === 'frame'
        ) as FrameNode | undefined)
      : undefined;
    const frameBackground =
      props.document.frameDefaults.background ??
      props.document.theme[props.document.theme.mode].background;
    const renderMasterNode = (node: StudioNode): ReactNode => {
      const t = node.transform;
      return (
        <Group
          key={node.id}
          x={t.x + t.width / 2}
          y={t.y + t.height / 2}
          offsetX={t.width / 2}
          offsetY={t.height / 2}
          rotation={t.rotation}
          scaleX={t.flipX ? -1 : 1}
          scaleY={t.flipY ? -1 : 1}
          opacity={node.style.opacity}
          listening={false}
        >
          <NodeContent node={node} assets={props.assets} frameBackground={frameBackground} />
          {node.type === 'frame' && (
            <Group
              clipX={node.clipContent ? 0 : undefined}
              clipY={node.clipContent ? 0 : undefined}
              clipWidth={node.clipContent ? t.width : undefined}
              clipHeight={node.clipContent ? t.height : undefined}
            >
              {studioSceneChildren(props.document, node.id).map(renderMasterNode)}
            </Group>
          )}
        </Group>
      );
    };
    const renderMaster = (
      frame: FrameNode,
      placement: 'background' | 'foreground',
      part: 'lower' | 'upper'
    ): ReactNode => {
      if (!masterFrame || frame.parentFrameId !== null || frame.id === masterFrame.id) return null;
      if (placement === 'background' && part === 'upper') return null;
      if (placement === 'foreground' && part === 'lower' && editingNode) return null;
      const children = studioSceneChildren(props.document, masterFrame.id).filter(
        node => (props.document.masterLayout.placements[node.id] ?? 'foreground') === placement
      );
      return (
        <Group
          listening={false}
          scaleX={frame.transform.width / masterFrame.transform.width}
          scaleY={frame.transform.height / masterFrame.transform.height}
        >
          {children.map(renderMasterNode)}
        </Group>
      );
    };

    const renderTree = (parentId: string | null, part: 'lower' | 'upper'): ReactNode =>
      studioSceneChildren(props.document, parentId)
        .filter(
          node => parentId !== null || props.fit !== 'contain' || node.id === props.activeFrameId
        )
        .map(node => {
          const index = paintIndex.get(node.id) ?? -1;
          const showSelf = part === 'lower' ? index <= splitIndex : index > splitIndex;
          const hasChildren = node.type === 'frame';
          const renderedNode =
            cropDraft?.nodeId === node.id && node.type === 'media'
              ? {
                  ...node,
                  transform: cropDraft.state.frame,
                  crop: cropDraft.state.crop,
                  fit: cropDraft.state.fit,
                  focus: cropDraft.state.focus,
                }
              : node;
          const t = renderedNode.transform;
          const content = (
            <NodeContent
              node={renderedNode}
              assets={props.assets}
              frameBackground={frameBackground}
              cropEditing={cropDraft?.nodeId === node.id}
              theme={props.document.theme}
              introAnimate={!props.editable && node.id === props.activeFrameId}
              clockOffset={props.clockOffset}
            />
          );
          return (
            <Group
              key={node.id}
              data-action-id="communication-studio.canvas.node.select"
              data-action-kind="selection"
              id={showSelf ? node.id : undefined}
              x={t.x + t.width / 2}
              y={t.y + t.height / 2}
              offsetX={t.width / 2}
              offsetY={t.height / 2}
              rotation={t.rotation}
              scaleX={t.flipX ? -1 : 1}
              scaleY={t.flipY ? -1 : 1}
              opacity={node.style.opacity}
              draggable={
                showSelf &&
                props.editable &&
                activeTool === 'selection' &&
                !spacePressed &&
                !node.locked &&
                !editing &&
                !cropDraft &&
                (node.type !== 'frame' || props.selected.includes(node.id)) &&
                !props.selected.some(id => {
                  const selected = props.document.nodes.find(candidate => candidate.id === id);
                  return selected?.type === 'frame' && isDescendantOf(props.document, node, id);
                })
              }
              onPointerDown={event => {
                if (!(event.evt.target instanceof HTMLCanvasElement)) return;
                if (
                  activeTool === 'text' &&
                  node.type === 'richText' &&
                  props.editable &&
                  !cropDraft &&
                  !spacePressedRef.current &&
                  (event.evt.pointerType !== 'touch' || !touchSuppressed.current) &&
                  (event.evt.button === 0 || event.evt.pointerType === 'touch')
                ) {
                  if (textGesture.current) return;
                  textGesture.current = {
                    pointerId: event.evt.pointerId,
                    nodeId: node.id,
                    start: scenePoint(event.evt.clientX, event.evt.clientY),
                    clientX: event.evt.clientX,
                    clientY: event.evt.clientY,
                    shiftKey: event.evt.shiftKey,
                    active: false,
                  };
                  return;
                }
                if (
                  cropDraft?.nodeId !== node.id ||
                  (event.evt.pointerType === 'touch' && touchSuppressed.current)
                )
                  return;
                event.cancelBubble = true;
                beginCropGesture(node.id, 'pan', event.evt.clientX, event.evt.clientY);
              }}
              onClick={event => clickNode(node, event)}
              onTap={event => clickNode(node, event)}
              onDblClick={event => {
                event.cancelBubble = true;
                if (
                  !(event.evt.target instanceof HTMLCanvasElement) ||
                  suppressTextClick.current ||
                  spacePressedRef.current ||
                  event.evt.shiftKey ||
                  touchSuppressed.current
                ) {
                  return;
                } else {
                  openNode(node);
                }
              }}
              onDblTap={event => {
                event.cancelBubble = true;
                if (
                  !(event.evt.target instanceof HTMLCanvasElement) ||
                  suppressTextClick.current ||
                  spacePressedRef.current ||
                  event.evt.shiftKey ||
                  touchSuppressed.current
                ) {
                  return;
                } else {
                  openNode(node);
                }
              }}
              onDragStart={event => {
                if (event.target !== event.currentTarget || touchSuppressed.current) return;
                if (dragPreview.current && dragPreview.current.driverId !== node.id) {
                  ignoredFollowerDrags.current.add(node.id);
                  return;
                }
                ignoredFollowerDrags.current.delete(node.id);
                const point = dragClientPoint(event.evt);
                beginDragPreview(node.id, point.clientX, point.clientY);
              }}
              onDragMove={event => {
                if (event.target !== event.currentTarget) return;
                if (ignoredFollowerDrags.current.has(node.id)) return;
                if (touchSuppressed.current) {
                  return;
                }
                const point = dragClientPoint(event.evt);
                const preview = updateDragPreview(node.id, point.clientX, point.clientY);
                props.onNodeDragMove?.(node.id, preview.selectedIds, point.clientX, point.clientY);
              }}
              onDragEnd={event => {
                if (event.target !== event.currentTarget) return;
                if (ignoredFollowerDrags.current.has(node.id)) return;
                if (touchSuppressed.current) {
                  props.onNodeDragEnd?.(node.id, [node.id], Number.NaN, Number.NaN);
                  clearDragPreview();
                  event.target.position({ x: t.x + t.width / 2, y: t.y + t.height / 2 });
                  event.target.getLayer()?.batchDraw();
                  return;
                }
                const point = dragClientPoint(event.evt);
                const preview = updateDragPreview(node.id, point.clientX, point.clientY);
                const { selectedIds: chosen, roots, delta } = preview;
                const handled = props.onNodeDragEnd?.(
                  node.id,
                  chosen,
                  point.clientX,
                  point.clientY
                );
                clearDragPreview();
                if (handled) return;
                props.applyCanvasChanges?.(
                  roots.flatMap(id => {
                    const target = props.document.nodes.find(candidate => candidate.id === id);
                    return target
                      ? [
                          {
                            nodeId: id,
                            transform: {
                              dx: delta.x,
                              dy: delta.y,
                              width: target.transform.width,
                              height: target.transform.height,
                              rotation: target.transform.rotation,
                              flipX: target.transform.flipX,
                              flipY: target.transform.flipY,
                            },
                          },
                        ]
                      : [];
                  }),
                  { source: 'drag' }
                );
              }}
            >
              {showSelf &&
                (node.id === editing ? (
                  <Rect width={t.width} height={t.height} opacity={0} />
                ) : props.showCue && node.type !== 'frame' ? (
                  <Group id={`${node.id}-show`}>{content}</Group>
                ) : (
                  content
                ))}
              {showSelf && node.type === 'frame' && props.editable && (
                <Group>
                  {[
                    [0, 0, t.width, 0],
                    [t.width, 0, t.width, t.height],
                    [t.width, t.height, 0, t.height],
                    [0, t.height, 0, 0],
                  ].map((points, index) => (
                    <Line
                      key={index}
                      points={points}
                      stroke="#6856c8"
                      strokeWidth={1 / zoom}
                      hitStrokeWidth={Math.max(8, 10 / zoom)}
                      opacity={0.001}
                    />
                  ))}
                </Group>
              )}
              {showSelf && cropControls(node)}
              {hasChildren && (
                <Group
                  clipX={node.clipContent ? 0 : undefined}
                  clipY={node.clipContent ? 0 : undefined}
                  clipWidth={node.clipContent ? t.width : undefined}
                  clipHeight={node.clipContent ? t.height : undefined}
                >
                  {renderMaster(node, 'background', part)}
                  {renderTree(node.id, part)}
                  {renderMaster(node, 'foreground', part)}
                </Group>
              )}
            </Group>
          );
        });

    const activeFrame = props.document.nodes.find(
      (node): node is FrameNode => node.id === props.activeFrameId && node.type === 'frame'
    );
    const positionedChangeRequests = (props.changeRequestMarkers ?? []).flatMap(annotation => {
      const node = annotation.sourceDocument.nodes.find(item => item.id === annotation.nodeId);
      if (
        !node ||
        !node.visible ||
        (props.fit === 'contain' &&
          node.id !== props.activeFrameId &&
          !isDescendantOf(annotation.sourceDocument, node, props.activeFrameId))
      )
        return [];
      const bounds = worldBounds(annotation.sourceDocument, node);
      const left = bounds.left * zoom + pan.x;
      const top = bounds.top * zoom + pan.y;
      const right = bounds.right * zoom + pan.x;
      const bottom = bounds.bottom * zoom + pan.y;
      if (right < 0 || bottom < 0 || left > viewport.width || top > viewport.height) return [];
      return [
        {
          annotation,
          node,
          left,
          top,
          width: Math.max(8, right - left),
          height: Math.max(8, bottom - top),
          ghost: !props.document.nodes.some(item => item.id === annotation.nodeId),
        },
      ];
    });
    const inspectorAnchor = clampInspectorPosition(inspectorPosition.x, inspectorPosition.y);
    const inspectorOpensUp = inspectorAnchor.y + 22 > viewport.height / 2;
    const inspectorRoom = inspectorOpensUp
      ? inspectorAnchor.y + 44 - 16
      : viewport.height - inspectorAnchor.y - 16;
    return (
      <div
        ref={host}
        className="polity-canvas w-full overflow-hidden bg-[#f2f0ea]"
        style={props.fit === 'contain' ? { height: '100%' } : undefined}
        data-testid="studio-canvas"
        data-canvas-engine="konva"
        tabIndex={props.editable ? 0 : undefined}
        onDragOverCapture={event => {
          if (
            !props.editable ||
            !props.onElementSetDrop ||
            !event.dataTransfer.types.includes('application/x-polity-element-set')
          )
            return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDropCapture={event => {
          if (!props.editable || !props.onElementSetDrop) return;
          const setId = event.dataTransfer.getData('application/x-polity-element-set');
          if (!setId) return;
          event.preventDefault();
          event.stopPropagation();
          props.onElementSetDrop(setId, scenePoint(event.clientX, event.clientY));
        }}
        onKeyDownCapture={event => {
          const target = event.target as HTMLElement;
          if (cropDraft && event.key === 'Escape') {
            event.preventDefault();
            finishCrop('cancel');
            return;
          }
          if (cropDraft && event.key === 'Enter' && !target.closest('[role="toolbar"]')) {
            event.preventDefault();
            finishCrop('apply');
            return;
          }
          if (
            target.closest(
              'input,textarea,select,button,[role="toolbar"],[contenteditable="true"],.polity-canvas-properties'
            )
          )
            return;
          if (event.key === 'Escape') {
            if (textGesture.current) {
              event.preventDefault();
              textGesture.current = null;
              suppressTextClick.current = true;
              setGesture(null);
              return;
            }
            if (editing) finishTextEdit();
            else props.selectExact?.([]);
          }
          if (event.key === 'Enter' && selectedTextNode && props.editable) {
            event.preventDefault();
            beginTextEdit(selectedTextNode);
          }
        }}
      >
        <Stage
          ref={stage}
          width={viewport.width}
          height={viewport.height}
          x={pan.x}
          y={pan.y}
          scaleX={zoom}
          scaleY={zoom}
          onWheel={event => {
            if (!props.editable || props.fit === 'contain') return;
            if (
              event.evt.target instanceof Element &&
              event.evt.target.closest('input,textarea,select,[contenteditable="true"]')
            )
              return;
            event.evt.preventDefault();
            const factor =
              event.evt.deltaMode === WheelEvent.DOM_DELTA_LINE
                ? 16
                : event.evt.deltaMode === WheelEvent.DOM_DELTA_PAGE
                  ? viewport.height
                  : 1;
            const dx = event.evt.deltaX * factor;
            const dy = event.evt.deltaY * factor;
            if (event.evt.ctrlKey) {
              const bounds = (event.currentTarget as Konva.Stage)
                .container()
                .getBoundingClientRect();
              const anchor = {
                x: event.evt.clientX - bounds.left,
                y: event.evt.clientY - bounds.top,
              };
              const currentZoom = zoomRef.current;
              const nextZoom = Math.max(0.05, Math.min(4, currentZoom * Math.exp(-dy / 300)));
              const nextPan = {
                x: anchor.x - ((anchor.x - panRef.current.x) * nextZoom) / currentZoom,
                y: anchor.y - ((anchor.y - panRef.current.y) * nextZoom) / currentZoom,
              };
              zoomRef.current = nextZoom;
              panRef.current = nextPan;
              setZoom(nextZoom);
              setPan(nextPan);
            } else {
              const nextPan = { x: panRef.current.x - dx, y: panRef.current.y - dy };
              panRef.current = nextPan;
              setPan(nextPan);
            }
          }}
          onPointerDown={event => {
            if (!(event.evt.target instanceof HTMLCanvasElement)) return;
            suppressTextClick.current = false;
            if (textGesture.current && textGesture.current.pointerId !== event.evt.pointerId)
              return;
            if (!props.editable) return;
            if (event.evt.pointerType === 'touch' && touchSuppressed.current) return;
            if (event.evt.button !== 0 && event.evt.pointerType !== 'touch') return;
            if (cropDraft) {
              cropGesture.current = createStudioCropGesture({
                draft: cropDraft,
                stage: event.currentTarget as Konva.Stage,
                nodeId: cropDraft.nodeId,
                kind: 'pan',
                clientX: event.evt.clientX,
                clientY: event.evt.clientY,
                zoom,
                insideFrameOnly: true,
              });
              return;
            }
            const point = scenePoint(event.evt.clientX, event.evt.clientY);
            if (spacePressedRef.current || activeTool === 'hand') {
              panPointer.current = { x: event.evt.clientX, y: event.evt.clientY };
              setGesture({ mode: 'pan', start: point, end: point, points: [] });
              return;
            }
            if (activeTool === 'selection') {
              if (event.target === stage.current && !cropDraft) {
                const next = {
                  pointerId: event.evt.pointerId,
                  start: point,
                  end: point,
                  clientX: event.evt.clientX,
                  clientY: event.evt.clientY,
                  additive: event.evt.shiftKey,
                  previous: props.selected,
                  active: false,
                };
                marqueeRef.current = next;
                setMarquee(next);
                try {
                  (event.evt.target as HTMLCanvasElement).setPointerCapture(event.evt.pointerId);
                } catch {
                  /* Unavailable capture or a synthetic pointer has no active browser pointer. */
                }
              }
              return;
            }
            if (activeTool === 'eraser') return;
            if (activeTool === 'text') {
              textGesture.current ??= {
                pointerId: event.evt.pointerId,
                nodeId: null,
                start: point,
                clientX: event.evt.clientX,
                clientY: event.evt.clientY,
                shiftKey: event.evt.shiftKey,
                active: false,
              };
              if (textGesture.current.nodeId) return;
            }
            setGesture({ mode: 'tool', start: point, end: point, points: [[point.x, point.y]] });
          }}
          onPointerMove={event => {
            if (event.evt.pointerType === 'touch' && touchSuppressed.current) return;
            const point = scenePoint(event.evt.clientX, event.evt.clientY);
            props.cursor?.(point.x, point.y);
            const text = textGesture.current;
            if (text) {
              if (text.pointerId !== event.evt.pointerId) return;
              text.active ||=
                Math.hypot(event.evt.clientX - text.clientX, event.evt.clientY - text.clientY) >= 4;
              if (text.nodeId && !text.active) return;
              setGesture({
                mode: 'tool',
                start: text.start,
                end: point,
                points: [[text.start.x, text.start.y]],
              });
              return;
            }
            const selection = marqueeRef.current;
            if (selection && selection.pointerId === event.evt.pointerId) {
              const next = {
                ...selection,
                end: point,
                active:
                  Math.hypot(
                    event.evt.clientX - selection.clientX,
                    event.evt.clientY - selection.clientY
                  ) >= 4,
              };
              marqueeRef.current = next;
              setMarquee(next);
              return;
            }
            if (cropGesture.current) {
              const gesture = cropGesture.current;
              setCropDraft(current =>
                updateStudioCropGesture({
                  draft: current,
                  gesture,
                  stage: event.currentTarget as Konva.Stage,
                  clientX: event.evt.clientX,
                  clientY: event.evt.clientY,
                })
              );
              return;
            }
            if (!gesture) return;
            if (gesture.mode === 'pan') {
              const previous = panPointer.current;
              if (previous) {
                const nextPan = {
                  x: panRef.current.x + event.evt.clientX - previous.x,
                  y: panRef.current.y + event.evt.clientY - previous.y,
                };
                panRef.current = nextPan;
                setPan(nextPan);
              }
              panPointer.current = { x: event.evt.clientX, y: event.evt.clientY };
            }
            setGesture(current =>
              current
                ? {
                    ...current,
                    end: point,
                    points:
                      current.mode === 'tool' && (activeTool === 'draw' || activeTool === 'laser')
                        ? [...current.points, [point.x, point.y]]
                        : current.points,
                  }
                : null
            );
          }}
          onPointerUp={event => {
            // Konva also emits pointerup for a cancelled native pointer before React rerenders.
            if (event.evt.type === 'pointercancel' || event.evt.type === 'touchcancel') return;
            if (event.evt.pointerType === 'touch' && touchSuppressed.current) return;
            const text = textGesture.current;
            let creationGesture = gesture;
            if (text) {
              if (text.pointerId !== event.evt.pointerId) return;
              textGesture.current = null;
              suppressTextClick.current = true;
              text.active ||=
                Math.hypot(event.evt.clientX - text.clientX, event.evt.clientY - text.clientY) >= 4;
              if (text.nodeId && !text.active) {
                const node = props.document.nodes.find(candidate => candidate.id === text.nodeId);
                if (node?.type === 'richText') {
                  activateNodeFrame(node);
                  if (props.editable && !node.locked && !text.shiftKey) beginTextEdit(node);
                  else selectNode(node.id, text.shiftKey);
                }
                setGesture(null);
                return;
              }
              creationGesture = {
                mode: 'tool',
                start: text.start,
                end: scenePoint(event.evt.clientX, event.evt.clientY),
                points: [[text.start.x, text.start.y]],
              };
            }
            const selection = marqueeRef.current;
            if (selection && selection.pointerId === event.evt.pointerId) {
              const end = scenePoint(event.evt.clientX, event.evt.clientY);
              const active =
                Math.hypot(
                  event.evt.clientX - selection.clientX,
                  event.evt.clientY - selection.clientY
                ) >= 4;
              if (active) {
                const ids = canvasMarqueeSelectionIds(
                  props.document,
                  paintOrder.map(node => node.id),
                  { left: selection.start.x, top: selection.start.y, right: end.x, bottom: end.y },
                  selection.additive ? selection.previous : []
                );
                props.selectExact?.(ids);
              } else if (!selection.additive) props.selectExact?.([]);
              setEditing(null);
              marqueeRef.current = null;
              setMarquee(null);
              return;
            }
            if (cropGesture.current) {
              cropGesture.current = null;
              return;
            }
            if (!creationGesture) {
              if (
                event.evt.pointerType === 'touch' &&
                activeTool === 'selection' &&
                event.target === stage.current
              ) {
                props.selectExact?.([]);
                setEditing(null);
              }
              return;
            }
            const point = scenePoint(event.evt.clientX, event.evt.clientY);
            if (
              creationGesture.mode === 'tool' &&
              props.editable &&
              !['hand', 'selection', 'eraser', 'comment'].includes(activeTool)
            ) {
              const creation = creationGesture;
              const createNode = () => {
                const id = props.onCreateNode?.(
                  activeTool,
                  creation.start,
                  point,
                  rounded,
                  creation.points
                );
                if (id) {
                  if (activeTool === 'text') setPendingTextEdit(id);
                  props.selectExact?.([id]);
                  if (!toolLocked) setActiveTool('selection');
                }
              };
              if (activeTool === 'text') flushSync(createNode);
              else createNode();
            }
            setGesture(null);
            panPointer.current = null;
          }}
          onPointerCancel={event => {
            if (textGesture.current && textGesture.current.pointerId !== event.evt.pointerId)
              return;
            if (textGesture.current) suppressTextClick.current = true;
            textGesture.current = null;
            marqueeRef.current = null;
            setMarquee(null);
            setGesture(null);
            panPointer.current = null;
            cropGesture.current = null;
          }}
        >
          <Layer ref={lower}>
            {renderTree(null, 'lower')}
            {gesture?.mode === 'tool' && activeTool !== 'draw' && activeTool !== 'laser' && (
              <Rect
                x={Math.min(gesture.start.x, gesture.end.x)}
                y={Math.min(gesture.start.y, gesture.end.y)}
                width={Math.abs(gesture.end.x - gesture.start.x)}
                height={Math.abs(gesture.end.y - gesture.start.y)}
                stroke="#6856c8"
                dash={[8, 6]}
                listening={false}
              />
            )}
            {gesture?.mode === 'tool' && (activeTool === 'draw' || activeTool === 'laser') && (
              <Line
                points={gesture.points.flat()}
                stroke={activeTool === 'laser' ? '#F16A4A' : '#12362D'}
                strokeWidth={3}
                lineCap="round"
                listening={false}
              />
            )}
          </Layer>
          {editingNode && <Layer ref={upper}>{renderTree(null, 'upper')}</Layer>}
          {positionedChangeRequests.some(item => item.ghost) && (
            <Layer listening={false}>
              {positionedChangeRequests
                .filter(item => item.ghost)
                .map(item => (
                  <ChangeRequestGhost
                    key={item.annotation.id}
                    annotation={item.annotation}
                    node={item.node}
                    assets={props.assets}
                    frameBackground={frameBackground}
                  />
                ))}
            </Layer>
          )}
          <Layer ref={controls}>
            {marquee?.active && (
              <Rect
                x={Math.min(marquee.start.x, marquee.end.x)}
                y={Math.min(marquee.start.y, marquee.end.y)}
                width={Math.abs(marquee.end.x - marquee.start.x)}
                height={Math.abs(marquee.end.y - marquee.start.y)}
                fill="rgba(104, 86, 200, 0.12)"
                stroke="#6856c8"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                listening={false}
              />
            )}
            {props.guides && activeFrame && props.fit !== 'contain' && (
              <Rect
                x={activeFrame.transform.x + activeFrame.safeAreas.left}
                y={activeFrame.transform.y + activeFrame.safeAreas.top}
                width={
                  activeFrame.transform.width -
                  activeFrame.safeAreas.left -
                  activeFrame.safeAreas.right
                }
                height={
                  activeFrame.transform.height -
                  activeFrame.safeAreas.top -
                  activeFrame.safeAreas.bottom
                }
                stroke="#B88A3B"
                dash={[12, 12]}
                listening={false}
              />
            )}
            {props.selected.map(id => {
              const node = props.document.nodes.find(item => item.id === id);
              if (
                !node ||
                (!node.locked && props.editable) ||
                !paintOrder.some(item => item.id === id)
              )
                return null;
              const bounds = worldBounds(props.document, node);
              return (
                <Rect
                  key={`focus-outline:${id}`}
                  x={bounds.left}
                  y={bounds.top}
                  width={bounds.right - bounds.left}
                  height={bounds.bottom - bounds.top}
                  stroke="#6856c8"
                  strokeWidth={2 / zoom}
                  listening={false}
                />
              );
            })}
            {props.editable && !cropDraft && (
              <Transformer
                ref={transformer}
                rotateEnabled
                onTransform={refreshContextToolbarBounds}
                onTransformEnd={event => {
                  const items = (event.currentTarget as Konva.Transformer).nodes();
                  if (touchSuppressed.current) {
                    restoreStudioCanvasTransforms(props.document, items);
                    return;
                  }
                  const changes = collectStudioCanvasTransforms(props.document, items);
                  props.applyCanvasChanges?.(changes);
                }}
              />
            )}
            {props.peers
              ?.filter(peer => peer.cursor?.pageId === props.activeFrameId)
              .map((peer, index) => (
                <Group key={index} x={peer.cursor?.x} y={peer.cursor?.y} listening={false}>
                  <Ellipse radiusX={7} radiusY={7} fill={peer.user?.color ?? '#B88A3B'} />
                  <Text x={12} text={peer.user?.name ?? ''} fontSize={20} fill="#B88A3B" />
                </Group>
              ))}
          </Layer>
        </Stage>
        {frameLabels.map(({ frame, text }) => {
          const bounds = worldBounds(props.document, frame);
          return (
            <span
              key={frame.id}
              ref={element => {
                if (element) frameLabelElements.current.set(frame.id, element);
                else frameLabelElements.current.delete(frame.id);
              }}
              className="polity-canvas-frame-label"
              data-studio-frame-label={frame.id}
              title={text}
              style={{
                left: bounds.left * zoom + pan.x,
                top: bounds.top * zoom + pan.y - 6,
                maxWidth: Math.max(1, (bounds.right - bounds.left) * zoom),
              }}
            >
              {text}
            </span>
          );
        })}
        {positionedChangeRequests.map(({ annotation, left, top, width, height, ghost }) => {
          const colors = changeRequestOutlineColors(annotation.tone);
          return (
            <div
              key={annotation.id}
              className="pointer-events-none absolute rounded"
              data-change-request-tone={annotation.tone}
              data-change-request-ghost={ghost}
              data-change-request-selected={annotation.selected}
              data-testid={`studio-change-outline-${annotation.id}`}
              style={{
                left,
                top,
                width,
                height,
                zIndex: annotation.selected ? 21 : 20,
                border: `2px solid ${colors.border}`,
                boxShadow: `0 0 0 ${annotation.selected ? 4 : 3}px ${colors.glow}, 0 0 ${annotation.selected ? 22 : 16}px ${annotation.selected ? 5 : 3}px ${colors.border}`,
              }}
            >
              {annotation.tone === 'remove' && (
                <span
                  data-testid={`studio-change-strike-${annotation.id}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 left-0"
                  style={{
                    top: '50%',
                    borderTop: `3px solid ${colors.border}`,
                    boxShadow: `0 0 8px 2px ${colors.border}`,
                  }}
                />
              )}
              <CanvasChangeRequestMarker
                actionId="communication-studio.procedure.select-marker"
                displayId={annotation.proposalId.slice(0, 8)}
                label={annotation.label}
                title={annotation.label}
                tone={annotation.tone}
                selected={annotation.selected}
                positioningClassName="-top-3 -right-3"
                style={{}}
                onSelect={() => props.onChangeRequestSelect?.(annotation.proposalId)}
              />
            </div>
          );
        })}
        {props.changeRequestOverlay}
        {props.editable && !cropDraft && hasContextToolbar && contextToolbarBounds && (
          <div
            ref={contextToolbarRef}
            role="toolbar"
            aria-label={props.contextToolbarLabel ?? t('features.studio.elementActions')}
            data-testid="studio-context-toolbar"
            className="polity-canvas-context-toolbar"
            style={{
              left: Math.max(
                8,
                Math.min(
                  (contextToolbarBounds.left +
                    contextToolbarBounds.right -
                    contextToolbarSize.width) /
                    2,
                  viewport.width - contextToolbarSize.width - 8
                )
              ),
              top:
                contextToolbarBounds.top >= contextToolbarSize.height + 16
                  ? contextToolbarBounds.top - contextToolbarSize.height - 8
                  : Math.max(
                      8,
                      Math.min(
                        contextToolbarBounds.bottom + 8,
                        viewport.height - contextToolbarSize.height - 8
                      )
                    ),
            }}
            onPointerDown={event => event.stopPropagation()}
          >
            {selectedTextNode && (
              <button
                type="button"
                className="polity-canvas-text-edit-action"
                data-action-id="communication-studio.context.action.activate"
                data-context-action={editing ? 'finishTextEditing' : 'startTextEditing'}
                onClick={() => {
                  if (editing) finishTextEdit();
                  else beginTextEdit(selectedTextNode);
                }}
              >
                {t(`features.studio.${editing ? 'finishTextEditing' : 'startTextEditing'}`)}
              </button>
            )}
            {props.contextToolbar}
          </div>
        )}
        {editingNode &&
          portalTarget &&
          createPortal(
            <EditorPortal document={props.document} node={editingNode} zoom={zoom} pan={pan}>
              <div
                style={{
                  width: editingNode.transform.width,
                  minHeight: editingNode.transform.height,
                  pointerEvents: 'auto',
                }}
                onPointerDown={event => event.stopPropagation()}
                onKeyDown={event => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    finishTextEdit();
                  }
                }}
              >
                <StudioInlineTextEditor
                  node={editingNode}
                  onChange={content => props.onTextChange?.(editingNode.id, content)}
                  register={props.registerTextEditor ?? (() => undefined)}
                />
              </div>
            </EditorPortal>,
            portalTarget
          )}
        {cropLoading && (
          <div
            role="status"
            className="bg-background absolute bottom-5 left-1/2 z-[65] -translate-x-1/2 rounded p-3 shadow-lg"
          >
            {props.cropLabels?.loading ?? 'Loading media…'}
          </div>
        )}
        {cropError && (
          <div
            role="alert"
            className="bg-destructive text-destructive-foreground absolute bottom-5 left-1/2 z-[65] -translate-x-1/2 rounded p-3 shadow-lg"
          >
            {props.cropLabels?.failed ?? 'Media could not be loaded.'}
          </div>
        )}
        {cropDraft && (
          <div
            role="toolbar"
            aria-label={props.cropLabels?.crop ?? t('features.studio.cropMedia')}
            data-crop-x={cropDraft.state.crop.x}
            data-crop-width={cropDraft.state.crop.width}
            data-frame-width={cropDraft.state.frame.width}
            className="bg-background absolute bottom-4 left-1/2 z-[65] flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border p-2 shadow-lg"
          >
            <label className="flex items-center gap-2 text-sm">
              {props.cropLabels?.zoom ?? 'Zoom'}
              <input
                data-action-id="communication-studio.media.crop.zoom"
                type="range"
                min="0.5"
                max="8"
                step="0.05"
                value={cropDraft.zoom}
                onChange={event => {
                  const nextZoom = Number(event.target.value);
                  setCropDraft(
                    draft =>
                      draft && {
                        ...draft,
                        zoom: nextZoom,
                        state: zoomMediaCrop(draft.state, nextZoom / draft.zoom),
                      }
                  );
                }}
              />
            </label>
            <button
              data-action-id="communication-studio.media.crop.reset"
              type="button"
              className="rounded border px-2 py-1 text-sm"
              onClick={() => finishCrop('reset')}
            >
              {props.cropLabels?.reset ?? 'Reset'}
            </button>
            <button
              data-action-id="communication-studio.media.crop.cancel"
              type="button"
              className="rounded border px-2 py-1 text-sm"
              onClick={() => finishCrop('cancel')}
            >
              {props.cropLabels?.cancel ?? 'Cancel'}
            </button>
            <button
              data-action-id="communication-studio.media.crop.apply"
              type="button"
              className="bg-primary text-primary-foreground rounded px-2 py-1 text-sm"
              onClick={() => finishCrop('apply')}
            >
              {props.cropLabels?.apply ?? 'Apply'}
            </button>
          </div>
        )}
        {props.editable && !cropDraft && props.inspector && props.selected.length > 0 && (
          <aside
            ref={inspectorPanel}
            className="polity-canvas-properties"
            data-collapsed={inspectorCollapsed}
            data-expand-direction={inspectorOpensUp ? 'up' : 'down'}
            aria-label={props.inspectorLabels?.title ?? t('features.studio.elementProperties')}
            style={{
              left: inspectorAnchor.x,
              top: inspectorAnchor.y,
              maxHeight: `min(50vh, ${Math.max(44, inspectorRoom)}px)`,
            }}
          >
            <div className="polity-canvas-properties-header">
              <button
                data-action-id="communication-studio.inspector.position.move"
                data-action-kind="interaction"
                type="button"
                className="polity-canvas-properties-drag-handle"
                aria-label={props.inspectorLabels?.move ?? t('features.studio.moveProperties')}
                onPointerDown={event => {
                  if (event.button !== 0) return;
                  inspectorDrag.current = {
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    x: inspectorAnchor.x,
                    y: inspectorAnchor.y,
                  };
                  event.stopPropagation();
                }}
                onKeyDown={event => {
                  const directions: Record<string, [number, number]> = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, -1],
                    ArrowDown: [0, 1],
                  };
                  const direction = directions[event.key];
                  if (!direction) {
                    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  const step = event.shiftKey ? 20 : 10;
                  setInspectorPosition(
                    clampInspectorPosition(
                      inspectorAnchor.x + direction[0] * step,
                      inspectorAnchor.y + direction[1] * step
                    )
                  );
                }}
              >
                <span aria-hidden="true">⠿</span>
                <span>
                  {props.inspectorLabels?.title ?? t('features.studio.elementProperties')}
                </span>
              </button>
              <button
                data-action-id="communication-studio.inspector.visibility.toggle"
                data-action-kind="selection"
                type="button"
                className="polity-canvas-properties-toggle"
                aria-controls={inspectorBodyId}
                aria-expanded={!inspectorCollapsed}
                aria-label={
                  inspectorCollapsed
                    ? (props.inspectorLabels?.expand ?? t('features.studio.expandProperties'))
                    : (props.inspectorLabels?.collapse ?? t('features.studio.collapseProperties'))
                }
                onClick={() => setInspectorCollapsed(value => !value)}
              >
                <span aria-hidden="true">{inspectorCollapsed ? '▾' : '▴'}</span>
              </button>
            </div>
            <div
              id={inspectorBodyId}
              className="polity-canvas-properties-body"
              hidden={inspectorCollapsed}
            >
              {props.inspector}
            </div>
          </aside>
        )}
      </div>
    );
  }
);

export default KonvaStudioCanvas;
