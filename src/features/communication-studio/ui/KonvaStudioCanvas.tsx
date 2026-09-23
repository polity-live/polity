import './studio-fonts.css';
import './studio-canvas.css';
import { createPortal } from 'react-dom';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
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
import type Konva from 'konva';
import type { StudioAsset } from '../hooks/useStudioDocument';
import type {
  StudioDocumentV3,
  StudioNode,
  RichTextNode,
  StudioPlateElement,
  FrameNode,
} from '../logic/document-v3';
import { studioSceneChildren, studioScenePaintOrder } from '../logic/studio-scene';
import { paintStudioRichText } from '../logic/rich-text-paint';
import { isDescendantOf, worldBounds, worldMatrix, type Bounds } from '../logic/selection-geometry';
import { canvasMarqueeSelectionIds, canvasSelectionIds } from '../logic/studio-selection';
import { drawStudioElement } from '../logic/draw-element';
import { semanticElement } from '../logic/v3-adapter';
import type { StudioMediaCrop } from '../logic/document';
import {
  initialMediaCrop,
  panMediaCrop,
  resizeMediaCrop,
  studioMediaGeometry,
  zoomMediaCrop,
  type CropHandle,
  type MediaCropState,
} from '../logic/studio-crop';
import type { StudioTextSelectionEditor } from './StudioTextEditor';
import { StudioInlineTextEditor } from './StudioInlineTextEditor';
import type { StudioTool } from '../state/studio-viewport-store';

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

export interface StudioCanvasState {
  activeTool: StudioTool;
  toolLocked: boolean;
  zoom: number;
  viewBounds: Bounds | null;
}

export type StudioCanvasCommand =
  | { type: 'setTool'; tool: StudioTool; locked?: boolean; rounded?: boolean }
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
  document: StudioDocumentV3;
  activeFrameId: string;
  assets: StudioAsset[];
  selected: string[];
  selectExact?: (ids: string[]) => void;
  applyCanvasChanges?: (changes: StudioCanvasNodeChange[]) => void;
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
    let cancelled = false;
    if (node.mediaType === 'video') {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = url;
      video.muted = true;
      video.preload = 'auto';
      video.onloadeddata = () => {
        if (!cancelled) setImage(video);
      };
      video.onseeked = () => rendered.current?.getLayer()?.batchDraw();
      return () => {
        cancelled = true;
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
    }
    const next = new window.Image();
    next.crossOrigin = 'anonymous';
    next.onload = () => {
      if (!cancelled) setImage(next);
    };
    next.src = url;
    return () => {
      cancelled = true;
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
}: {
  node: StudioNode;
  assets: StudioAsset[];
  frameBackground: string;
  cropEditing?: boolean;
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
    const element = semanticElement(node);
    return element ? (
      <Shape
        width={width}
        height={height}
        fill="#000000"
        sceneFunc={context =>
          drawStudioElement(
            (context as unknown as { _context: CanvasRenderingContext2D })._context,
            { ...element, x: 0, y: 0, rotation: 0, opacity: 1 }
          )
        }
        hitFunc={(context, item) => {
          context.beginPath();
          context.rect(0, 0, width, height);
          context.fillStrokeShape(item);
        }}
      />
    ) : null;
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
  const ancestors: StudioNode[] = [];
  let parentId = node.parentFrameId;
  while (parentId) {
    const parent = document.nodes.find(candidate => candidate.id === parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    parentId = parent.parentFrameId;
  }
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

const KonvaStudioCanvas = forwardRef<StudioCanvasHandle, Props>(
  function KonvaStudioCanvas(props, ref) {
    const host = useRef<HTMLDivElement>(null);
    const stage = useRef<Konva.Stage>(null);
    const lower = useRef<Konva.Layer>(null);
    const upper = useRef<Konva.Layer>(null);
    const controls = useRef<Konva.Layer>(null);
    const transformer = useRef<Konva.Transformer>(null);
    const [viewport, setViewport] = useState({ width: 1, height: 1 });
    const initialFit = useRef(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [activeTool, setActiveTool] = useState<StudioTool>('selection');
    const [toolLocked, setToolLocked] = useState(false);
    const [rounded, setRounded] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const pendingTextEdit = useRef<string | null>(null);
    const contextToolbarRef = useRef<HTMLDivElement>(null);
    const [contextToolbarSize, setContextToolbarSize] = useState({ width: 0, height: 0 });
    const [contextToolbarBounds, setContextToolbarBounds] = useState<Bounds | null>(null);
    const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
    const [inspectorPosition, setInspectorPosition] = useState({ x: 16, y: 16 });
    const inspectorPanel = useRef<HTMLElement>(null);
    const inspectorDrag = useRef<{
      pointerId: number;
      clientX: number;
      clientY: number;
      x: number;
      y: number;
    } | null>(null);
    const inspectorBodyId = useId();
    const [cropDraft, setCropDraft] = useState<{
      nodeId: string;
      state: MediaCropState;
      zoom: number;
    } | null>(null);
    const [cropLoading, setCropLoading] = useState(false);
    const [cropError, setCropError] = useState(false);
    const cropGesture = useRef<{
      nodeId: string;
      kind: 'pan' | CropHandle;
      start: { x: number; y: number };
      inverse: Konva.Transform;
      initial: MediaCropState;
    } | null>(null);
    const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
    const [gesture, setGesture] = useState<{
      mode: 'pan' | 'tool';
      start: { x: number; y: number };
      end: { x: number; y: number };
      points: [number, number][];
    } | null>(null);
    const [marquee, setMarquee] = useState<{
      pointerId: number;
      start: { x: number; y: number };
      end: { x: number; y: number };
      clientX: number;
      clientY: number;
      additive: boolean;
      previous: string[];
      active: boolean;
    } | null>(null);
    const marqueeRef = useRef(marquee);
    marqueeRef.current = marquee;
    const dragPreview = useRef<{
      driverId: string;
      selectedIds: string[];
      roots: string[];
      origins: Map<string, { x: number; y: number }>;
      disabledFollowers: Map<string, boolean>;
      startClientX: number;
      startClientY: number;
      initialDelta: { x: number; y: number };
      delta: { x: number; y: number };
    } | null>(null);
    const ignoredFollowerDrags = useRef(new Set<string>());
    const [spacePressed, setSpacePressed] = useState(false);
    const spacePressedRef = useRef(false);
    const touchSuppressed = useRef(false);
    const touchGesture = useRef<{ center: { x: number; y: number }; distance: number } | null>(
      null
    );
    const touchResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const panPointer = useRef<{ x: number; y: number } | null>(null);
    const panRef = useRef(pan);
    const zoomRef = useRef(zoom);
    panRef.current = pan;
    zoomRef.current = zoom;
    useEffect(() => {
      if (!marquee) return;
      const cancel = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || !marqueeRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        marqueeRef.current = null;
        setMarquee(null);
      };
      window.addEventListener('keydown', cancel, true);
      return () => window.removeEventListener('keydown', cancel, true);
    }, [!!marquee]);
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
    const editingNode = props.document.nodes.find(
      node => node.id === editing && node.type === 'richText'
    ) as RichTextNode | undefined;
    const splitIndex = editingNode ? (paintIndex.get(editingNode.id) ?? -1) : Infinity;
    const refreshContextToolbarBounds = useCallback(() => {
      const stageNode = stage.current;
      if (!stageNode || !props.contextToolbar || !props.selected.length) {
        setContextToolbarBounds(null);
        return;
      }
      const rectangles = props.selected.flatMap(id => {
        const rendered = stageNode.findOne(`#${id}`);
        if (!rendered) return [];
        const rect = rendered.getClientRect({ relativeTo: stageNode, skipStroke: true });
        return Number.isFinite(rect.x) && Number.isFinite(rect.y) ? [rect] : [];
      });
      if (!rectangles.length) {
        setContextToolbarBounds(null);
        return;
      }
      const next = {
        left: Math.min(...rectangles.map(rect => rect.x)) * zoom + pan.x,
        top: Math.min(...rectangles.map(rect => rect.y)) * zoom + pan.y,
        right: Math.max(...rectangles.map(rect => rect.x + rect.width)) * zoom + pan.x,
        bottom: Math.max(...rectangles.map(rect => rect.y + rect.height)) * zoom + pan.y,
      };
      setContextToolbarBounds(current =>
        current &&
        Object.keys(next).every(key => current[key as keyof Bounds] === next[key as keyof Bounds])
          ? current
          : next
      );
    }, [props.contextToolbar, props.selected, pan.x, pan.y, zoom]);
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
    }, [props.contextToolbar, contextToolbarBounds]);

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
      const content = stage.current?.content;
      if (!content) return;
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
          if (event.touches.length === 1 && !touchGesture.current) touchSuppressed.current = false;
          return;
        }
        event.preventDefault();
        touchSuppressed.current = true;
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
    useEffect(() => {
      if (pendingTextEdit.current === editing && !editingNode) return;
      if (pendingTextEdit.current === editing && editingNode) pendingTextEdit.current = null;
      if (!editingNode || !props.editable || !props.selected.includes(editingNode.id))
        setEditing(null);
    }, [editingNode, props.editable, props.selected]);
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
      const lowerCanvas = lower.current?.getCanvas()._canvas;
      const upperCanvas = upper.current?.getCanvas()._canvas;
      const controlsCanvas = controls.current?.getCanvas()._canvas;
      for (const canvas of [lowerCanvas, upperCanvas, controlsCanvas]) {
        if (canvas)
          canvas.style.touchAction = props.editable && props.fit !== 'contain' ? 'none' : '';
      }
      if (lowerCanvas) lowerCanvas.style.zIndex = '0';
      if (upperCanvas) {
        upperCanvas.style.zIndex = '2';
        upperCanvas.style.pointerEvents = editingNode ? 'none' : 'auto';
      }
      if (controlsCanvas) {
        controlsCanvas.style.zIndex = '3';
        controlsCanvas.style.pointerEvents = editingNode ? 'none' : 'auto';
      }
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
        const next = Math.max(
          0.05,
          Math.min(
            4,
            (viewport.width - 64) / Math.max(1, right - left),
            (viewport.height - 64) / Math.max(1, bottom - top)
          )
        );
        setZoom(next);
        setPan({
          x: (viewport.width - (left + right) * next) / 2,
          y: (viewport.height - (top + bottom) * next) / 2,
        });
      },
      [paintOrder, props.document, props.selected, viewport]
    );

    const fitRef = useRef(fit);
    fitRef.current = fit;

    useEffect(() => {
      if (viewport.width <= 1 || viewport.height <= 1) return;
      if (props.fit === 'contain') fitRef.current('all');
      else if (!initialFit.current) {
        initialFit.current = true;
        fitRef.current('all');
      }
    }, [props.fit, props.activeFrameId, viewport.width, viewport.height]);

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

    useImperativeHandle(
      ref,
      () => ({
        scenePoint,
        execute: async command => {
          if (command.type === 'setTool') {
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
          if (command.type === 'search') {
            const found = paintOrder.find(
              node =>
                node.name.toLowerCase().includes(command.query.toLowerCase()) ||
                (node.type === 'richText' &&
                  flattenText(node).toLowerCase().includes(command.query.toLowerCase()))
            );
            if (found) props.selectExact?.([found.id]);
          }
        },
      }),
      [
        scenePoint,
        fit,
        paintOrder,
        props.onClipboard,
        props.selectExact,
        props.selected,
        startCrop,
        finishCrop,
      ]
    );

    const selectNode = (id: string, shift: boolean) => {
      props.selectExact?.(canvasSelectionIds(props.document, props.selected, id, shift));
    };

    const beginDragPreview = (driverId: string, clientX: number, clientY: number) => {
      const selectedIds = props.selected.includes(driverId) ? props.selected : [driverId];
      const editableIds = selectedIds.filter(id => {
        const node = props.document.nodes.find(candidate => candidate.id === id);
        return node && !node.locked;
      });
      const roots = editableIds.filter(id => {
        const node = props.document.nodes.find(candidate => candidate.id === id);
        return (
          node &&
          !editableIds.some(parentId => {
            const parent = props.document.nodes.find(candidate => candidate.id === parentId);
            return parent?.type === 'frame' && isDescendantOf(props.document, node, parentId);
          })
        );
      });
      const origins = new Map(
        [...new Set([...roots, driverId])].flatMap(id => {
          const node = props.document.nodes.find(candidate => candidate.id === id);
          return node
            ? [
                [
                  id,
                  {
                    x: node.transform.x + node.transform.width / 2,
                    y: node.transform.y + node.transform.height / 2,
                  },
                ] as const,
              ]
            : [];
        })
      );
      const driver = props.document.nodes.find(candidate => candidate.id === driverId);
      const rendered = stage.current?.findOne(`#${driverId}`);
      const origin = origins.get(driverId);
      const parent = driver?.parentFrameId
        ? props.document.nodes.find(candidate => candidate.id === driver.parentFrameId)
        : null;
      const [a, b, c, d] = parent ? worldMatrix(props.document, parent) : [1, 0, 0, 1, 0, 0];
      const localX = rendered && origin ? rendered.x() - origin.x : 0;
      const localY = rendered && origin ? rendered.y() - origin.y : 0;
      const disabledFollowers = new Map<string, boolean>();
      for (const id of roots) {
        if (id === driverId) continue;
        const follower = stage.current?.findOne(`#${id}`);
        if (!follower) continue;
        disabledFollowers.set(id, follower.draggable());
        follower.draggable(false);
      }
      dragPreview.current = {
        driverId,
        selectedIds,
        roots,
        origins,
        disabledFollowers,
        startClientX: clientX,
        startClientY: clientY,
        initialDelta: { x: a * localX + c * localY, y: b * localX + d * localY },
        delta: { x: 0, y: 0 },
      };
    };

    const updateDragPreview = (driverId: string, clientX: number, clientY: number) => {
      if (dragPreview.current?.driverId !== driverId) beginDragPreview(driverId, clientX, clientY);
      const preview = dragPreview.current;
      if (!preview) return;
      const delta = {
        x: preview.initialDelta.x + (clientX - preview.startClientX) / zoom,
        y: preview.initialDelta.y + (clientY - preview.startClientY) / zoom,
      };
      preview.delta = delta;
      for (const id of preview.roots) {
        if (id === driverId) continue;
        const node = props.document.nodes.find(candidate => candidate.id === id);
        const rendered = stage.current?.findOne(`#${id}`);
        const origin = preview.origins.get(id);
        if (!node || !rendered || !origin) continue;
        const parent = node.parentFrameId
          ? props.document.nodes.find(candidate => candidate.id === node.parentFrameId)
          : null;
        const [a, b, c, d] = parent ? worldMatrix(props.document, parent) : [1, 0, 0, 1, 0, 0];
        const determinant = a * d - b * c;
        if (Math.abs(determinant) < 1e-8) continue;
        rendered.position({
          x: origin.x + (d * delta.x - c * delta.y) / determinant,
          y: origin.y + (-b * delta.x + a * delta.y) / determinant,
        });
        rendered.getLayer()?.batchDraw();
      }
      if (!preview.roots.includes(driverId)) {
        const driver = stage.current?.findOne(`#${driverId}`);
        const origin = preview.origins.get(driverId);
        if (driver && origin) driver.position(origin);
      }
      refreshContextToolbarBounds();
    };

    const clearDragPreview = () => {
      const preview = dragPreview.current;
      if (!preview) return;
      for (const [id, draggable] of preview.disabledFollowers) {
        stage.current?.findOne(`#${id}`)?.draggable(draggable);
      }
      for (const [id, origin] of preview.origins) {
        const rendered = stage.current?.findOne(`#${id}`);
        rendered?.position(origin);
        rendered?.getLayer()?.draw();
      }
      dragPreview.current = null;
    };

    const beginCropGesture = (
      nodeId: string,
      kind: 'pan' | CropHandle,
      clientX: number,
      clientY: number
    ) => {
      if (!cropDraft || cropDraft.nodeId !== nodeId) return;
      const stageNode = stage.current;
      const group = stageNode?.findOne(`#${nodeId}`);
      if (!stageNode || !group) return;
      const bounds = stageNode.container().getBoundingClientRect();
      const point = {
        x: ((clientX - bounds.left) * stageNode.width()) / bounds.width,
        y: ((clientY - bounds.top) * stageNode.height()) / bounds.height,
      };
      const inverse = group.getAbsoluteTransform(stageNode).copy().invert();
      const local = inverse.point(point);
      let resolvedKind = kind;
      if (kind === 'pan') {
        const threshold = Math.max(5, 12 / zoom);
        const horizontal =
          local.x <= threshold
            ? 'left'
            : local.x >= cropDraft.state.frame.width - threshold
              ? 'right'
              : '';
        const vertical =
          local.y <= threshold
            ? 'top'
            : local.y >= cropDraft.state.frame.height - threshold
              ? 'bottom'
              : '';
        resolvedKind =
          horizontal && vertical
            ? (`${vertical}-${horizontal}` as CropHandle)
            : ((horizontal || vertical || 'pan') as CropHandle | 'pan');
      }
      cropGesture.current = {
        nodeId,
        kind: resolvedKind,
        start: local,
        inverse,
        initial: cropDraft.state,
      };
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
      if (placement === 'foreground' && part === 'upper' && !editingNode) return null;
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
          return (
            <Group
              key={node.id}
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
                if (
                  cropDraft?.nodeId !== node.id ||
                  (event.evt.pointerType === 'touch' && touchSuppressed.current)
                )
                  return;
                event.cancelBubble = true;
                beginCropGesture(node.id, 'pan', event.evt.clientX, event.evt.clientY);
              }}
              onClick={event => {
                event.cancelBubble = true;
                if (spacePressedRef.current || touchSuppressed.current) return;
                if (activeTool === 'eraser') props.onDeleteNodes?.([node.id]);
                else if (activeTool === 'selection') {
                  activateNodeFrame(node);
                  selectNode(node.id, event.evt.shiftKey);
                }
              }}
              onDblClick={event => {
                event.cancelBubble = true;
                if (spacePressedRef.current || touchSuppressed.current) return;
                if (node.type === 'richText' && props.editable && !node.locked) {
                  props.selectExact?.([node.id]);
                  setEditing(node.id);
                }
                if (
                  !cropDraft &&
                  node.type === 'media' &&
                  props.editable &&
                  !node.locked &&
                  (node.mediaType === 'image' || node.mediaType === 'video')
                )
                  void startCrop(node.id);
              }}
              onDblTap={() => {
                if (touchSuppressed.current) return;
                if (node.type === 'richText' && props.editable && !node.locked) {
                  props.selectExact?.([node.id]);
                  setEditing(node.id);
                }
                if (
                  !cropDraft &&
                  node.type === 'media' &&
                  props.editable &&
                  !node.locked &&
                  (node.mediaType === 'image' || node.mediaType === 'video')
                )
                  void startCrop(node.id);
              }}
              onDragStart={event => {
                if (event.target !== event.currentTarget || touchSuppressed.current) return;
                if (dragPreview.current && dragPreview.current.driverId !== node.id) {
                  ignoredFollowerDrags.current.add(node.id);
                  return;
                }
                ignoredFollowerDrags.current.delete(node.id);
                beginDragPreview(node.id, event.evt.clientX, event.evt.clientY);
              }}
              onDragMove={event => {
                if (event.target !== event.currentTarget) return;
                if (ignoredFollowerDrags.current.has(node.id)) return;
                if (touchSuppressed.current) return;
                updateDragPreview(node.id, event.evt.clientX, event.evt.clientY);
                props.onNodeDragMove?.(
                  node.id,
                  dragPreview.current?.selectedIds ?? [node.id],
                  event.evt.clientX,
                  event.evt.clientY
                );
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
                if (!dragPreview.current)
                  beginDragPreview(node.id, event.evt.clientX, event.evt.clientY);
                updateDragPreview(node.id, event.evt.clientX, event.evt.clientY);
                const preview = dragPreview.current;
                const chosen = preview?.selectedIds ?? [node.id];
                const roots = preview?.roots ?? [node.id];
                const delta = preview?.delta ?? { x: 0, y: 0 };
                const handled = props.onNodeDragEnd?.(
                  node.id,
                  chosen,
                  event.evt.clientX,
                  event.evt.clientY
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
                  })
                );
              }}
            >
              {showSelf &&
                (node.id === editing ? (
                  <Rect width={t.width} height={t.height} opacity={0} />
                ) : (
                  <NodeContent
                    node={renderedNode}
                    assets={props.assets}
                    frameBackground={frameBackground}
                    cropEditing={cropDraft?.nodeId === node.id}
                  />
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
            if (marqueeRef.current) {
              event.preventDefault();
              marqueeRef.current = null;
              setMarquee(null);
              return;
            }
            setEditing(null);
            props.selectExact?.([]);
          }
          if (
            event.key === 'Enter' &&
            props.selected.length === 1 &&
            props.document.nodes.find(node => node.id === props.selected[0])?.type === 'richText'
          )
            setEditing(props.selected[0]);
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
              const bounds = stage.current?.container().getBoundingClientRect();
              if (!bounds) return;
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
            if (!props.editable) return;
            if (event.evt.pointerType === 'touch' && touchSuppressed.current) return;
            if (event.evt.button !== 0 && event.evt.pointerType !== 'touch') return;
            if (cropDraft) {
              const stageNode = stage.current;
              const group = stageNode?.findOne(`#${cropDraft.nodeId}`);
              if (stageNode && group) {
                const bounds = stageNode.container().getBoundingClientRect();
                const local = group
                  .getAbsoluteTransform(stageNode)
                  .copy()
                  .invert()
                  .point({
                    x: ((event.evt.clientX - bounds.left) * stageNode.width()) / bounds.width,
                    y: ((event.evt.clientY - bounds.top) * stageNode.height()) / bounds.height,
                  });
                const { width, height } = cropDraft.state.frame;
                if (local.x >= -5 && local.x <= width + 5 && local.y >= -5 && local.y <= height + 5)
                  beginCropGesture(cropDraft.nodeId, 'pan', event.evt.clientX, event.evt.clientY);
              }
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
                const target = event.evt.target;
                if (target instanceof Element && 'setPointerCapture' in target) {
                  try {
                    target.setPointerCapture(event.evt.pointerId);
                  } catch {
                    /* Synthetic pointer events have no active browser pointer. */
                  }
                }
              }
              return;
            }
            if (activeTool === 'eraser') return;
            setGesture({ mode: 'tool', start: point, end: point, points: [[point.x, point.y]] });
          }}
          onPointerMove={event => {
            if (event.evt.pointerType === 'touch' && touchSuppressed.current) return;
            const point = scenePoint(event.evt.clientX, event.evt.clientY);
            props.cursor?.(point.x, point.y);
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
              const stageNode = stage.current;
              if (stageNode) {
                const bounds = stageNode.container().getBoundingClientRect();
                const local = gesture.inverse.point({
                  x: ((event.evt.clientX - bounds.left) * stageNode.width()) / bounds.width,
                  y: ((event.evt.clientY - bounds.top) * stageNode.height()) / bounds.height,
                });
                const dx = local.x - gesture.start.x;
                const dy = local.y - gesture.start.y;
                const state =
                  gesture.kind === 'pan'
                    ? panMediaCrop(gesture.initial, dx, dy)
                    : resizeMediaCrop(gesture.initial, gesture.kind, dx, dy);
                setCropDraft(current =>
                  current?.nodeId === gesture.nodeId ? { ...current, state } : current
                );
              }
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
            if (event.evt.pointerType === 'touch' && touchSuppressed.current) return;
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
            if (!gesture) {
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
              gesture.mode === 'tool' &&
              props.editable &&
              !['hand', 'selection', 'eraser', 'comment'].includes(activeTool)
            ) {
              const id = props.onCreateNode?.(
                activeTool,
                gesture.start,
                point,
                rounded,
                gesture.points
              );
              if (id) {
                props.selectExact?.([id]);
                if (activeTool === 'text') setEditing(id);
                if (activeTool === 'text') pendingTextEdit.current = id;
                if (!toolLocked) setActiveTool('selection');
              }
            }
            setGesture(null);
            panPointer.current = null;
          }}
          onPointerCancel={() => {
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
            {props.editable && !cropDraft && (
              <Transformer
                ref={transformer}
                rotateEnabled
                onTransform={refreshContextToolbarBounds}
                onTransformEnd={() => {
                  if (touchSuppressed.current) {
                    transformer.current?.nodes().forEach(item => {
                      const source = props.document.nodes.find(node => node.id === item.id());
                      if (!source) return;
                      item.position({
                        x: source.transform.x + source.transform.width / 2,
                        y: source.transform.y + source.transform.height / 2,
                      });
                      item.rotation(source.transform.rotation);
                      item.scale({
                        x: source.transform.flipX ? -1 : 1,
                        y: source.transform.flipY ? -1 : 1,
                      });
                      item.getLayer()?.batchDraw();
                    });
                    return;
                  }
                  const changes: StudioCanvasNodeChange[] = (
                    transformer.current?.nodes() ?? []
                  ).flatMap(item => {
                    const source = props.document.nodes.find(node => node.id === item.id());
                    if (!source) return [];
                    const parent = props.document.nodes.find(
                      node => node.id === source.parentFrameId
                    );
                    const [a, b, c, d] = parent
                      ? worldMatrix(props.document, parent)
                      : [1, 0, 0, 1, 0, 0];
                    const localDx = item.x() - (source.transform.x + source.transform.width / 2);
                    const localDy = item.y() - (source.transform.y + source.transform.height / 2);
                    const width = Math.max(1, source.transform.width * Math.abs(item.scaleX()));
                    const height = Math.max(1, source.transform.height * Math.abs(item.scaleY()));
                    item.scaleX(1);
                    item.scaleY(1);
                    return [
                      {
                        nodeId: source.id,
                        transform: {
                          dx: a * localDx + c * localDy,
                          dy: b * localDx + d * localDy,
                          width,
                          height,
                          rotation: item.rotation(),
                          flipX: source.transform.flipX,
                          flipY: source.transform.flipY,
                        },
                      },
                    ];
                  });
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
        {props.editable && !cropDraft && props.contextToolbar && contextToolbarBounds && (
          <div
            ref={contextToolbarRef}
            role="toolbar"
            aria-label={props.contextToolbarLabel ?? 'Element actions'}
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
                    setEditing(null);
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
            aria-label={props.cropLabels?.crop ?? 'Crop'}
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
            aria-label={props.inspectorLabels?.title ?? 'Elementeigenschaften'}
            style={{
              left: inspectorAnchor.x,
              top: inspectorAnchor.y,
              maxHeight: `min(50vh, ${Math.max(44, inspectorRoom)}px)`,
            }}
          >
            <div className="polity-canvas-properties-header">
              <button
                type="button"
                className="polity-canvas-properties-drag-handle"
                aria-label={props.inspectorLabels?.move ?? 'Eigenschaften verschieben'}
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
                <span>{props.inspectorLabels?.title ?? 'Elementeigenschaften'}</span>
              </button>
              <button
                type="button"
                className="polity-canvas-properties-toggle"
                aria-controls={inspectorBodyId}
                aria-expanded={!inspectorCollapsed}
                aria-label={
                  inspectorCollapsed
                    ? (props.inspectorLabels?.expand ?? 'Eigenschaften aufklappen')
                    : (props.inspectorLabels?.collapse ?? 'Eigenschaften einklappen')
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
