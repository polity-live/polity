import { canvasSceneSchema, type CanvasScene } from './canvas-schema';
import {
  documentSchema,
  elementSchema,
  formats,
  paragraphSchema,
  tableDataSchema,
  chartDataSchema,
  type StudioDocument,
  type StudioElement,
  type StudioPage,
} from './document';
import {
  framePresetRegistry,
  STUDIO_DOCUMENT_SCHEMA_VERSION,
  studioDocumentV3Schema,
  type FrameNode,
  type FramePresetId,
  type StudioDocumentV3,
  type StudioNode,
  type StudioPlateChild,
  type StudioPlateElement,
} from './document-v3';
import { DEFAULT_STUDIO_THEME, themeToLegacyBrand } from './theme';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Stable UUIDs allow arbitrary imported Excalidraw IDs to participate in the V4 graph. */
function stableUuid(scope: string, value: string): string {
  if (uuidPattern.test(value)) return value;
  const input = `${scope}:${value}`;
  const words = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (let index = 0; index < input.length; index++)
    for (let word = 0; word < words.length; word++) {
      words[word] ^= input.charCodeAt(index) + word * 41;
      words[word] = Math.imul(words[word], 0x01000193) >>> 0;
    }
  const hex = words.map(word => word.toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function nativeCanvasNodeId(frameId: string, sceneId: string): string {
  return stableUuid(frameId, `native:${sceneId}`);
}

const formatToPreset: Record<StudioPage['format'], FramePresetId> = {
  feed: 'portrait',
  square: 'square',
  story: 'story',
  widescreen: 'widescreen',
  standard: 'standard',
};
const presetToFormat: Record<FramePresetId, StudioPage['format']> = {
  portrait: 'feed',
  square: 'square',
  story: 'story',
  widescreen: 'widescreen',
  standard: 'standard',
};

function styleFromElement(element: StudioElement) {
  return {
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
    strokeStyle: 'solid' as const,
    opacity: element.opacity,
    cornerRadius: 0,
    roughness: 0,
  };
}

function commonNode(element: StudioElement, parentFrameId: string, base?: StudioNode) {
  const nextStyle = styleFromElement(element);
  const fillChanged = !!base && base.style.fill !== nextStyle.fill;
  const strokeChanged = !!base && base.style.stroke !== nextStyle.stroke;
  return {
    id: element.id,
    name: base?.name ?? (element.text.slice(0, 80) || element.type),
    parentFrameId,
    transform: {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      flipX: element.flipX,
      flipY: element.flipY,
    },
    zIndex: element.order,
    visible: element.visible,
    locked: element.locked,
    groupIds: element.group
      ? base?.groupIds[0] === element.group ||
        base?.groupIds[0] === stableUuid('group', element.group)
        ? [...base.groupIds]
        : [stableUuid('group', element.group)]
      : [],
    constraints: base?.constraints ?? { horizontal: 'left' as const, vertical: 'top' as const },
    style: {
      ...nextStyle,
      strokeStyle: base?.style.strokeStyle ?? 'solid',
      cornerRadius: base?.style.cornerRadius ?? 0,
      roughness: base?.style.roughness ?? 0,
      fillBinding: fillChanged ? null : (base?.style.fillBinding ?? null),
      strokeBinding: strokeChanged ? null : (base?.style.strokeBinding ?? null),
    },
    componentRef: base?.componentRef ?? null,
    overrides: [
      ...(base?.overrides ?? []),
      ...(fillChanged ? ['style.fill'] : []),
      ...(strokeChanged ? ['style.stroke'] : []),
    ].filter((value, index, values) => values.indexOf(value) === index),
    animation: element.animation,
  };
}

function richContent(element: StudioElement, base?: StudioNode): StudioPlateElement[] {
  if (base?.type === 'richText' && element.text === textFromContent(base.content))
    return base.content;
  const existing = base?.type === 'richText' ? base.content : [];
  const paragraphs: StudioElement['richText'] = element.richText.length
    ? element.richText
    : element.text.split('\n').map((text, index) => ({
        id: stableUuid(element.id, `paragraph:${index}`),
        type: 'p' as const,
        children: [
          {
            text,
            bold: element.bold,
            italic: element.italic,
            underline: element.underline,
            strikethrough: element.strikethrough,
          },
        ],
      }));
  return paragraphs.map((paragraph, paragraphIndex) => ({
    id: paragraph.id,
    type: paragraph.type,
    ...(paragraph.align !== undefined ? { align: paragraph.align } : {}),
    ...(paragraph.list !== undefined ? { list: paragraph.list } : {}),
    children: paragraph.children.map((run, runIndex) => {
      const old = existing[paragraphIndex]?.children[runIndex];
      const oldId = old && 'text' in old && typeof old.id === 'string' ? old.id : undefined;
      return {
        id: oldId ?? stableUuid(paragraph.id, `run:${runIndex}`),
        ...run,
      };
    }),
  }));
}

function semanticNode(
  element: StudioElement,
  parentFrameId: string,
  base?: StudioNode
): StudioNode {
  const common = commonNode(element, parentFrameId, base);
  if (element.type === 'text')
    return {
      ...common,
      type: 'richText',
      content: richContent(element, base),
      typography: {
        fontFamily: element.font,
        fontSize: element.fontSize,
        lineHeight: element.lineHeight,
        letterSpacing: base?.type === 'richText' ? base.typography.letterSpacing : 0,
        horizontalAlign: element.align,
        verticalAlign: element.verticalAlign,
        textStyleId:
          base?.type === 'richText' &&
          base.typography.fontFamily === element.font &&
          base.typography.fontSize === element.fontSize &&
          base.typography.lineHeight === element.lineHeight &&
          base.typography.horizontalAlign === element.align
            ? base.typography.textStyleId
            : null,
      },
    };
  if (element.type === 'image' || element.type === 'video') {
    if (!element.assetId) throw new Error(`Media element ${element.id} has no asset`);
    return {
      ...common,
      type: 'media',
      mediaType: element.type,
      assetId: element.assetId,
      fit: element.fit,
      focus: { x: element.cropX, y: element.cropY },
      crop: element.crop,
      trim: { start: element.trimStart, end: null },
      muted: element.muted,
      alt: element.text,
    };
  }
  if (element.type === 'table')
    return {
      ...common,
      type: 'table',
      data: tableDataSchema.parse(
        element.table ?? {
          widths: [1],
          border: '#888888',
          rows: [
            {
              id: stableUuid(element.id, 'table-row'),
              cells: [
                {
                  id: stableUuid(element.id, 'table-cell'),
                  text: '',
                  fill: '#FFFFFF',
                  color: '#12362D',
                  align: 'left',
                  bold: false,
                },
              ],
            },
          ],
        }
      ),
    };
  if (element.type === 'chart')
    return {
      ...common,
      type: 'chart',
      data: chartDataSchema.parse(
        element.chart ?? {
          kind: 'bar',
          labels: ['A'],
          legend: true,
          series: [
            {
              id: stableUuid(element.id, 'chart-series'),
              name: 'Series',
              color: '#B88A3B',
              values: [0],
            },
          ],
        }
      ),
      sourceAssetId: null,
    };
  return {
    ...common,
    type: 'shape',
    shape:
      element.type === 'rect'
        ? base?.type === 'shape' && (base.shape === 'diamond' || base.shape === 'rounded-rectangle')
          ? base.shape
          : 'rectangle'
        : element.type === 'ellipse'
          ? 'ellipse'
          : element.type,
    startArrowhead: 'none',
    endArrowhead: element.type === 'arrow' ? 'arrow' : 'none',
    startBindingId: null,
    endBindingId: null,
  };
}

function nativeNode(
  element: CanvasScene['elements'][number],
  pageId: string,
  idMap: Map<string, string>,
  base?: StudioNode
): StudioNode {
  const root =
    typeof element.customData === 'object' &&
    element.customData !== null &&
    !Array.isArray(element.customData) &&
    element.customData.polityRoot === true;
  const durableNodeId =
    root &&
    typeof element.customData === 'object' &&
    element.customData !== null &&
    !Array.isArray(element.customData) &&
    typeof element.customData.polityNode === 'string' &&
    uuidPattern.test(element.customData.polityNode)
      ? element.customData.polityNode
      : undefined;
  const id = durableNodeId ?? idMap.get(element.id) ?? stableUuid(pageId, `native:${element.id}`);
  const frameId = typeof element.frameId === 'string' ? idMap.get(element.frameId) : undefined;
  const parentFrameId = root ? null : (frameId ?? pageId);
  const strokeStyle: 'solid' | 'dashed' | 'dotted' =
    element.strokeStyle === 'dashed' || element.strokeStyle === 'dotted'
      ? element.strokeStyle
      : 'solid';
  const style = {
    fill:
      typeof element.backgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(element.backgroundColor)
        ? element.backgroundColor
        : null,
    stroke:
      typeof element.strokeColor === 'string' && /^#[0-9a-f]{6}$/i.test(element.strokeColor)
        ? element.strokeColor
        : null,
    strokeWidth: typeof element.strokeWidth === 'number' ? element.strokeWidth : 0,
    strokeStyle,
    opacity: typeof element.opacity === 'number' ? element.opacity / 100 : 1,
    cornerRadius: 0,
    roughness: typeof element.roughness === 'number' ? element.roughness : 0,
    fillBinding:
      base && base.style.fill === element.backgroundColor ? base.style.fillBinding : null,
    strokeBinding:
      base && base.style.stroke === element.strokeColor ? base.style.strokeBinding : null,
  };
  const common = {
    id,
    name: typeof element.name === 'string' && element.name ? element.name : element.type,
    parentFrameId,
    transform: {
      x: element.x,
      y: element.y,
      width: Math.max(1, element.width),
      height: Math.max(1, element.height),
      rotation: (element.angle * 180) / Math.PI,
      flipX: Array.isArray(element.scale) && Number(element.scale[0]) < 0,
      flipY: Array.isArray(element.scale) && Number(element.scale[1]) < 0,
    },
    zIndex:
      typeof element.customData === 'object' &&
      element.customData &&
      'polityOrder' in element.customData &&
      typeof element.customData.polityOrder === 'number'
        ? element.customData.polityOrder
        : 0,
    visible: !element.isDeleted,
    locked: element.locked === true,
    groupIds: Array.isArray(element.groupIds)
      ? element.groupIds.map(id => stableUuid('group', String(id))).reverse()
      : [],
    constraints: base?.constraints ?? { horizontal: 'left' as const, vertical: 'top' as const },
    style,
    componentRef: base?.componentRef ?? null,
    overrides: [
      ...(base?.overrides ?? []),
      ...(base && base.style.fill !== style.fill ? ['style.fill'] : []),
      ...(base && base.style.stroke !== style.stroke ? ['style.stroke'] : []),
    ].filter((value, index, values) => values.indexOf(value) === index),
    animation: base?.animation ?? 'none',
  };
  if (element.type === 'frame' || element.type === 'magicframe')
    return {
      ...common,
      type: 'frame',
      preset: 'custom',
      duration: base?.type === 'frame' ? base.duration : 5,
      transition: base?.type === 'frame' ? base.transition : 'none',
      clipContent: base?.type === 'frame' ? base.clipContent : true,
      safeAreas: base?.type === 'frame' ? base.safeAreas : { top: 0, right: 0, bottom: 0, left: 0 },
      grid: base?.type === 'frame' ? base.grid : { enabled: true, size: 8, snap: true },
      layout:
        base?.type === 'frame'
          ? base.layout
          : { mode: 'free', padding: 0, gap: 0, align: 'start', justify: 'start' },
    };
  if (element.type === 'text') {
    const text = typeof element.text === 'string' ? element.text : '';
    return {
      ...common,
      type: 'richText',
      content: text.split('\n').map((value, index) => ({
        id: stableUuid(id, `paragraph:${index}`),
        type: 'p',
        children: [{ id: stableUuid(id, `run:${index}`), text: value }],
      })),
      typography: {
        fontFamily: 'Manrope',
        fontSize: typeof element.fontSize === 'number' ? element.fontSize : 42,
        lineHeight: typeof element.lineHeight === 'number' ? element.lineHeight : 1.2,
        letterSpacing: 0,
        horizontalAlign:
          element.textAlign === 'center' || element.textAlign === 'right'
            ? element.textAlign
            : 'left',
        verticalAlign:
          element.verticalAlign === 'middle' || element.verticalAlign === 'bottom'
            ? element.verticalAlign
            : 'top',
        textStyleId: base?.type === 'richText' ? base.typography.textStyleId : null,
      },
    };
  }
  if (element.type === 'freedraw')
    return {
      ...common,
      type: 'drawing',
      tool: 'pen',
      points: Array.isArray(element.points)
        ? element.points.filter(
            (point): point is [number, number] =>
              Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
          )
        : [],
    };
  if (element.type === 'image')
    return { ...common, type: 'embed', provider: 'supported', value: 'excalidraw-image' };
  return {
    ...common,
    type: 'shape',
    shape:
      element.type === 'rectangle'
        ? 'rectangle'
        : element.type === 'diamond'
          ? 'diamond'
          : element.type === 'ellipse'
            ? 'ellipse'
            : element.type === 'arrow'
              ? 'arrow'
              : 'line',
    startArrowhead: element.startArrowhead === 'arrow' ? 'arrow' : 'none',
    endArrowhead: element.endArrowhead === 'arrow' ? 'arrow' : 'none',
    startBindingId: null,
    endBindingId: null,
  };
}

export function legacyDocumentToV3(
  input: StudioDocument,
  previous?: StudioDocumentV3
): StudioDocumentV3 {
  const legacy = documentSchema.parse(input);
  const previousNodes = new Map(previous?.nodes.map(node => [node.id, node]) ?? []);
  const nodes: StudioNode[] = [];
  const files: Record<string, unknown> = {};
  legacy.pages.forEach((page, index) => {
    const preset = formatToPreset[page.format];
    const definition = framePresetRegistry[preset];
    const oldFrame = previousNodes.get(page.id);
    const frame: FrameNode = {
      id: page.id,
      type: 'frame',
      name: page.name,
      parentFrameId: oldFrame?.parentFrameId ?? null,
      transform: oldFrame?.transform ?? {
        x: (index % 4) * (definition.width + 160),
        y: Math.floor(index / 4) * (definition.height + 220),
        width: definition.width,
        height: definition.height,
        rotation: 0,
        flipX: false,
        flipY: false,
      },
      zIndex: page.order,
      visible: oldFrame?.visible ?? true,
      locked: oldFrame?.locked ?? false,
      groupIds: oldFrame?.groupIds ?? [],
      constraints: oldFrame?.constraints ?? { horizontal: 'left', vertical: 'top' },
      style: oldFrame?.style ?? {
        fill: page.background,
        fillBinding: null,
        stroke: '#888888',
        strokeBinding: null,
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
        cornerRadius: 0,
        roughness: 0,
      },
      componentRef: oldFrame?.componentRef ?? null,
      overrides: oldFrame?.overrides ?? [],
      animation: oldFrame?.animation ?? 'none',
      preset,
      duration: page.duration,
      transition: page.transition,
      clipContent: oldFrame?.type === 'frame' ? oldFrame.clipContent : true,
      safeAreas:
        oldFrame?.type === 'frame'
          ? oldFrame.safeAreas
          : {
              top: definition.safeArea,
              right: definition.safeArea,
              bottom: definition.safeArea,
              left: definition.safeArea,
            },
      grid: oldFrame?.type === 'frame' ? oldFrame.grid : { enabled: true, size: 8, snap: true },
      layout:
        oldFrame?.type === 'frame'
          ? oldFrame.layout
          : { mode: 'free', padding: 0, gap: 0, align: 'start', justify: 'start' },
    };
    nodes.push(frame);
    nodes.push(
      ...page.elements.map(element => semanticNode(element, page.id, previousNodes.get(element.id)))
    );
    const durable = page.canvas?.elements.filter(element => !element.isDeleted) ?? [];
    const idMap = new Map(
      durable.map(element => [element.id, stableUuid(page.id, `native:${element.id}`)])
    );
    for (const element of durable) {
      const id = idMap.get(element.id) ?? stableUuid(page.id, `native:${element.id}`);
      if (!previousNodes.has(id) && page.elements.some(source => source.id === element.id))
        continue;
      nodes.push(nativeNode(element, page.id, idMap, previousNodes.get(id)));
    }
    Object.assign(files, page.canvas?.files ?? {});
  });
  // The legacy page projection intentionally has no representation for free
  // whiteboard nodes or the project master. Keep them intact while legacy UI
  // transactions still exist during the V4 rollout.
  if (previous) {
    const pageIds = new Set(legacy.pages.map(page => page.id));
    const deletedNativeIds = new Set(
      legacy.pages.flatMap(page =>
        (page.canvas?.elements ?? [])
          .filter(element => element.isDeleted)
          .map(element => {
            const customData = element.customData;
            return typeof customData === 'object' &&
              customData !== null &&
              !Array.isArray(customData) &&
              typeof customData.polityNode === 'string' &&
              uuidPattern.test(customData.polityNode)
              ? customData.polityNode
              : stableUuid(page.id, `native:${element.id}`);
          })
      )
    );
    const preserved = previous.nodes.filter(node => {
      if (deletedNativeIds.has(node.id)) return false;
      if (node.id === previous.masterLayout.frameId) return true;
      if (node.parentFrameId === previous.masterLayout.frameId) return true;
      if (node.parentFrameId === null && node.type !== 'frame') return true;
      return (
        node.parentFrameId !== null &&
        !pageIds.has(node.parentFrameId) &&
        !nodes.some(v => v.id === node.id)
      );
    });
    nodes.push(...preserved.filter(node => !nodes.some(candidate => candidate.id === node.id)));
  }
  const deliverables = legacy.posts.map((post, index) => {
    const old = previous?.deliverables.find(item => item.id === post.id);
    return {
      id: post.id,
      code: post.code,
      title: post.title,
      kind: post.kind,
      frameIds: post.pageIds,
      channel: old?.channel ?? ('instagram' as const),
      order: old?.order ?? index,
      status: post.status,
      dayOffset: post.day,
      scheduledAt: old?.scheduledAt ?? null,
      assignee: post.assignee,
      brief: post.action,
      captions: post.captions,
    };
  });
  return studioDocumentV3Schema.parse({
    schemaVersion: STUDIO_DOCUMENT_SCHEMA_VERSION,
    title: legacy.title,
    kind: legacy.kind,
    theme: previous?.theme ?? DEFAULT_STUDIO_THEME,
    frameDefaults: previous?.frameDefaults ?? { background: null },
    masterLayout: previous?.masterLayout ?? { frameId: null, placements: {} },
    nodes,
    deliverables,
    campaign: { startDate: legacy.startDate },
    componentInstances: previous?.componentInstances ?? [],
    files,
  });
}

function flattenPlateLeaves(
  children: StudioPlateChild[],
  url?: string
): (Extract<StudioPlateChild, { text: string }> & { url?: string })[] {
  return children.flatMap(child =>
    'text' in child
      ? [{ ...child, ...(url ? { url } : {}) }]
      : flattenPlateLeaves(child.children, child.url ?? url)
  );
}

function textFromContent(content: StudioPlateElement[]) {
  return content
    .map(block =>
      flattenPlateLeaves(block.children)
        .map(child => child.text)
        .join('')
    )
    .join('\n');
}

export function semanticElement(node: Exclude<StudioNode, FrameNode>): StudioElement | null {
  const common = {
    id: node.id,
    x: node.transform.x,
    y: node.transform.y,
    width: node.transform.width,
    height: node.transform.height,
    rotation: node.transform.rotation,
    flipX: node.transform.flipX,
    flipY: node.transform.flipY,
    opacity: node.style.opacity,
    order: node.zIndex,
    group: node.groupIds[0] ?? null,
    locked: node.locked,
    visible: node.visible,
    fill: node.style.fill ?? '#12362D',
    stroke: node.style.stroke ?? '#12362D',
    strokeWidth: node.style.strokeWidth,
    animation: node.animation,
  };
  if (node.type === 'richText') {
    const textRuns = node.content.flatMap(block => flattenPlateLeaves(block.children, block.url));
    const everyRunHas = (mark: 'bold' | 'italic' | 'underline' | 'strikethrough') =>
      textRuns.length > 0 && textRuns.every(run => run[mark] === true);
    const paragraphs = node.content.map(block =>
      paragraphSchema.parse({
        id: block.id,
        type: 'p',
        align: block.align,
        list: block.list,
        children: flattenPlateLeaves(block.children, block.url).map(
          ({
            id: _id,
            code: _code,
            highlight: _highlight,
            backgroundColor: _background,
            ...leaf
          }) => leaf
        ),
      })
    );
    return elementSchema.parse({
      ...common,
      type: 'text',
      text: textFromContent(node.content),
      richText: paragraphs,
      font: node.typography.fontFamily,
      fontSize: node.typography.fontSize,
      lineHeight: node.typography.lineHeight,
      align: node.typography.horizontalAlign,
      verticalAlign: node.typography.verticalAlign,
      bold: everyRunHas('bold'),
      italic: everyRunHas('italic'),
      underline: everyRunHas('underline'),
      strikethrough: everyRunHas('strikethrough'),
    });
  }
  if (node.type === 'media' && (node.mediaType === 'image' || node.mediaType === 'video'))
    return elementSchema.parse({
      ...common,
      type: node.mediaType,
      text: node.alt,
      assetId: node.assetId,
      fit: node.fit,
      cropX: node.focus.x,
      cropY: node.focus.y,
      crop: node.crop,
      trimStart: node.trim.start,
      muted: node.muted,
    });
  if (node.type === 'table')
    return elementSchema.parse({ ...common, type: 'table', table: node.data });
  if (node.type === 'chart')
    return elementSchema.parse({ ...common, type: 'chart', chart: node.data });
  if (node.type === 'shape')
    return elementSchema.parse({
      ...common,
      type:
        node.shape === 'ellipse'
          ? 'ellipse'
          : node.shape === 'line'
            ? 'line'
            : node.shape === 'arrow'
              ? 'arrow'
              : 'rect',
    });
  return null;
}

function nativeElement(node: StudioNode, _nodeById: Map<string, StudioNode>) {
  if (node.type !== 'frame') return null;
  return {
    id: node.id,
    type: 'frame',
    x: node.transform.x,
    y: node.transform.y,
    width: node.transform.width,
    height: node.transform.height,
    angle: (node.transform.rotation * Math.PI) / 180,
    flipX: node.transform.flipX,
    flipY: node.transform.flipY,
    isDeleted: !node.visible,
    name: node.name,
    locked: node.locked,
    frameId: null,
    groupIds: [...node.groupIds].reverse(),
    strokeColor: node.style.stroke ?? '#888888',
    backgroundColor: node.style.fill ?? 'transparent',
    fillStyle: 'solid',
    strokeWidth: node.style.strokeWidth,
    strokeStyle: node.style.strokeStyle,
    roughness: node.style.roughness,
    opacity: node.style.opacity * 100,
  };
}

export function v3DocumentToLegacy(
  input: StudioDocumentV3,
  options: { includeMaster?: boolean } = {}
): StudioDocument {
  const document = studioDocumentV3Schema.parse(input);
  const brand = themeToLegacyBrand(document.theme);
  const nodeById = new Map(document.nodes.map(node => [node.id, node]));
  const masterFrame = document.masterLayout.frameId
    ? nodeById.get(document.masterLayout.frameId)
    : undefined;
  const masterNodes: StudioNode[] = [];
  if (options.includeMaster && masterFrame?.type === 'frame') {
    const visitMaster = (parentId: string) => {
      for (const node of document.nodes) {
        if (node.parentFrameId !== parentId) continue;
        masterNodes.push(node);
        if (node.type === 'frame') visitMaster(node.id);
      }
    };
    visitMaster(masterFrame.id);
  }
  const rootFrames = document.nodes
    .filter(
      (node): node is FrameNode =>
        node.type === 'frame' &&
        node.parentFrameId === null &&
        node.id !== document.masterLayout.frameId
    )
    .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
  const pages = rootFrames.map((frame, index): StudioPage => {
    const descendants: StudioNode[] = [];
    const visit = (parentId: string) => {
      for (const node of document.nodes) {
        if (node.parentFrameId !== parentId) continue;
        descendants.push(node);
        if (node.type === 'frame') visit(node.id);
      }
    };
    visit(frame.id);
    const elements = descendants
      .filter((node): node is Exclude<StudioNode, FrameNode> => node.type !== 'frame')
      .map(semanticElement)
      .filter((element): element is StudioElement => !!element);
    const native = descendants
      .map(node => nativeElement(node, nodeById))
      .filter(Boolean) as CanvasScene['elements'];
    if (masterFrame?.type === 'frame' && masterNodes.length) {
      const scaleX = frame.transform.width / masterFrame.transform.width;
      const scaleY = frame.transform.height / masterFrame.transform.height;
      const scale = Math.min(scaleX, scaleY);
      const masterId = (id: string) => stableUuid(frame.id, `master:${id}`);
      for (const node of masterNodes) {
        if (!node.visible) continue;
        const foreground = document.masterLayout.placements[node.id] !== 'background';
        const order = (foreground ? 100_000 : -100_000) + node.zIndex;
        const semantic = node.type === 'frame' ? null : semanticElement(node);
        if (semantic) {
          elements.push(
            elementSchema.parse({
              ...semantic,
              id: masterId(semantic.id),
              x: semantic.x * scaleX,
              y: semantic.y * scaleY,
              width: semantic.width * scaleX,
              height: semantic.height * scaleY,
              fontSize: semantic.fontSize * scale,
              strokeWidth: semantic.strokeWidth * scale,
              richText: semantic.richText.map(block => ({
                ...block,
                children: block.children.map(run => ({
                  ...run,
                  fontSize: run.fontSize === undefined ? undefined : run.fontSize * scale,
                })),
              })),
              order,
              locked: true,
            })
          );
        }
        const original = nativeElement(node, nodeById);
        if (!original) continue;
        const element = original as CanvasScene['elements'][number];
        native.push({
          ...element,
          id: masterId(element.id),
          x: element.x * scaleX,
          y: element.y * scaleY,
          width: element.width * scaleX,
          height: element.height * scaleY,
          frameId: typeof element.frameId === 'string' ? masterId(element.frameId) : null,
          groupIds: Array.isArray(element.groupIds)
            ? element.groupIds.map(id => masterId(String(id)))
            : [],
          ...(Array.isArray(element.points)
            ? {
                points: element.points.map(point =>
                  Array.isArray(point)
                    ? [Number(point[0]) * scaleX, Number(point[1]) * scaleY]
                    : point
                ),
              }
            : {}),
          ...(typeof element.fontSize === 'number' ? { fontSize: element.fontSize * scale } : {}),
          ...(typeof element.strokeWidth === 'number'
            ? { strokeWidth: element.strokeWidth * scale }
            : {}),
          locked: true,
          customData: {
            ...(element.customData &&
            typeof element.customData === 'object' &&
            !Array.isArray(element.customData)
              ? element.customData
              : {}),
            polityOrder: order,
          },
        });
      }
    }
    const preset = frame.preset === 'custom' ? null : frame.preset;
    const exactPreset =
      preset &&
      framePresetRegistry[preset].width === frame.transform.width &&
      framePresetRegistry[preset].height === frame.transform.height
        ? preset
        : null;
    const format = exactPreset ? presetToFormat[exactPreset] : 'square';
    const canvas = native.length
      ? canvasSceneSchema.parse({ version: 1, elements: native, files: document.files })
      : undefined;
    return {
      id: frame.id,
      name: frame.name,
      format,
      background: frame.style.fill ?? document.frameDefaults.background ?? brand.background,
      order: index,
      duration: frame.duration,
      transition: frame.transition,
      elements,
      canvas,
    };
  });
  return documentSchema.parse({
    version: 2,
    title: document.title,
    kind: document.kind,
    brand,
    pages,
    posts: document.deliverables.map(deliverable => ({
      id: deliverable.id,
      code: deliverable.code,
      title: deliverable.title,
      kind: deliverable.kind,
      pageIds: deliverable.frameIds,
      day: deliverable.dayOffset,
      action: deliverable.brief,
      status: deliverable.status,
      assignee: deliverable.assignee,
      captions: deliverable.captions,
    })),
    startDate: document.campaign.startDate,
    source: null,
  });
}

export function isStudioDocumentV3(value: unknown): value is StudioDocumentV3 {
  return studioDocumentV3Schema.safeParse(value).success;
}

export function requireStudioDocumentV3(value: unknown): StudioDocumentV3 {
  return studioDocumentV3Schema.parse(value);
}

export function frameSize(frame: FrameNode): readonly [number, number] {
  if (frame.preset !== 'custom')
    return [framePresetRegistry[frame.preset].width, framePresetRegistry[frame.preset].height];
  return [frame.transform.width, frame.transform.height];
}

export function legacyFormatSize(format: StudioPage['format']): readonly [number, number] {
  return formats[format];
}
