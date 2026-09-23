import '@excalidraw/excalidraw/index.css';
import './excalidraw.css';
import './studio-fonts.css';
import {
  Excalidraw,
  CaptureUpdateAction,
  convertToExcalidrawElements,
  exportToSvg,
  serializeAsJSON,
  restoreElements,
  getCommonBounds,
} from '@excalidraw/excalidraw';
import type {
  ExcalidrawImperativeAPI,
  BinaryFiles,
  AppState,
  AppClassProperties,
  LibraryItems,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
  AlignCenter,
  Check,
  Group,
  MoveHorizontal,
  MoveVertical,
  ScanSearch,
  Table2,
  Type,
  Ungroup,
} from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { NativeCanvasProperties, type NativeSelectionAction } from './NativeCanvasProperties';
import { nativeCanvasNodeId } from '../logic/v3-adapter';
import { selectionUnits } from '../logic/selection-geometry';
import {
  groupMembers,
  drillIntoGroup,
  emptyStudioSelection,
  toggleSelection,
  type StudioSelectionState,
} from '../logic/studio-selection';
import { canFormatNativeText, formatNativeText } from '../logic/canvas-text';
import { nativeTemplatePage } from '../logic/native-template';
import type { CanvasProps, StudioSelectionGeometry } from './StudioCanvas';
import { StudioTextEditor } from './StudioTextEditor';
import { StudioTableEditor, type StudioTableGeometry } from './StudioTableEditor';
import { drawStudioElement } from '../logic/draw-element';
import type { StudioMediaCrop, StudioPage } from '../logic/document';
import type { FrameNode, StudioDocumentV3, StudioNode } from '../logic/document-v3';
import { durableElements, canvasSceneSchema } from '../logic/canvas-schema';
import {
  sceneElements,
  nativeSceneChanged,
  readPolityGeometry,
  polityProjection,
  duplicatedPolityElements,
  identifyDuplicatedProjections,
  orderedScene,
  captureCanvasOrder,
} from '../logic/canvas-adapter';
import { studioProjectionFileId } from '../logic/media-projection';
import { isStudioValidationError, stableJson } from '../logic/operations';
import {
  createStudioClipboardPayload,
  createStudioV3ClipboardPayload,
  duplicateStudioClipboard,
  getProjectStudioClipboard,
  parseStudioClipboard,
  setProjectStudioClipboard,
  stringifyStudioClipboard,
  type StudioClipboardPayload,
  type StudioClipboardV2Payload,
} from '../logic/studio-clipboard';
import { studioRequest } from '@/zero/communication-studio/useStudioApi';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import type { CanvasSession } from '../logic/governance';
import { useStudioViewportStore, type StudioTool } from '../state/studio-viewport-store';

type Props = CanvasProps & {
  pages?: StudioPage[];
  v3Document?: StudioDocumentV3;
  selectionState?: StudioSelectionState;
  onSelectionChange?: (selection: StudioSelectionState) => void;
  selectExact?: (ids: string[]) => void;
  onArrangeSelection?: (action: NativeSelectionAction) => void;
  onAlignSelection?: (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistributeSelection?: (axis: 'horizontal' | 'vertical') => void;
  applyCanvasChanges?: (changes: StudioCanvasNodeChange[]) => void;
  pasteV3Clipboard?: (payload: StudioClipboardV2Payload, targetFrameId: string | null) => string[];
  cutV3Clipboard?: (nodeIds: string[]) => void;
  whiteboard?: boolean;
  replace: (page: StudioPage, base: StudioPage, track?: boolean) => void;
  commit: () => Promise<number>;
  undo: () => void;
  redo: () => void;
  draft?: boolean;
  projectId: string;
  sources: StudioPage['elements'];
  inspector?: ReactNode;
  tableEditorRequest?: string | null;
  removeTable?: (id: string) => void;
  onCanvasStateChange?: (state: StudioCanvasState) => void;
  frames?: FrameNode[];
  frameDefaultBackground?: string;
  master?: { frame: FrameNode; page: StudioPage };
  rootNodes?: StudioNode[];
  activateFrame?: (frameId: string) => void;
  themeColors?: readonly string[];
};

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
    excalidraw?: Exclude<StudioNode['excalidraw'], null>;
  };
  style?: Partial<FrameNode['style']>;
}

export interface StudioCanvasState {
  activeTool: StudioTool;
  toolLocked: boolean;
  zoom: number;
}

export type StudioCanvasCommand =
  | { type: 'setTool'; tool: StudioTool; locked?: boolean; rounded?: boolean }
  | { type: 'zoom'; mode: 'in' | 'out' | 'reset' | 'selection' | 'all' }
  | { type: 'search'; query: string }
  | { type: 'importScene'; file: File }
  | { type: 'exportScene'; format: 'svg' | 'excalidraw' }
  | { type: 'library'; action: 'load' | 'save' }
  | { type: 'insertMermaid'; source: string }
  | { type: 'clipboard'; action: 'copy' | 'cut' | 'paste' }
  | { type: 'selectionAction'; action: NativeSelectionAction };

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

const excalidrawToolByStudioTool: Partial<Record<StudioTool, string>> = {
  selection: 'selection',
  hand: 'hand',
  frame: 'frame',
  text: 'text',
  rectangle: 'rectangle',
  ellipse: 'ellipse',
  diamond: 'diamond',
  line: 'line',
  arrow: 'arrow',
  draw: 'freedraw',
  eraser: 'eraser',
  laser: 'laser',
};

const studioToolByExcalidrawTool: Record<string, StudioTool> = Object.fromEntries(
  Object.entries(excalidrawToolByStudioTool).map(([studio, excalidraw]) => [excalidraw, studio])
) as Record<string, StudioTool>;

function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function readClipboardForContextMenu() {
  let text = '';
  try {
    text = (await navigator.clipboard?.readText?.()) ?? '';
  } catch {
    // The project clipboard remains available when OS clipboard access is denied.
  }
  if (text) return { text, event: null as ClipboardEvent | null };
  try {
    const transfer = new DataTransfer();
    for (const item of (await navigator.clipboard?.read?.()) ?? [])
      for (const type of item.types) {
        const blob = await item.getType(type);
        if (type === 'text/plain' || type === 'text/html') {
          const value = await blob.text();
          transfer.setData(type, value);
          if (type === 'text/plain') text = value;
        } else if (type.startsWith('image/')) {
          transfer.items.add(new File([blob], 'clipboard-image', { type }));
        }
      }
    return {
      text,
      event: new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: transfer,
      }),
    };
  } catch {
    return { text, event: null as ClipboardEvent | null };
  }
}

function sceneNodeId(element: ExcalidrawElement, props: Props): string | null {
  const data = element.customData;
  if (element.isDeleted || data?.polityMaster || data?.polityFrameBackground) return null;
  if (typeof data?.polityNode === 'string') return data.polityNode;
  if (typeof data?.polityElement === 'string') return data.polityElement;
  if (typeof data?.polityFrame === 'string') return data.polityFrame;
  const existing = props.v3Document?.nodes.find(
    node => node.excalidraw && node.excalidraw.id === element.id
  );
  return existing?.id ?? nativeCanvasNodeId(props.page.id, element.id);
}

function sceneIdsForNodes(
  elements: readonly ExcalidrawElement[],
  props: Props,
  nodeIds: string[]
): string[] {
  const chosen = new Set(nodeIds);
  return elements
    .filter(element => {
      const id = sceneNodeId(element, props);
      return id && chosen.has(id);
    })
    .map(element => element.id);
}

function frameSceneElement(frame: FrameNode, defaultBackground?: string): ExcalidrawElement {
  const [element] = convertToExcalidrawElements(
    [
      {
        type: 'frame',
        id: frame.id,
        name: frame.name,
        children: [],
        x: frame.transform.x,
        y: frame.transform.y,
        width: frame.transform.width,
        height: frame.transform.height,
        angle: (frame.transform.rotation * Math.PI) / 180,
        locked: frame.locked,
        customData: { polityFrame: frame.id },
      },
    ],
    { regenerateIds: false }
  );
  // Excalidraw's skeleton converter applies its own frame padding. V3 stores the
  // actual outer bounds, so put those bounds back to avoid a 10 px drift after
  // every scene refresh.
  return {
    ...element,
    x: frame.transform.x,
    y: frame.transform.y,
    width: frame.transform.width,
    height: frame.transform.height,
    angle: (frame.transform.rotation * Math.PI) / 180,
    name: frame.name,
    locked: frame.locked,
    backgroundColor: frame.style.fill ?? defaultBackground ?? 'transparent',
    fillStyle: 'solid',
    strokeColor: frame.style.stroke ?? '#888888',
    strokeWidth: frame.style.strokeWidth,
    strokeStyle: frame.style.strokeStyle,
    roughness: frame.style.roughness,
    opacity: frame.style.opacity * 100,
    customData: { ...element.customData, polityFrame: frame.id, polityNode: frame.id },
  } as ExcalidrawElement;
}

function frameBackgroundElement(frame: FrameNode, defaultBackground?: string): ExcalidrawElement {
  const [element] = convertToExcalidrawElements(
    [
      {
        type: 'rectangle',
        id: `frame-bg:${frame.id}`,
        x: frame.transform.x,
        y: frame.transform.y,
        width: frame.transform.width,
        height: frame.transform.height,
        backgroundColor: frame.style.fill ?? defaultBackground ?? '#ffffff',
        strokeColor: 'transparent',
        fillStyle: 'solid',
        roughness: 0,
        locked: true,
        customData: { polityFrameBackground: frame.id },
      },
    ],
    { regenerateIds: false }
  );
  return {
    ...element,
    frameId: frame.id,
    locked: true,
    customData: { ...element.customData, polityFrameBackground: frame.id },
  } as ExcalidrawElement;
}

function placePageElementInFrame(element: ExcalidrawElement, frame: FrameNode): ExcalidrawElement {
  if (element.customData?.polityRoot)
    return {
      ...element,
      frameId: null,
    };
  return {
    ...element,
    x: element.x + frame.transform.x,
    y: element.y + frame.transform.y,
    frameId: element.frameId ?? frame.id,
  };
}

function restorePageElementCoordinates(
  element: ExcalidrawElement,
  frame: ExcalidrawElement | undefined
): ExcalidrawElement {
  if (!frame) return element;
  if (element.frameId !== frame.id)
    return {
      ...element,
      frameId: null,
      customData: { ...element.customData, polityRoot: true },
    };
  return {
    ...element,
    x: element.x - frame.x,
    y: element.y - frame.y,
    frameId: null,
    customData: { ...element.customData, polityRoot: false },
  };
}

/** Excalidraw controls interaction; the Studio operation log controls persistence. */
const ExcalidrawCanvas = forwardRef<StudioCanvasHandle, Props>(
  function ExcalidrawCanvas(props, ref) {
    const resetViewportProject = useStudioViewportStore(state => state.resetProject);
    const storeViewport = useStudioViewportStore(state => state.setViewport);
    const storeSelection = useStudioViewportStore(state => state.setSelection);
    const storeTool = useStudioViewportStore(state => state.setTool);
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
    const [error, setError] = useState('');
    const [textEditing, setTextEditing] = useState(false);
    const [tableEditingId, setTableEditingId] = useState<string | null>(null);
    const handledTableRequest = useRef<string | null>(null);
    const tableButtonRef = useRef<HTMLButtonElement>(null);
    const [selectionGeometry, setSelectionGeometry] = useState<StudioSelectionGeometry | null>(
      null
    );
    const viewportSignature = useRef('');
    const [theme, setTheme] = useState<'light' | 'dark'>(() =>
      document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    );
    const latest = useRef(props);
    latest.current = props;
    const applying = useRef(false),
      initialized = useRef('');
    const changingRepresentation = useRef(false);
    const projections = useRef<ExcalidrawElement[]>([]);
    const fileMap = useRef<BinaryFiles>({});
    const emitted = useRef('');
    const emittedFrames = useRef('');
    const selectedFrame = useRef<string | null>(null);
    const syncedSelection = useRef<string[]>([]);
    const geometrySignature = useRef('');
    const canvasStateSignature = useRef('');
    const library = useRef<LibraryItems>([]);
    const host = useRef<HTMLDivElement>(null);
    const clipboardWrite = useRef<Promise<void>>(Promise.resolve());
    const semanticSources = useRef(new Map<string, StudioPage['elements'][number]>());
    const semanticSourceProject = useRef(props.projectId);
    if (semanticSourceProject.current !== props.projectId) {
      semanticSourceProject.current = props.projectId;
      semanticSources.current.clear();
    }
    for (const source of props.sources) semanticSources.current.set(source.id, source);
    const gesture = useRef(false);
    const baselineScene = useRef(
      new Map<
        string,
        {
          x: number;
          y: number;
          width: number;
          height: number;
          angle: number;
          scaleX: number;
          scaleY: number;
          crop: string;
        }
      >()
    );
    const touchHold = useRef<{
      x: number;
      y: number;
      nodeId: string | null;
      timer: ReturnType<typeof setTimeout> | null;
      triggered: boolean;
    } | null>(null);
    const nativeTextEditing = useRef(false);
    const displayedPage = useRef(props.page);
    const [gestureEnd, setGestureEnd] = useState(0);
    const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
    const selected = props.page.elements.find(e => e.id === props.selected[0]);
    const tableSceneElement = api?.getSceneElements().find(element => element.id === selected?.id);
    const tableAppState = api?.getAppState();
    const tableGeometry: StudioTableGeometry | null =
      tableSceneElement && tableAppState && selected?.type === 'table'
        ? {
            left:
              (tableSceneElement.x + tableAppState.scrollX) * tableAppState.zoom.value +
              tableAppState.offsetLeft,
            top:
              (tableSceneElement.y + tableAppState.scrollY) * tableAppState.zoom.value +
              tableAppState.offsetTop,
            width: tableSceneElement.width * tableAppState.zoom.value,
            height: tableSceneElement.height * tableAppState.zoom.value,
            rotation: (tableSceneElement.angle * 180) / Math.PI,
            flipX: tableSceneElement.type === 'image' && tableSceneElement.scale[0] < 0,
            flipY: tableSceneElement.type === 'image' && tableSceneElement.scale[1] < 0,
          }
        : null;
    useEffect(() => {
      if (
        props.tableEditorRequest &&
        props.tableEditorRequest !== handledTableRequest.current &&
        selected?.id === props.tableEditorRequest
      ) {
        handledTableRequest.current = props.tableEditorRequest;
        setTableEditingId(props.tableEditorRequest);
      }
    }, [props.tableEditorRequest, selected?.id]);
    useEffect(() => {
      if (
        tableEditingId &&
        (selected?.id !== tableEditingId || selected.type !== 'table' || !props.editable)
      ) {
        setTableEditingId(null);
      }
    }, [tableEditingId, selected?.id, selected?.type, props.editable]);
    const closeTableEditor = () => {
      setTableEditingId(null);
      queueMicrotask(() => tableButtonRef.current?.focus());
    };
    const nativeSelectedElements = api
      ? api
          .getSceneElements()
          .filter(element => selectedSceneIds.includes(element.id) && !element.isDeleted)
      : [];
    const nativeSelected =
      nativeSelectedElements.length === 1 ? nativeSelectedElements[0] : undefined;
    const selectedNodeIds = props.selectionState?.nodeIds ?? props.selected;
    const selectedV3Nodes =
      props.v3Document?.nodes.filter(node => selectedNodeIds.includes(node.id)) ?? [];
    const selectionGroups =
      props.v3Document &&
      selectedV3Nodes.length === selectedNodeIds.length &&
      selectedNodeIds.length
        ? selectionUnits(props.v3Document, selectedNodeIds, props.selectionState?.groupDepth ?? 0)
        : [];
    const canGroup =
      selectionGroups.length >= 2 &&
      new Set(selectionGroups.map(unit => unit.parentFrameId)).size === 1 &&
      !selectedV3Nodes.some(node => node.locked);
    const canUngroup = selectedV3Nodes.some(
      node => !!node.groupIds[props.selectionState?.groupDepth ?? 0]
    );
    const de = document.documentElement.lang !== 'en';
    const label = (a: string, b: string) => (de ? a : b);
    useEffect(() => resetViewportProject(props.projectId), [props.projectId, resetViewportProject]);
    useEffect(() => {
      const observer = new MutationObserver(() =>
        setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
      );
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (!api) return;
      for (const name of ['undo', 'redo'] as const)
        api.registerAction({
          name,
          label: `labels.${name}`,
          trackEvent: false,
          perform: () => {
            if (latest.current.editable) latest.current[name]();
            return false;
          },
        });
    }, [api]);

    useEffect(() => {
      if (!api || gesture.current || nativeTextEditing.current) return;
      let cancelled = false;
      const prepare = async () => {
        await document.fonts.ready;
        if (cancelled) return;
        if (props.editable && !props.page.canvas?.nativeTemplates) {
          const next = nativeTemplatePage(props.page, elements => {
            const converted = convertToExcalidrawElements(elements, { regenerateIds: false });
            return restoreElements(
              converted.map((e, index) =>
                e.type === 'text'
                  ? { ...e, width: elements[index].width ?? e.width, autoResize: false }
                  : e
              ),
              null,
              { refreshDimensions: true, repairBindings: true }
            );
          });
          if (next !== props.page) {
            changingRepresentation.current = true;
            props.replace(next, props.page, false);
            setTimeout(() => {
              if (latest.current.page === props.page) changingRepresentation.current = false;
            }, 0);
            return;
          }
        }
        const files: BinaryFiles = {};
        const visiblePages = props.pages ?? [props.page];
        const elements = await Promise.all(
          visiblePages
            .flatMap(page => page.elements)
            .filter(e => e.visible !== false)
            .map(async e => {
              const previewWidth = e.crop?.naturalWidth ?? e.width;
              const previewHeight = e.crop?.naturalHeight ?? e.height;
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.ceil(previewWidth));
              canvas.height = Math.max(1, Math.ceil(previewHeight));
              const ctx = canvas.getContext('2d');
              if (!ctx) throw new Error('Canvas rendering is unavailable');
              const mediaUrl =
                e.type === 'image' || e.type === 'video'
                  ? props.assets.find(a => a.id === e.assetId)?.url
                  : undefined;
              if (e.type === 'image' || e.type === 'video') {
                ctx.fillStyle = '#D9D7D0';
                ctx.fillRect(0, 0, previewWidth, previewHeight);
                if (mediaUrl && e.type === 'image') {
                  const image = new Image();
                  image.crossOrigin = 'anonymous';
                  image.src = mediaUrl;
                  await image.decode();
                  const scale =
                    e.fit === 'cover'
                      ? Math.max(previewWidth / image.width, previewHeight / image.height)
                      : Math.min(previewWidth / image.width, previewHeight / image.height);
                  ctx.drawImage(
                    image,
                    (previewWidth - image.width * scale) * e.cropX,
                    (previewHeight - image.height * scale) * e.cropY,
                    image.width * scale,
                    image.height * scale
                  );
                } else if (mediaUrl && e.type === 'video') {
                  const video = document.createElement('video');
                  video.crossOrigin = 'anonymous';
                  video.muted = true;
                  video.preload = 'auto';
                  video.playsInline = true;
                  await new Promise<void>((resolve, reject) => {
                    video.onloadeddata = () => resolve();
                    video.onerror = () => reject(new Error('Cannot decode video'));
                    video.src = mediaUrl;
                    video.load();
                  });
                  const scale =
                    e.fit === 'cover'
                      ? Math.max(previewWidth / video.videoWidth, previewHeight / video.videoHeight)
                      : Math.min(
                          previewWidth / video.videoWidth,
                          previewHeight / video.videoHeight
                        );
                  ctx.drawImage(
                    video,
                    (previewWidth - video.videoWidth * scale) * e.cropX,
                    (previewHeight - video.videoHeight * scale) * e.cropY,
                    video.videoWidth * scale,
                    video.videoHeight * scale
                  );
                  video.removeAttribute('src');
                  video.load();
                }
              } else
                drawStudioElement(ctx, {
                  ...e,
                  x: 0,
                  y: 0,
                  rotation: 0,
                  flipX: false,
                  flipY: false,
                  opacity: 1,
                });
              // Excalidraw keeps the first binary registered for a file ID. Media is
              // initially projected before its protected URL has finished loading, so
              // the placeholder and hydrated preview must use different IDs.
              const fileId = studioProjectionFileId(e, Boolean(mediaUrl));
              files[fileId] = {
                id: fileId,
                dataURL: canvas.toDataURL('image/png'),
                mimeType: 'image/png',
                created: 0,
              } as BinaryFiles[string];
              const [image] = convertToExcalidrawElements(
                [
                  {
                    type: 'image',
                    id: e.id,
                    ...polityProjection(e),
                    width: e.width,
                    height: e.height,
                    fileId: fileId as BinaryFiles[string]['id'],
                    customData: { polityElement: e.id, polityNode: e.id },
                  },
                ],
                { regenerateIds: false }
              );
              return {
                ...image,
                ...polityProjection(e),
                crop: e.crop,
                groupIds: e.group ? [e.group] : [],
                locked: e.locked,
                opacity: e.opacity * 100,
                customData: { ...image.customData, polityElement: e.id, polityNode: e.id },
              } as ExcalidrawElement;
            })
        );
        if (cancelled || gesture.current || nativeTextEditing.current) return;
        const activeElementIds = new Set(props.page.elements.map(element => element.id));
        projections.current = elements.filter(element => activeElementIds.has(element.id));
        const frames = (props.frames ?? []).filter(frame => frame.visible);
        const pageElements = visiblePages.flatMap(page => {
          const frame = frames.find(candidate => candidate.id === page.id);
          const own = elements.filter(element =>
            page.elements.some(source => source.id === element.id)
          );
          return orderedScene(page, own).map(element =>
            frame ? placePageElementInFrame(element, frame) : element
          );
        });
        const pageElementIds = new Set(pageElements.map(element => element.id));
        const rootElements = (props.rootNodes ?? []).flatMap(node => {
          if (!node.excalidraw || !node.visible) return [];
          const raw = structuredClone(node.excalidraw) as unknown as ExcalidrawElement;
          if (pageElementIds.has(raw.id)) return [];
          return [
            {
              ...raw,
              x: node.transform.x,
              y: node.transform.y,
              width: node.transform.width,
              height: node.transform.height,
              angle: (node.transform.rotation * Math.PI) / 180,
              groupIds: node.groupIds,
              frameId: null,
              locked: node.locked,
              customData: { ...raw.customData, polityRoot: true, polityNode: node.id },
            } as ExcalidrawElement,
          ];
        });
        const masterElements: ExcalidrawElement[] = [];
        if (props.master) {
          const sourceFrame = props.master.frame;
          const native = sceneElements(props.master.page.canvas).filter(
            element => !element.isDeleted
          );
          for (const frame of frames) {
            const scaleX = frame.transform.width / sourceFrame.transform.width;
            const scaleY = frame.transform.height / sourceFrame.transform.height;
            const groupIds = new Map<string, string>();
            for (const element of native) {
              const id = `master:${frame.id}:${element.id}`;
              masterElements.push({
                ...structuredClone(element),
                id,
                x: frame.transform.x + element.x * scaleX,
                y: frame.transform.y + element.y * scaleY,
                width: element.width * scaleX,
                height: element.height * scaleY,
                frameId: frame.id,
                groupIds: element.groupIds.map(groupId => {
                  const mapped = groupIds.get(groupId) ?? `master:${frame.id}:group:${groupId}`;
                  groupIds.set(groupId, mapped);
                  return mapped;
                }),
                locked: true,
                customData: {
                  ...element.customData,
                  polityMaster: element.id,
                  polityMasterFrame: sourceFrame.id,
                  polityTargetFrame: frame.id,
                },
              } as ExcalidrawElement);
            }
            for (const source of props.master.page.elements.filter(element => element.visible)) {
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.ceil(source.width));
              canvas.height = Math.max(1, Math.ceil(source.height));
              const context = canvas.getContext('2d');
              if (!context) continue;
              drawStudioElement(context, {
                ...source,
                x: 0,
                y: 0,
                rotation: 0,
                flipX: false,
                flipY: false,
                opacity: 1,
              });
              const fileId = `polity-master-${frame.id}-${source.id}`;
              files[fileId] = {
                id: fileId,
                dataURL: canvas.toDataURL('image/png'),
                mimeType: 'image/png',
                created: 0,
              } as BinaryFiles[string];
              const [image] = convertToExcalidrawElements(
                [
                  {
                    type: 'image',
                    id: `master:${frame.id}:${source.id}`,
                    x: frame.transform.x + source.x * scaleX,
                    y: frame.transform.y + source.y * scaleY,
                    width: source.width * scaleX,
                    height: source.height * scaleY,
                    fileId: fileId as BinaryFiles[string]['id'],
                    customData: {
                      polityMaster: source.id,
                      polityMasterFrame: sourceFrame.id,
                      polityTargetFrame: frame.id,
                    },
                  },
                ],
                { regenerateIds: false }
              );
              masterElements.push({
                ...image,
                frameId: frame.id,
                locked: true,
                customData: {
                  ...image.customData,
                  polityMaster: source.id,
                  polityMasterFrame: sourceFrame.id,
                  polityTargetFrame: frame.id,
                },
              });
            }
          }
        }
        const rawScene = [
          ...frames.map(frame => frameBackgroundElement(frame, props.frameDefaultBackground)),
          ...frames.map(frame => frameSceneElement(frame, props.frameDefaultBackground)),
          ...rootElements,
          ...pageElements,
          ...masterElements,
        ];
        const depth = props.selectionState?.groupDepth ?? 0;
        const scene = rawScene.map(element => {
          const nodeId = sceneNodeId(element, props);
          const node = props.v3Document?.nodes.find(candidate => candidate.id === nodeId);
          return node
            ? ({
                ...element,
                groupIds: [...node.groupIds.slice(depth)].reverse(),
              } as ExcalidrawElement)
            : element;
        });
        fileMap.current = {
          ...Object.assign({}, ...visiblePages.map(page => page.canvas?.files ?? {})),
          ...files,
        } as BinaryFiles;
        applying.current = true;
        displayedPage.current = props.page;
        api.addFiles(Object.values(fileMap.current));
        api.updateScene({
          elements: scene,
          appState: { viewBackgroundColor: theme === 'dark' ? '#111315' : '#f2f0ea' },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        baselineScene.current = new Map(
          scene.map(element => [
            element.id,
            {
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
              angle: element.angle,
              scaleX: 'scale' in element ? element.scale[0] : 1,
              scaleY: 'scale' in element ? element.scale[1] : 1,
              crop: stableJson(element.type === 'image' ? element.crop : null),
            },
          ])
        );
        applying.current = false;
        changingRepresentation.current = false;
        if (initialized.current !== props.page.id) {
          initialized.current = props.page.id;
          if (scene.length) api.scrollToContent(scene, { fitToViewport: true });
          focusLink();
        }
      };
      void prepare().catch(e => {
        if (!cancelled) {
          changingRepresentation.current = false;
          setError(
            isStudioValidationError(e)
              ? label(
                  'Diese Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.',
                  'This change could not be saved. Please try again.'
                )
              : String(e)
          );
        }
      });
      return () => {
        cancelled = true;
      };
    }, [
      api,
      props.page,
      props.pages,
      props.assets,
      props.frames,
      props.master,
      props.rootNodes,
      props.selectionState?.groupDepth,
      props.v3Document,
      props.frameDefaultBackground,
      gestureEnd,
    ]);

    const focusLink = () => {
      const link = new URLSearchParams(location.hash.slice(1));
      if (!api || link.get('canvas') !== latest.current.page.id) return;
      const selected = api
        .getSceneElements()
        .filter(e => e.id === link.get('element') || e.groupIds.includes(link.get('group') ?? ''));
      if (selected.length) {
        api.scrollToContent(selected, { fitToViewport: true });
        latest.current.select(selected.map(e => e.id));
      }
    };
    useEffect(() => {
      window.addEventListener('hashchange', focusLink);
      return () => window.removeEventListener('hashchange', focusLink);
    }, [api]);

    useEffect(() => {
      if (!api) return;
      const selectedIds = sceneIdsForNodes(api.getSceneElements(), props, props.selected);
      syncedSelection.current = props.selected;
      if (stableJson(Object.keys(api.getAppState().selectedElementIds)) === stableJson(selectedIds))
        return;
      applying.current = true;
      api.updateScene({
        appState: { selectedElementIds: Object.fromEntries(selectedIds.map(id => [id, true])) },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      applying.current = false;
      setSelectedSceneIds(selectedIds);
    }, [api, props.selected]);

    useEffect(() => {
      if (!api) return;
      const peers = props.peers.filter(p => p.cursor?.pageId === props.page.id);
      const collaborators = new Map(
        peers.map(p => [
          p.userId,
          {
            username: p.user?.name ?? 'Polity',
            color: { background: p.user?.color ?? '#B88A3B', stroke: '#12362D' },
            pointer: { x: p.cursor.x, y: p.cursor.y, tool: 'pointer' },
            selectedElementIds: Object.fromEntries(
              (Array.isArray(p.selection) ? p.selection : []).map((id: string) => [id, true])
            ),
          },
        ])
      );
      api.updateScene({
        collaborators: collaborators as Parameters<typeof api.updateScene>[0]['collaborators'],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }, [api, props.peers, props.page.id]);

    const change = (
      elements: readonly ExcalidrawElement[],
      state: AppState,
      files: BinaryFiles
    ) => {
      if (!api) return;
      const activeTool = studioToolByExcalidrawTool[state.activeTool.type] ?? 'selection';
      const canvasState = {
        activeTool,
        toolLocked: !!state.activeTool.locked,
        zoom: state.zoom.value,
      } satisfies StudioCanvasState;
      const nextCanvasStateSignature = stableJson(canvasState);
      if (nextCanvasStateSignature !== canvasStateSignature.current) {
        canvasStateSignature.current = nextCanvasStateSignature;
        storeTool(activeTool);
        latest.current.onCanvasStateChange?.(canvasState);
      }
      if (applying.current) return;
      const p = latest.current;
      const wasEditing = nativeTextEditing.current;
      nativeTextEditing.current = !!state.editingTextElement;
      if (wasEditing && !nativeTextEditing.current) setGestureEnd(v => v + 1);
      const view = { x: state.scrollX, y: state.scrollY, zoom: state.zoom.value };
      const viewKey = stableJson(view);
      if (viewKey !== viewportSignature.current) {
        viewportSignature.current = viewKey;
        storeViewport(view);
      }
      const ids = Object.keys(state.selectedElementIds);
      setSelectedSceneIds(current => (stableJson(current) === stableJson(ids) ? current : ids));
      const frameIds = new Set((p.frames ?? []).map(frame => frame.id));
      const selectedFrameId = ids.length === 1 && frameIds.has(ids[0]) ? ids[0] : null;
      const rawNodeIds = [
        ...new Set(
          ids.flatMap(id => {
            const element = elements.find(candidate => candidate.id === id);
            const nodeId = element ? sceneNodeId(element, p) : null;
            const node = p.v3Document?.nodes.find(candidate => candidate.id === nodeId);
            return nodeId && (!node || (node.visible && !node.locked)) ? [nodeId] : [];
          })
        ),
      ];
      const depth = p.selectionState?.groupDepth ?? 0;
      const selectionDocument = p.v3Document;
      const nodeIds = selectionDocument
        ? [...new Set(rawNodeIds.flatMap(id => groupMembers(selectionDocument, id, depth)))]
        : rawNodeIds;
      if (selectedFrame.current !== selectedFrameId) {
        selectedFrame.current = selectedFrameId;
        if (selectedFrameId && selectedFrameId !== p.page.id) p.activateFrame?.(selectedFrameId);
      }
      if (
        (stableJson(nodeIds) !== stableJson(p.selected) ||
          (rawNodeIds[0] ?? null) !== (p.selectionState?.primaryId ?? null)) &&
        stableJson(p.selected) === stableJson(syncedSelection.current)
      ) {
        syncedSelection.current = nodeIds;
        storeSelection(ids);
        if (p.selectExact) p.selectExact(nodeIds);
        else p.select(nodeIds);
        p.onSelectionChange?.({
          nodeIds,
          primaryId: rawNodeIds[0] ?? null,
          groupDepth: depth,
          touchMode: p.selectionState?.touchMode ?? false,
        });
      }
      const chosen = elements.filter(e => ids.includes(e.id) && !e.isDeleted);
      if (chosen.length) {
        const [left, top, right, bottom] = getCommonBounds(chosen);
        const zoom = state.zoom.value;
        const bounds = {
          left: (left + state.scrollX) * zoom + state.offsetLeft,
          top: (top + state.scrollY) * zoom + state.offsetTop,
          right: (right + state.scrollX) * zoom + state.offsetLeft,
          bottom: (bottom + state.scrollY) * zoom + state.offsetTop,
          interacting: !!state.newElement || state.isResizing || state.isRotating,
        };
        if (stableJson(bounds) !== geometrySignature.current) {
          geometrySignature.current = stableJson(bounds);
          setSelectionGeometry(bounds);
          p.onGeometry?.(bounds);
        }
      } else if (geometrySignature.current) {
        geometrySignature.current = '';
        setSelectionGeometry(null);
        p.onGeometry?.(null);
      }
      if (
        !p.editable ||
        initialized.current !== p.page.id ||
        gesture.current ||
        nativeTextEditing.current ||
        changingRepresentation.current
      )
        return;
      if (state.isCropping) return;
      const canvasTransforms: StudioCanvasNodeChange[] = ids.flatMap(id => {
        const element = elements.find(candidate => candidate.id === id);
        const before = baselineScene.current.get(id);
        if (!element || !before) return [];
        const nodeId = sceneNodeId(element, p);
        const node = p.v3Document?.nodes.find(candidate => candidate.id === nodeId);
        if (!node || node.locked) return [];
        const scaleX = 'scale' in element ? element.scale[0] : 1;
        const scaleY = 'scale' in element ? element.scale[1] : 1;
        if (
          element.x === before.x &&
          element.y === before.y &&
          element.width === before.width &&
          element.height === before.height &&
          element.angle === before.angle &&
          scaleX === before.scaleX &&
          scaleY === before.scaleY &&
          stableJson(element.type === 'image' ? element.crop : null) === before.crop
        )
          return [];
        const [native] = node.excalidraw
          ? durableElements([element as unknown as Record<string, unknown>])
          : [];
        return [
          {
            nodeId: node.id,
            transform: {
              dx: element.x - before.x,
              dy: element.y - before.y,
              width: element.width,
              height: element.height,
              rotation: (element.angle * 180) / Math.PI,
              flipX: scaleX < 0,
              flipY: scaleY < 0,
              crop:
                node.type === 'media' && element.type === 'image'
                  ? structuredClone(element.crop)
                  : undefined,
              excalidraw: native as Exclude<StudioNode['excalidraw'], null> | undefined,
            },
          },
        ];
      });
      const base = displayedPage.current;
      const frameElements = elements.filter(element => frameIds.has(element.id));
      const frameStyles: StudioCanvasNodeChange[] = frameElements.flatMap(element => {
        const frame = p.frames?.find(candidate => candidate.id === element.id);
        if (!frame || element.isDeleted) return [];
        const effectiveFill = frame.style.fill ?? p.frameDefaultBackground ?? 'transparent';
        const style = {
          fill:
            element.backgroundColor === effectiveFill
              ? frame.style.fill
              : element.backgroundColor === 'transparent'
                ? null
                : /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(element.backgroundColor)
                  ? element.backgroundColor
                  : frame.style.fill,
          stroke:
            element.strokeColor === 'transparent'
              ? null
              : /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(element.strokeColor)
                ? element.strokeColor
                : frame.style.stroke,
          strokeWidth: element.strokeWidth,
          strokeStyle: element.strokeStyle,
          opacity: element.opacity / 100,
          roughness: element.roughness,
        } satisfies Partial<FrameNode['style']>;
        const changedStyle = Object.fromEntries(
          Object.entries(style).filter(
            ([key, value]) => frame.style[key as keyof FrameNode['style']] !== value
          )
        ) as Partial<FrameNode['style']>;
        return Object.keys(changedStyle).length ? [{ nodeId: frame.id, style: changedStyle }] : [];
      });
      const combinedChanges = new Map<string, StudioCanvasNodeChange>();
      for (const change of [...canvasTransforms, ...frameStyles])
        combinedChanges.set(change.nodeId, {
          ...combinedChanges.get(change.nodeId),
          ...change,
          nodeId: change.nodeId,
        });
      const changes = [...combinedChanges.values()];
      if (changes.length && p.applyCanvasChanges) {
        if (canvasTransforms.length)
          baselineScene.current = new Map(
            elements.map(element => [
              element.id,
              {
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
                angle: element.angle,
                scaleX: 'scale' in element ? element.scale[0] : 1,
                scaleY: 'scale' in element ? element.scale[1] : 1,
                crop: stableJson(element.type === 'image' ? element.crop : null),
              },
            ])
          );
        const signature = stableJson(changes);
        if (signature !== emittedFrames.current) {
          emittedFrames.current = signature;
          p.applyCanvasChanges(changes);
        }
        return;
      }
      emittedFrames.current = '';
      const activeFrame = frameElements.find(element => element.id === base.id);
      const ownIds = new Set([
        ...base.elements.map(element => element.id),
        ...(base.canvas?.elements ?? []).map(element => element.id),
      ]);
      const otherIds = new Set(
        (p.pages ?? [])
          .filter(page => page.id !== base.id)
          .flatMap(page => [
            ...page.elements.map(element => element.id),
            ...(page.canvas?.elements ?? []).map(element => element.id),
          ])
      );
      let contentElements = elements.filter(
        element =>
          !frameIds.has(element.id) &&
          !element.customData?.polityMaster &&
          !element.customData?.polityFrameBackground &&
          !element.customData?.polityRoot &&
          (ownIds.has(element.id) ||
            (!otherIds.has(element.id) &&
              (element.frameId === base.id || element.frameId === null)))
      );
      const expectedScene = orderedScene(base, projections.current).map(element => {
        const frame = p.frames?.find(candidate => candidate.id === base.id);
        return frame ? placePageElementInFrame(element, frame) : element;
      });
      const identified = identifyDuplicatedProjections(contentElements, expectedScene);
      if (identified.some((e, i) => e.id !== contentElements[i].id)) {
        const mapping = new Map(contentElements.map((e, i) => [e.id, identified[i].id]));
        const selection = ids.map(id => mapping.get(id) ?? id);
        applying.current = true;
        api.updateScene({
          elements: [...frameElements, ...identified],
          appState: { selectedElementIds: Object.fromEntries(selection.map(id => [id, true])) },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        applying.current = false;
        p.select(selection.filter(id => !frameIds.has(id)));
        contentElements = identified;
      }
      const localElements = contentElements.map(element => {
        const restored = restorePageElementCoordinates(element, activeFrame);
        const nodeId = sceneNodeId(element, p);
        const node = p.v3Document?.nodes.find(candidate => candidate.id === nodeId);
        return node
          ? ({ ...restored, groupIds: [...node.groupIds].reverse() } as ExcalidrawElement)
          : restored;
      });
      const ordering = captureCanvasOrder(base, localElements);
      const geometry = readPolityGeometry(base, localElements);
      const duplicates = duplicatedPolityElements(base, localElements, [
        ...semanticSources.current.values(),
      ]);
      const deleted = base.elements.filter(e =>
        localElements.some(v => v.id === e.id && v.isDeleted)
      );
      if (
        !geometry.length &&
        !duplicates.length &&
        !deleted.length &&
        !nativeSceneChanged(base.canvas, ordering.elements) &&
        !base.elements.some(e => ordering.orders.has(e.id) && ordering.orders.get(e.id) !== e.order)
      )
        return;
      try {
        const usedFiles = new Set(
          localElements
            .filter(e => e.type === 'image' && !e.customData?.polityElement)
            .map(e => (e as { fileId: string }).fileId)
        );
        const scene = canvasSceneSchema.parse({
          ...base.canvas,
          version: 1,
          elements: durableElements(ordering.elements),
          files: Object.fromEntries(Object.entries(files).filter(([id]) => usedFiles.has(id))),
        });
        const page = {
          ...base,
          canvas: scene,
          elements: [
            ...base.elements
              .filter(e => !deleted.some(d => d.id === e.id))
              .map(e => ({
                ...e,
                ...(geometry.find(g => g.id === e.id)?.patch ?? {}),
                order: ordering.orders.get(e.id) ?? e.order,
              })),
            ...duplicates.map(e => ({ ...e, order: ordering.orders.get(e.id) ?? e.order })),
          ],
        };
        const signature = stableJson(page);
        if (emitted.current !== signature) {
          emitted.current = signature;
          p.replace(page, base);
          displayedPage.current = page;
        }
      } catch (e) {
        setError(
          isStudioValidationError(e)
            ? label(
                'Diese Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.',
                'This change could not be saved. Please try again.'
              )
            : String(e)
        );
      }
    };

    const run = async (work: () => Promise<unknown>) => {
      try {
        setError('');
        await work();
      } catch (e) {
        setError(
          isStudioValidationError(e)
            ? label(
                'Diese Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.',
                'This change could not be saved. Please try again.'
              )
            : String(e)
        );
      }
    };
    const exportScene = (format: 'svg' | 'excalidraw') =>
      run(async () => {
        if (!api) return;
        const elements = structuredClone(api.getSceneElements());
        const state = api.getAppState();
        const files = { ...api.getFiles() };
        const revision = await props.commit();
        if (stableJson(elements) !== stableJson(api.getSceneElements()))
          throw new Error(
            label(
              'Inhalt wurde während des Exports geändert. Bitte erneut exportieren.',
              'Content changed during export. Please export again.'
            )
          );
        const name = `${props.page.name}-${props.draft ? 'ENTWURF-' : ''}r${revision}`;
        if (format === 'svg') {
          const svg = await exportToSvg({
            elements,
            appState: { ...state, exportWithDarkMode: false },
            files,
          });
          download(`${name}.svg`, svg.outerHTML, 'image/svg+xml');
        } else
          download(
            `${name}.excalidraw`,
            serializeAsJSON(elements, state, files, 'local'),
            'application/json'
          );
      });

    const publishSceneChange = (
      elements: readonly ExcalidrawElement[],
      selectedIds = selectedSceneIds
    ) => {
      if (!api) return;
      applying.current = true;
      api.updateScene({
        elements: elements as never,
        appState: {
          selectedElementIds: Object.fromEntries(selectedIds.map(id => [id, true])),
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      applying.current = false;
      setSelectedSceneIds(selectedIds);
      requestAnimationFrame(() =>
        change(api.getSceneElementsIncludingDeleted(), api.getAppState(), api.getFiles())
      );
    };

    const captureClipboard = (
      elements: readonly ExcalidrawElement[],
      state: Readonly<AppState>,
      persistentSelection?: readonly string[]
    ) => {
      const selectedSceneIds = Object.keys(state.selectedElementIds);
      const document = latest.current.v3Document;
      if (document) {
        const depth = latest.current.selectionState?.groupDepth ?? 0;
        const sceneNodeIds = [
          ...new Set(
            selectedSceneIds.flatMap(sceneId => {
              const element = elements.find(candidate => candidate.id === sceneId);
              const nodeId = element ? sceneNodeId(element, latest.current) : null;
              return nodeId ? groupMembers(document, nodeId, depth) : [];
            })
          ),
        ];
        const selectedNodeIds = (
          persistentSelection ??
          latest.current.selectionState?.nodeIds ??
          []
        ).filter(nodeId => document.nodes.some(node => node.id === nodeId));
        const payload = createStudioV3ClipboardPayload({
          projectId: latest.current.projectId,
          selectedNodeIds: selectedNodeIds.length ? selectedNodeIds : sceneNodeIds,
          document,
        });
        if (payload) return payload;
      }
      const frameIds = new Set((latest.current.frames ?? []).map(frame => frame.id));
      const selectedFrames = new Set(
        elements
          .filter(element => selectedSceneIds.includes(element.id) && element.frameId)
          .map(element => element.frameId)
      );
      const sourceFrameId = selectedFrames.size === 1 ? [...selectedFrames][0] : null;
      return createStudioClipboardPayload({
        projectId: latest.current.projectId,
        selectedIds: selectedSceneIds,
        elements,
        semanticElements: [...semanticSources.current.values()],
        files: api?.getFiles() ?? {},
        frameIds,
        activeFrame: elements.find(
          element => element.id === (sourceFrameId ?? latest.current.page.id)
        ),
      });
    };

    const clipboardTargetFrame = (
      elements: readonly ExcalidrawElement[],
      state: Readonly<AppState>
    ) => {
      const document = latest.current.v3Document;
      if (!document) return latest.current.page.id;
      const persistentNodeIds = (latest.current.selectionState?.nodeIds ?? []).filter(nodeId =>
        document.nodes.some(node => node.id === nodeId)
      );
      const targets = new Set(
        (persistentNodeIds.length
          ? persistentNodeIds
          : Object.keys(state.selectedElementIds).flatMap(sceneId => {
              const element = elements.find(candidate => candidate.id === sceneId);
              const nodeId = element ? sceneNodeId(element, latest.current) : null;
              return nodeId ? [nodeId] : [];
            })
        ).flatMap(nodeId => {
          const node = document.nodes.find(candidate => candidate.id === nodeId);
          if (!node) return [];
          return node.type === 'frame' ? [node.id] : node.parentFrameId ? [node.parentFrameId] : [];
        })
      );
      if (targets.size === 1) return [...targets][0];
      return document.nodes.some(
        node => node.id === latest.current.page.id && node.type === 'frame'
      )
        ? latest.current.page.id
        : null;
    };

    const storeClipboard = (
      payload: StudioClipboardPayload | null,
      clipboardData?: DataTransfer | null
    ) => {
      if (!payload) return false;
      setProjectStudioClipboard(payload);
      const serialized = stringifyStudioClipboard(payload);
      if (clipboardData) clipboardData.setData('text/plain', serialized);
      else
        clipboardWrite.current =
          navigator.clipboard?.writeText?.(serialized).catch(() => {
            // The in-memory project clipboard is the permission-independent fallback.
          }) ?? Promise.resolve();
      return true;
    };

    const pastePayload = (
      payload: StudioClipboardPayload,
      elements = api?.getSceneElementsIncludingDeleted() ?? []
    ) => {
      if (!api) return false;
      if (payload.projectId !== latest.current.projectId) {
        setError(
          label(
            'Elemente können nur innerhalb desselben Studio-Projekts eingefügt werden.',
            'Elements can only be pasted within the same Studio project.'
          )
        );
        return false;
      }
      if (payload.version === 2) {
        const selectedNodeIds = latest.current.pasteV3Clipboard?.(
          payload,
          clipboardTargetFrame(elements, api.getAppState())
        );
        if (!selectedNodeIds?.length) return false;
        syncedSelection.current = selectedNodeIds;
        if (latest.current.selectExact) latest.current.selectExact(selectedNodeIds);
        else latest.current.select(selectedNodeIds);
        latest.current.onSelectionChange?.({
          nodeIds: selectedNodeIds,
          primaryId: selectedNodeIds[0] ?? null,
          groupDepth: 0,
          touchMode: false,
        });
        return true;
      }
      const duplicated = duplicateStudioClipboard(
        payload,
        latest.current.projectId,
        elements.find(element => element.id === latest.current.page.id)
      );
      for (const source of duplicated.semanticElements)
        semanticSources.current.set(source.id, source);
      api.addFiles(Object.values(duplicated.files));
      publishSceneChange([...elements, ...duplicated.elements], duplicated.selectedIds);
      return true;
    };

    const cutSelection = (
      elements: readonly ExcalidrawElement[],
      state: Readonly<AppState>,
      clipboardData?: DataTransfer | null
    ) => {
      const selectedIds = Object.keys(state.selectedElementIds);
      const cuttableIds = new Set(
        elements
          .filter(element => {
            const data = element.customData;
            return (
              selectedIds.includes(element.id) &&
              !element.locked &&
              !data?.polityMaster &&
              !data?.polityFrameBackground
            );
          })
          .map(element => element.id)
      );
      const payload = captureClipboard(
        elements,
        {
          ...state,
          selectedElementIds: Object.fromEntries([...cuttableIds].map(id => [id, true])),
        },
        latest.current.selectionState?.nodeIds.filter(nodeId => {
          const node = latest.current.v3Document?.nodes.find(candidate => candidate.id === nodeId);
          return !!node && !node.locked;
        })
      );
      if (!storeClipboard(payload, clipboardData) || !payload) return false;
      if (payload.version === 2) {
        if (!latest.current.cutV3Clipboard) return false;
        latest.current.cutV3Clipboard(payload.rootNodeIds);
        syncedSelection.current = [];
        if (latest.current.selectExact) latest.current.selectExact([]);
        else latest.current.select([]);
        latest.current.onSelectionChange?.(emptyStudioSelection());
        return true;
      }
      const copiedIds = new Set(payload.elements.map(element => element.id));
      publishSceneChange(
        elements.map(element =>
          copiedIds.has(element.id) && !element.locked
            ? ({
                ...element,
                isDeleted: true,
                version: element.version + 1,
                versionNonce: Math.floor(Math.random() * 2 ** 31),
                updated: Date.now(),
              } as ExcalidrawElement)
            : element
        ),
        selectedIds.filter(id => !copiedIds.has(id))
      );
      return true;
    };

    const dispatchExternalPaste = (event: ClipboardEvent) => {
      const target =
        host.current?.querySelector<HTMLElement>('.excalidraw') ?? host.current ?? document.body;
      target.dispatchEvent(event);
    };

    const pasteFromContextMenu = async (app?: AppClassProperties) => {
      await clipboardWrite.current;
      const system = await readClipboardForContextMenu();
      const systemPayload = system.text ? parseStudioClipboard(system.text) : null;
      if (systemPayload) return pastePayload(systemPayload);
      if (system.text || system.event) {
        if (app && system.event) await app.pasteFromClipboard(system.event);
        else {
          const event =
            system.event ??
            (() => {
              const transfer = new DataTransfer();
              transfer.setData('text/plain', system.text);
              return new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: transfer,
              });
            })();
          dispatchExternalPaste(event);
        }
        return true;
      }
      const fallback = getProjectStudioClipboard(latest.current.projectId);
      return fallback ? pastePayload(fallback) : false;
    };

    useEffect(() => {
      if (!api) return;
      api.registerAction({
        name: 'copy',
        label: 'labels.copy',
        trackEvent: false,
        perform: (elements, state, event) => {
          storeClipboard(
            captureClipboard(elements, state),
            event instanceof ClipboardEvent ? event.clipboardData : null
          );
          return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
        },
      });
      api.registerAction({
        name: 'cut',
        label: 'labels.cut',
        trackEvent: false,
        keyTest: event => (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x',
        perform: (elements, state, event) => {
          cutSelection(
            elements,
            state,
            event instanceof ClipboardEvent ? event.clipboardData : null
          );
          return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
        },
      });
      api.registerAction({
        name: 'paste',
        label: 'labels.paste',
        trackEvent: false,
        perform: async (_elements, _state, _event, app) => {
          await pasteFromContextMenu(app);
          return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
        },
      });
    }, [api, props.projectId]);

    const applySelectionState = (selection: StudioSelectionState) => {
      if (!api) return;
      const selectedIds = sceneIdsForNodes(
        api.getSceneElements(),
        latest.current,
        selection.nodeIds
      );
      applying.current = true;
      api.updateScene({
        appState: { selectedElementIds: Object.fromEntries(selectedIds.map(id => [id, true])) },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      applying.current = false;
      setSelectedSceneIds(selectedIds);
      syncedSelection.current = selection.nodeIds;
      if (latest.current.selectExact) latest.current.selectExact(selection.nodeIds);
      else latest.current.select(selection.nodeIds);
      latest.current.onSelectionChange?.(selection);
    };

    useEffect(() => {
      if (!api || !props.selectionState?.touchMode) return;
      const endTouchSelection = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        const selection = latest.current.selectionState ?? emptyStudioSelection();
        applySelectionState({ ...selection, touchMode: false });
      };
      window.addEventListener('keydown', endTouchSelection);
      return () => window.removeEventListener('keydown', endTouchSelection);
    }, [api, props.selectionState?.touchMode]);

    const hitTestNode = (clientX: number, clientY: number): string | null => {
      if (!api) return null;
      const state = api.getAppState();
      const x = (clientX - state.offsetLeft) / state.zoom.value - state.scrollX;
      const y = (clientY - state.offsetTop) / state.zoom.value - state.scrollY;
      for (const element of [...api.getSceneElements()].reverse()) {
        const nodeId = sceneNodeId(element, latest.current);
        if (!nodeId || element.locked) continue;
        const node = latest.current.v3Document?.nodes.find(candidate => candidate.id === nodeId);
        if (node && (!node.visible || node.locked)) continue;
        const [left, top, right, bottom] = getCommonBounds([element]);
        if (x >= left && x <= right && y >= top && y <= bottom) return nodeId;
      }
      return null;
    };

    useEffect(() => {
      if (!api) return;
      let suppressClick = false;
      const onPointerDown = (event: PointerEvent) => {
        if (
          !event.shiftKey ||
          event.pointerType === 'touch' ||
          !latest.current.editable ||
          !(event.target instanceof Element) ||
          !host.current?.contains(event.target) ||
          !event.target.closest('.excalidraw')
        )
          return;
        const nodeId = hitTestNode(event.clientX, event.clientY);
        const document = latest.current.v3Document;
        if (!nodeId || !document) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = true;
        applySelectionState(
          toggleSelection(
            document,
            latest.current.selectionState ?? emptyStudioSelection(),
            nodeId,
            true
          )
        );
      };
      const onPointerUp = (event: PointerEvent) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const onClick = (event: MouseEvent) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const onCancel = () => {
        suppressClick = false;
      };
      window.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('pointerup', onPointerUp, true);
      window.addEventListener('pointercancel', onCancel, true);
      window.addEventListener('click', onClick, true);
      return () => {
        window.removeEventListener('pointerdown', onPointerDown, true);
        window.removeEventListener('pointerup', onPointerUp, true);
        window.removeEventListener('pointercancel', onCancel, true);
        window.removeEventListener('click', onClick, true);
      };
    }, [api]);

    const drillSelection = () => {
      const document = latest.current.v3Document;
      if (!document) return;
      const selection = latest.current.selectionState ?? emptyStudioSelection();
      applySelectionState(drillIntoGroup(document, selection));
    };

    const patchSelection = (patch: Record<string, unknown>) => {
      if (!api) return;
      const currentSelection = Object.keys(api.getAppState().selectedElementIds);
      if (!currentSelection.length) return;
      if (
        currentSelection.some(id => {
          const element = api.getSceneElements().find(candidate => candidate.id === id);
          const nodeId = element ? sceneNodeId(element, latest.current) : null;
          return latest.current.v3Document?.nodes.some(node => node.id === nodeId && node.locked);
        })
      )
        return;
      const selectedIds = new Set(currentSelection);
      publishSceneChange(
        api.getSceneElementsIncludingDeleted().map(element =>
          selectedIds.has(element.id)
            ? ({
                ...element,
                ...patch,
                version: element.version + 1,
                versionNonce: Math.floor(Math.random() * 2 ** 31),
                updated: Date.now(),
              } as ExcalidrawElement)
            : element
        ),
        currentSelection
      );
    };

    const selectionAction = (action: NativeSelectionAction) => {
      latest.current.onArrangeSelection?.(action);
    };

    const executeCommand = async (command: StudioCanvasCommand) => {
      if (!api) return;
      if (command.type === 'selectionAction') {
        selectionAction(command.action);
        return;
      }
      if (command.type === 'clipboard') {
        const elements = api.getSceneElementsIncludingDeleted();
        const state = api.getAppState();
        if (command.action === 'copy') storeClipboard(captureClipboard(elements, state));
        else if (command.action === 'cut') cutSelection(elements, state);
        else await pasteFromContextMenu();
        return;
      }
      if (command.type === 'setTool') {
        const type = excalidrawToolByStudioTool[command.tool];
        if (type) {
          api.setActiveTool({
            type,
            locked: command.locked ?? false,
          } as Parameters<ExcalidrawImperativeAPI['setActiveTool']>[0]);
          if (command.tool === 'rectangle')
            api.updateScene({
              appState: { currentItemRoundness: command.rounded ? 'round' : 'sharp' },
              captureUpdate: CaptureUpdateAction.NEVER,
            });
        }
        return;
      }
      if (command.type === 'zoom') {
        const state = api.getAppState();
        if (command.mode === 'in' || command.mode === 'out' || command.mode === 'reset') {
          const next =
            command.mode === 'reset'
              ? 1
              : Math.max(
                  0.1,
                  Math.min(4, state.zoom.value * (command.mode === 'in' ? 1.2 : 1 / 1.2))
                );
          api.updateScene({
            appState: { zoom: { value: next } as AppState['zoom'] },
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          return;
        }
        const selectedIds = Object.keys(state.selectedElementIds);
        const content =
          command.mode === 'selection'
            ? api.getSceneElements().filter(element => selectedIds.includes(element.id))
            : api.getSceneElements();
        if (content.length) api.scrollToContent(content, { fitToViewport: true });
        return;
      }
      if (command.type === 'search') {
        const query = command.query.trim().toLowerCase();
        if (!query) return;
        const found = api
          .getSceneElements()
          .filter(
            element =>
              ('text' in element && element.text.toLowerCase().includes(query)) ||
              props.page.elements.some(
                projection =>
                  projection.id === element.id && projection.text.toLowerCase().includes(query)
              )
          );
        if (found.length) api.scrollToContent(found, { fitToViewport: true });
        return;
      }
      if (command.type === 'exportScene') {
        await exportScene(command.format);
        return;
      }
      await run(async () => {
        if (command.type === 'importScene') {
          if (command.file.size > 24_000_000) throw new Error('File too large');
          const value = JSON.parse(await command.file.text());
          const scene = canvasSceneSchema.parse({
            version: 1,
            elements: durableElements(
              value.elements.map((element: Record<string, unknown>) => ({
                ...element,
                customData: {},
              }))
            ),
            files: value.files ?? {},
          });
          api.addFiles(Object.values(scene.files) as BinaryFiles[string][]);
          api.updateScene({
            elements: [...restoreElements(scene.elements as never, null), ...projections.current],
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          return;
        }
        if (command.type === 'insertMermaid') {
          const { parseMermaidToExcalidraw } = await import('@excalidraw/mermaid-to-excalidraw');
          const result = await parseMermaidToExcalidraw(command.source);
          const elements = convertToExcalidrawElements(result.elements, { regenerateIds: true });
          if (result.files) api.addFiles(Object.values(result.files));
          api.updateScene({
            elements: [...api.getSceneElements(), ...elements],
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          return;
        }
        if (command.type === 'library' && command.action === 'load') {
          const libraries = await studioRequest<{ content: LibraryItems }[]>('canvas', {
            projectId: props.projectId,
            action: 'libraries',
          });
          await api.updateLibrary({
            libraryItems: libraries.flatMap(item => item.content),
            merge: false,
          });
          return;
        }
        if (command.type === 'library') {
          if (props.draft)
            throw new Error(
              label(
                'Entwurfsbereiche können keine Bereichsbibliothek überschreiben.',
                'Draft workspaces cannot overwrite the workspace library.'
              )
            );
          if (library.current.some(item => item.elements.some(e => e.customData?.polityElement)))
            throw new Error(
              label(
                'Formatierte Studio-Elemente bitte als Studio-Vorlage wiederverwenden.',
                'Reuse formatted Studio elements as Studio templates.'
              )
            );
          const session = await studioRequest<CanvasSession>('canvas', {
            projectId: props.projectId,
            action: 'session',
          });
          await studioRequest('canvas', {
            projectId: props.projectId,
            action: 'saveLibrary',
            title: 'Excalidraw',
            library: library.current,
            generation: session.generation,
            operationId: crypto.randomUUID(),
          });
        }
      });
    };

    useImperativeHandle(ref, () => ({
      execute: executeCommand,
      scenePoint: (clientX: number, clientY: number) => {
        if (!api) return { x: 0, y: 0, targetFrameId: props.page.id };
        const state = api.getAppState() as AppState & {
          offsetLeft?: number;
          offsetTop?: number;
        };
        const zoom = state.zoom.value || 1;
        const x = (clientX - (state.offsetLeft ?? 0)) / zoom - state.scrollX;
        const y = (clientY - (state.offsetTop ?? 0)) / zoom - state.scrollY;
        const target = [...(latest.current.frames ?? [])]
          .reverse()
          .find(
            frame =>
              x >= frame.transform.x &&
              x <= frame.transform.x + frame.transform.width &&
              y >= frame.transform.y &&
              y <= frame.transform.y + frame.transform.height
          );
        return { x, y, targetFrameId: target?.id ?? null };
      },
    }));

    return (
      <div className="w-full">
        {error && (
          <p role="alert" className="text-destructive p-2">
            {error}
          </p>
        )}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {label(
            `${selectedNodeIds.length} Elemente ausgewählt`,
            `${selectedNodeIds.length} elements selected`
          )}
        </span>
        {textEditing && selected?.type === 'text' && (
          <section
            className="bg-background rounded border p-4"
            aria-label={label('Text bearbeiten', 'Edit text')}
          >
            <StudioTextEditor
              element={selected}
              onChange={patch => props.patch(selected.id, patch)}
              register={
                props.registerTextEditor ??
                (() => {
                  /* Optional selection bridge. */
                })
              }
            />
            <button onClick={() => setTextEditing(false)}>{label('Fertig', 'Done')}</button>
          </section>
        )}
        <div
          ref={host}
          className="polity-canvas"
          data-structured-selection={!!selected}
          onClickCapture={event => {
            const item =
              event.target instanceof Element
                ? event.target.closest<HTMLElement>('[data-testid]')
                : null;
            const action = item?.dataset.testid;
            if (!api || !props.editable || !['copy', 'cut', 'paste'].includes(action ?? '')) return;
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            api.updateScene({
              appState: { contextMenu: null },
              captureUpdate: CaptureUpdateAction.NEVER,
            });
            if (action === 'copy')
              storeClipboard(
                captureClipboard(api.getSceneElementsIncludingDeleted(), api.getAppState())
              );
            else if (action === 'cut')
              cutSelection(api.getSceneElementsIncludingDeleted(), api.getAppState());
            else void pasteFromContextMenu();
          }}
          onCopyCapture={event => {
            if (!api || !props.editable) return;
            const payload = captureClipboard(
              api.getSceneElementsIncludingDeleted(),
              api.getAppState()
            );
            if (storeClipboard(payload, event.clipboardData)) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onCutCapture={event => {
            if (!api || !props.editable) return;
            if (
              cutSelection(
                api.getSceneElementsIncludingDeleted(),
                api.getAppState(),
                event.clipboardData
              )
            ) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onPasteCapture={event => {
            if (!api || !props.editable) return;
            const payload = parseStudioClipboard(event.clipboardData.getData('text/plain'));
            if (!payload) return;
            event.preventDefault();
            event.stopPropagation();
            pastePayload(payload);
          }}
          onDoubleClickCapture={event => {
            const selection = latest.current.selectionState;
            const primary = latest.current.v3Document?.nodes.find(
              node => node.id === selection?.primaryId
            );
            if (primary?.groupIds[selection?.groupDepth ?? 0]) {
              event.preventDefault();
              event.stopPropagation();
              drillSelection();
              return;
            }
            if (
              selected?.type === 'table' &&
              props.editable &&
              event.target instanceof HTMLCanvasElement &&
              hitTestNode(event.clientX, event.clientY) === selected.id
            ) {
              event.preventDefault();
              event.stopPropagation();
              setTableEditingId(selected.id);
              return;
            }
            if (
              selected?.type === 'text' &&
              props.editable &&
              event.target instanceof HTMLCanvasElement
            ) {
              event.preventDefault();
              event.stopPropagation();
              setTextEditing(true);
            }
          }}
          onPointerDownCapture={event => {
            if (!(event.target instanceof HTMLCanvasElement)) return;
            if (event.pointerType === 'touch' && props.editable) {
              const nodeId = hitTestNode(event.clientX, event.clientY);
              if (latest.current.selectionState?.touchMode) {
                event.preventDefault();
                event.stopPropagation();
                touchHold.current = {
                  x: event.clientX,
                  y: event.clientY,
                  nodeId,
                  timer: null,
                  triggered: false,
                };
                return;
              }
              const hold = {
                x: event.clientX,
                y: event.clientY,
                nodeId,
                timer: null as ReturnType<typeof setTimeout> | null,
                triggered: false,
              };
              hold.timer = setTimeout(() => {
                if (touchHold.current !== hold || !hold.nodeId || !latest.current.v3Document)
                  return;
                hold.triggered = true;
                const selection = latest.current.selectionState ?? emptyStudioSelection();
                applySelectionState({
                  ...toggleSelection(latest.current.v3Document, selection, hold.nodeId, true),
                  touchMode: true,
                });
              }, 450);
              touchHold.current = hold;
            }
            gesture.current = true;
          }}
          onPointerMoveCapture={event => {
            const hold = touchHold.current;
            if (!hold || hold.triggered) return;
            if (Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 8) {
              if (hold.timer) clearTimeout(hold.timer);
              touchHold.current = null;
            }
          }}
          onPointerUpCapture={event => {
            const hold = touchHold.current;
            if (hold?.timer) clearTimeout(hold.timer);
            touchHold.current = null;
            if (event.pointerType === 'touch' && latest.current.selectionState?.touchMode) {
              event.preventDefault();
              event.stopPropagation();
              gesture.current = false;
              if (hold?.nodeId && !hold.triggered && latest.current.v3Document)
                applySelectionState(
                  toggleSelection(
                    latest.current.v3Document,
                    latest.current.selectionState,
                    hold.nodeId,
                    true
                  )
                );
              return;
            }
            if (gesture.current)
              requestAnimationFrame(() => {
                gesture.current = false;
                if (api)
                  change(api.getSceneElementsIncludingDeleted(), api.getAppState(), api.getFiles());
                setGestureEnd(v => v + 1);
              });
          }}
          onPointerCancelCapture={() => {
            if (touchHold.current?.timer) clearTimeout(touchHold.current.timer);
            touchHold.current = null;
            gesture.current = false;
            setGestureEnd(v => v + 1);
          }}
          onKeyDownCapture={ev => {
            const target = ev.target instanceof HTMLElement ? ev.target : null;
            if (tableEditingId && target?.closest('.polity-table-edit-layer')) return;
            const typing = !!target?.closest('input,textarea,select,[contenteditable="true"]');
            if (!typing && ev.key === 'Escape') {
              ev.preventDefault();
              ev.stopPropagation();
              const selection = latest.current.selectionState ?? emptyStudioSelection();
              applySelectionState(
                selection.touchMode ? { ...selection, touchMode: false } : emptyStudioSelection()
              );
              return;
            }
            if (!typing && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'a') {
              ev.preventDefault();
              ev.stopPropagation();
              const nodeIds = [
                ...new Set(
                  api?.getSceneElements().flatMap(element => {
                    const id = sceneNodeId(element, latest.current);
                    const node = latest.current.v3Document?.nodes.find(
                      candidate => candidate.id === id
                    );
                    return id && node && node.visible && !node.locked ? [id] : [];
                  }) ?? []
                ),
              ];
              applySelectionState({
                nodeIds,
                primaryId: nodeIds[0] ?? null,
                groupDepth: 0,
                touchMode: false,
              });
              return;
            }
            if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'g' && !typing) {
              ev.preventDefault();
              ev.stopPropagation();
              latest.current.onArrangeSelection?.(ev.shiftKey ? 'ungroup' : 'group');
              return;
            }
            if (!typing && ev.key === 'Enter' && latest.current.selectionState?.nodeIds.length) {
              const selection = latest.current.selectionState;
              const primary = latest.current.v3Document?.nodes.find(
                node => node.id === selection.primaryId
              );
              if (primary?.groupIds[selection.groupDepth]) {
                ev.preventDefault();
                ev.stopPropagation();
                drillSelection();
                return;
              }
            }
            if (
              ev.key === 'Enter' &&
              selected?.type === 'text' &&
              props.editable &&
              ev.target instanceof HTMLElement &&
              !ev.target.closest('input,textarea,select,button,[contenteditable="true"]')
            ) {
              ev.preventDefault();
              ev.stopPropagation();
              setTextEditing(true);
              return;
            }
            if ((ev.ctrlKey || ev.metaKey) && ['z', 'y'].includes(ev.key.toLowerCase())) {
              ev.preventDefault();
              ev.stopPropagation();
              if (ev.shiftKey || ev.key.toLowerCase() === 'y') props.redo();
              else props.undo();
            }
          }}
        >
          <Excalidraw
            excalidrawAPI={setApi}
            onChange={change}
            onDuplicate={identifyDuplicatedProjections}
            onPaste={data => {
              if (
                data.elements?.some(
                  e =>
                    e.customData?.polityElement &&
                    !semanticSources.current.has(String(e.customData?.polityElement))
                )
              ) {
                setError(
                  label(
                    'Dieses formatierte Element gehört zu einem anderen Projekt. Verwende eine Studio-Vorlage oder kopiere das Projekt einschließlich Medien.',
                    'This formatted element belongs to another project. Use a Studio template or duplicate the project with its media.'
                  )
                );
                return false;
              }
              return true;
            }}
            onLibraryChange={items => {
              library.current = items;
            }}
            generateLinkForSelection={(id, type) =>
              `${location.origin}${location.pathname}${location.search}#canvas=${encodeURIComponent(props.page.id)}&${type}=${encodeURIComponent(id)}`
            }
            theme={theme}
            langCode={de ? 'de-DE' : 'en'}
            viewModeEnabled={!props.editable}
            zenModeEnabled
            handleKeyboardGlobally={false}
            initialData={{
              elements: sceneElements(props.page.canvas),
              appState: {
                viewBackgroundColor: theme === 'dark' ? '#111315' : '#f2f0ea',
                currentItemRoughness: props.whiteboard ? 1 : 0,
                currentItemFontFamily: 2,
              },
            }}
            onPointerUpdate={({ pointer }) => props.cursor(pointer.x, pointer.y)}
            UIOptions={{
              canvasActions: {
                saveToActiveFile: false,
                export: false,
                loadScene: false,
                clearCanvas: false,
                changeViewBackgroundColor: false,
              },
            }}
          />
          {props.editable &&
            tableEditingId === selected?.id &&
            tableGeometry &&
            selected.type === 'table' && (
              <StudioTableEditor
                element={selected}
                geometry={tableGeometry}
                de={de}
                onChange={table => props.patch(selected.id, { table })}
                onDelete={() => {
                  props.removeTable?.(selected.id);
                  setTableEditingId(null);
                }}
                onClose={closeTableEditor}
                onUndo={props.undo}
                onRedo={props.redo}
              />
            )}
          {props.editable &&
            !tableEditingId &&
            !selectionGeometry?.interacting &&
            ((selectionGeometry && (selected || nativeSelectedElements.length > 0)) ||
              props.selectionState?.touchMode) && (
              <div
                className="polity-canvas-context"
                role="toolbar"
                aria-label={label('Kontextwerkzeuge', 'Context tools')}
                style={{
                  left: selectionGeometry
                    ? Math.max(
                        8,
                        Math.min(
                          (selectionGeometry.left + selectionGeometry.right) / 2 - 120,
                          window.innerWidth - 248
                        )
                      )
                    : 8,
                  top: !selectionGeometry
                    ? window.innerHeight - 90
                    : selectionGeometry.top > 116
                      ? selectionGeometry.top - 48
                      : selectionGeometry.bottom + 8,
                }}
              >
                <span className="px-2 text-xs whitespace-nowrap">
                  {label(
                    `${selectedNodeIds.length} ausgewählt`,
                    `${selectedNodeIds.length} selected`
                  )}
                </span>
                <button
                  className="polity-style-button"
                  aria-label={label('Horizontal zentrieren', 'Center horizontally')}
                  disabled={!selectionGroups.length || selectedV3Nodes.some(node => node.locked)}
                  onClick={() => props.onAlignSelection?.('center')}
                >
                  <AlignCenter className="size-4" />
                </button>
                <button
                  className="polity-style-button"
                  aria-label={label('Vertikal zentrieren', 'Center vertically')}
                  disabled={!selectionGroups.length || selectedV3Nodes.some(node => node.locked)}
                  onClick={() => props.onAlignSelection?.('middle')}
                >
                  <MoveVertical className="size-4" />
                </button>
                <button
                  className="polity-style-button"
                  aria-label={label('Horizontal verteilen', 'Distribute horizontally')}
                  disabled={selectionGroups.length < 3 || selectedV3Nodes.some(node => node.locked)}
                  onClick={() => props.onDistributeSelection?.('horizontal')}
                >
                  <MoveHorizontal className="size-4" />
                </button>
                <button
                  className="polity-style-button"
                  aria-label={label('Vertikal verteilen', 'Distribute vertically')}
                  disabled={selectionGroups.length < 3 || selectedV3Nodes.some(node => node.locked)}
                  onClick={() => props.onDistributeSelection?.('vertical')}
                >
                  <MoveVertical className="size-4" />
                </button>
                <button
                  className="polity-style-button"
                  aria-label={label('Gruppieren', 'Group')}
                  disabled={!canGroup}
                  onClick={() => props.onArrangeSelection?.('group')}
                >
                  <Group className="size-4" />
                </button>
                <button
                  className="polity-style-button"
                  aria-label={label('Gruppe lösen', 'Ungroup')}
                  disabled={!canUngroup}
                  onClick={() => props.onArrangeSelection?.('ungroup')}
                >
                  <Ungroup className="size-4" />
                </button>
                {canUngroup && (
                  <button
                    className="polity-style-button"
                    aria-label={label('In Gruppe auswählen', 'Select inside group')}
                    onClick={drillSelection}
                  >
                    <span aria-hidden="true">↳</span>
                  </button>
                )}
                {(props.selectionState?.groupDepth ?? 0) > 0 && (
                  <button
                    className="polity-style-button"
                    aria-label={label('Gruppe verlassen', 'Leave group')}
                    onClick={() => {
                      const selection = props.selectionState ?? emptyStudioSelection();
                      const depth = selection.groupDepth - 1;
                      const nodeIds =
                        props.v3Document && selection.primaryId
                          ? groupMembers(props.v3Document, selection.primaryId, depth)
                          : [];
                      applySelectionState({ ...selection, groupDepth: depth, nodeIds });
                    }}
                  >
                    <span aria-hidden="true">↰</span>
                  </button>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="polity-style-button"
                      aria-label={label('Auswahlmodus', 'Selection mode')}
                      aria-pressed={!!props.selectionState?.touchMode}
                      onClick={() =>
                        applySelectionState({
                          ...(props.selectionState ?? emptyStudioSelection()),
                          touchMode: !props.selectionState?.touchMode,
                        })
                      }
                    >
                      <Check className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {label(
                      'Weitere Elemente durch Antippen zur Auswahl hinzufügen',
                      'Tap more objects to add them to the selection'
                    )}
                  </TooltipContent>
                </Tooltip>
                {props.selectionState?.touchMode && (
                  <button
                    className="polity-style-button"
                    aria-label={label('Auswahl beenden', 'Finish selection')}
                    onClick={() =>
                      applySelectionState({
                        ...(props.selectionState ?? emptyStudioSelection()),
                        touchMode: false,
                      })
                    }
                  >
                    <Check className="size-4" />
                    <span>{label('Fertig', 'Done')}</span>
                  </button>
                )}
                {selected?.type === 'text' && (
                  <button
                    className="polity-style-button"
                    aria-label={label('Text bearbeiten', 'Edit text')}
                    onClick={() => setTextEditing(v => !v)}
                  >
                    <Type className="size-4" />
                  </button>
                )}
                {selected?.type === 'table' && (
                  <button
                    ref={tableButtonRef}
                    className="polity-style-button"
                    aria-label={label('Tabelle bearbeiten', 'Edit table')}
                    onClick={() => setTableEditingId(selected.id)}
                  >
                    <Table2 className="size-4" />
                  </button>
                )}
                <button
                  className="polity-style-button"
                  aria-label={label('Fokussieren', 'Focus')}
                  onClick={() => {
                    const chosen = api
                      ?.getSceneElements()
                      .filter(element => selectedSceneIds.includes(element.id));
                    if (chosen?.length) api?.scrollToContent(chosen, { fitToViewport: true });
                  }}
                >
                  <ScanSearch className="size-4" />
                </button>
              </div>
            )}
          {props.editable &&
            !textEditing &&
            !tableEditingId &&
            !selectionGeometry?.interacting &&
            selected &&
            props.inspector && (
              <aside
                className="polity-canvas-properties"
                aria-label={label('Elementeigenschaften', 'Element properties')}
              >
                {props.inspector}
              </aside>
            )}
          {props.editable &&
            !selectionGeometry?.interacting &&
            !selected &&
            nativeSelectedElements.length > 0 && (
              <aside
                className="polity-canvas-properties"
                aria-label={label('Elementeigenschaften', 'Element properties')}
              >
                <NativeCanvasProperties
                  elements={nativeSelectedElements}
                  disabled={!props.editable || selectedV3Nodes.some(node => node.locked)}
                  de={de}
                  themeColors={props.themeColors}
                  canFormat={
                    !!nativeSelected &&
                    canFormatNativeText(
                      props.page.canvas?.elements.find(e => e.id === nativeSelected.id)
                    )
                  }
                  canGroup={canGroup}
                  canUngroup={canUngroup}
                  patch={patchSelection}
                  action={selectionAction}
                  format={style => {
                    if (!nativeSelected) return;
                    void run(async () => {
                      const base = latest.current.page;
                      const result = formatNativeText(base, nativeSelected.id, style);
                      const text = result.text;
                      const font = `${text.italic ? 'italic ' : ''}${text.bold ? 'bold ' : ''}${text.fontSize}px "${text.font}"`;
                      await document.fonts.load(font);
                      changingRepresentation.current = true;
                      props.replace(result.page, base);
                      setTimeout(() => {
                        if (latest.current.page === base) changingRepresentation.current = false;
                      }, 0);
                      props.select([result.text.id]);
                    });
                  }}
                />
              </aside>
            )}
        </div>
      </div>
    );
  }
);

export default ExcalidrawCanvas;
