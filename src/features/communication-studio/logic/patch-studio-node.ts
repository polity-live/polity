import type { StudioElement } from './document';
import type { RichTextNode, StudioNode, StudioPlateChild, StudioPlateElement } from './document-v3';

function mapLeaves(
  children: StudioPlateChild[],
  update: (leaf: Extract<StudioPlateChild, { text: string }>) => StudioPlateChild
): StudioPlateChild[] {
  return children.map(child =>
    'text' in child ? update(child) : { ...child, children: mapLeaves(child.children, update) }
  );
}

export function patchStudioNode(node: StudioNode, patch: Partial<StudioElement>) {
  for (const key of ['x', 'y', 'width', 'height', 'rotation', 'flipX', 'flipY'] as const)
    if (patch[key] !== undefined) node.transform[key] = patch[key] as never;
  if (patch.order !== undefined) node.zIndex = patch.order;
  if (patch.visible !== undefined) node.visible = patch.visible;
  if (patch.locked !== undefined) node.locked = patch.locked;
  if (patch.animation !== undefined) node.animation = patch.animation;
  if (patch.opacity !== undefined) node.style.opacity = patch.opacity;
  if (patch.strokeWidth !== undefined) node.style.strokeWidth = patch.strokeWidth;
  if (patch.fill !== undefined) {
    node.style.fill = patch.fill;
    node.style.fillBinding = null;
  }
  if (patch.stroke !== undefined) {
    node.style.stroke = patch.stroke;
    node.style.strokeBinding = null;
  }
  if (node.type === 'richText') {
    if (patch.text !== undefined)
      node.content = patch.text.split('\n').map((text): StudioPlateElement => ({
        id: crypto.randomUUID(),
        type: 'p',
        children: [{ id: crypto.randomUUID(), text }],
      }));
    if (patch.richText !== undefined)
      node.content = patch.richText.map(block => ({
        id: block.id,
        type: block.type,
        ...(block.align ? { align: block.align } : {}),
        ...(block.list ? { list: block.list } : {}),
        children: block.children.map(leaf => ({ id: crypto.randomUUID(), ...leaf })),
      }));
    if (patch.font !== undefined) node.typography.fontFamily = patch.font;
    if (patch.fontSize !== undefined) node.typography.fontSize = patch.fontSize;
    if (patch.lineHeight !== undefined) node.typography.lineHeight = patch.lineHeight;
    if (patch.align !== undefined) node.typography.horizontalAlign = patch.align;
    if (patch.verticalAlign !== undefined) node.typography.verticalAlign = patch.verticalAlign;
    for (const key of ['bold', 'italic', 'underline', 'strikethrough'] as const)
      if (patch[key] !== undefined)
        node.content = node.content.map(block => ({
          ...block,
          children: mapLeaves(block.children, leaf => ({ ...leaf, [key]: patch[key] })),
        }));
  }
  if (node.type === 'media') {
    if (patch.fit !== undefined) node.fit = patch.fit;
    if (patch.cropX !== undefined) node.focus.x = patch.cropX;
    if (patch.cropY !== undefined) node.focus.y = patch.cropY;
    if (patch.crop !== undefined) node.crop = patch.crop;
    if (patch.trimStart !== undefined) node.trim.start = patch.trimStart;
    if (patch.muted !== undefined) node.muted = patch.muted;
  }
  if (node.type === 'table' && patch.table !== undefined) node.data = patch.table;
  if (node.type === 'chart' && patch.chart !== undefined) node.data = patch.chart;
}

export function formatStudioRichText(
  node: RichTextNode,
  key:
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikethrough'
    | 'fill'
    | 'font'
    | 'fontSize'
    | 'align'
    | 'list'
    | 'url',
  value: unknown
) {
  if (key === 'font' && typeof value === 'string') {
    node.typography.fontFamily = value as RichTextNode['typography']['fontFamily'];
    return;
  }
  if (key === 'fontSize' && typeof value === 'number') {
    node.typography.fontSize = value;
    return;
  }
  if (key === 'align' && typeof value === 'string') {
    node.typography.horizontalAlign = value as RichTextNode['typography']['horizontalAlign'];
    return;
  }
  if (key === 'list' || key === 'url') {
    node.content = node.content.map(block => ({
      ...block,
      ...(key === 'list'
        ? { list: value === 'bullet' || value === 'number' ? value : undefined }
        : { url: typeof value === 'string' && /^https?:\/\//.test(value) ? value : undefined }),
    }));
    return;
  }
  const mark = key === 'fill' ? 'color' : key;
  node.content = node.content.map(block => ({
    ...block,
    children: mapLeaves(block.children, leaf => ({
      ...leaf,
      [mark]: value,
      textStyleId: undefined,
    })),
  }));
}
