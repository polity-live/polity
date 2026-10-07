import {
  elementSchema,
  type StudioElement,
} from '../../src/features/communication-studio/logic/document';
import type {
  FrameNode,
  StudioDocumentV3,
  StudioNode,
} from '../../src/features/communication-studio/logic/document-v3';
import {
  worldMatrix,
  invertTransformMatrix as invert,
} from '../../src/features/communication-studio/logic/selection-geometry';
import { studioSceneChildren } from '../../src/features/communication-studio/logic/studio-scene';
import { semanticElement } from '../../src/features/communication-studio/logic/v3-adapter';

type Matrix = [number, number, number, number, number, number];
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function projectedGeometry(node: StudioNode, matrix: Matrix) {
  const width = node.transform.width * Math.hypot(matrix[0], matrix[1]);
  const height = node.transform.height * Math.hypot(matrix[2], matrix[3]);
  const rotation = (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI;
  const radians = (rotation * Math.PI) / 180;
  const x =
    matrix[4] - width / 2 + (Math.cos(radians) * width) / 2 - (Math.sin(radians) * height) / 2;
  const y =
    matrix[5] - height / 2 - (Math.sin(radians) * width) / 2 + (Math.cos(radians) * height) / 2;
  return { x, y, width, height, rotation };
}

export type EditableV5Layer =
  | { kind: 'polity'; element: StudioElement; node: StudioNode }
  | { kind: 'drawing'; node: Extract<StudioNode, { type: 'drawing' }>; matrix: Matrix };

/** Flatten the V5 paint sequence for editable PowerPoint/Canva objects. */
export function editableV5Layers(document: StudioDocumentV3, frameId: string): EditableV5Layer[] {
  const root = document.nodes.find(node => node.id === frameId && node.type === 'frame') as
    FrameNode | undefined;
  if (!root) throw new Error('Studio frame not found');
  const inverseRoot = invert(worldMatrix(document, root));
  const frameBackground =
    document.frameDefaults.background ?? document.theme[document.theme.mode].background;
  const layers: EditableV5Layer[] = [];
  const visit = (node: StudioNode, prefix: Matrix, opacity: number) => {
    const matrix = multiply(prefix, worldMatrix(document, node));
    const alpha = opacity * node.style.opacity;
    if (node.type === 'drawing') layers.push({ kind: 'drawing', node, matrix });
    else {
      const geometry = projectedGeometry(node, matrix);
      const semantic =
        node.type === 'frame'
          ? elementSchema.parse({
              id: node.id,
              type: 'rect',
              text: '',
              fill: node.style.fill ?? frameBackground,
              stroke: node.style.stroke ?? '#888888',
              strokeWidth: node.style.strokeWidth,
              ...geometry,
              opacity: alpha,
            })
          : semanticElement(node);
      if (semantic) {
        const widthScale = geometry.width / node.transform.width;
        layers.push({
          kind: 'polity',
          node,
          element: elementSchema.parse({
            ...semantic,
            ...geometry,
            opacity: alpha,
            fontSize: semantic.fontSize * widthScale,
            strokeWidth: semantic.strokeWidth * widthScale,
            richText: semantic.richText.map(block => ({
              ...block,
              children: block.children.map(run => ({
                ...run,
                fontSize: run.fontSize === undefined ? undefined : run.fontSize * widthScale,
              })),
            })),
          }),
        });
      }
    }
    if (node.type === 'frame')
      for (const child of studioSceneChildren(document, node.id)) visit(child, prefix, alpha);
  };
  const master = document.masterLayout.frameId
    ? (document.nodes.find(
        node => node.id === document.masterLayout.frameId && node.type === 'frame'
      ) as FrameNode | undefined)
    : undefined;
  const masterPrefix: Matrix | null = master
    ? [
        root.transform.width / master.transform.width,
        0,
        0,
        root.transform.height / master.transform.height,
        0,
        0,
      ]
    : null;
  const paintMaster = (placement: 'background' | 'foreground') => {
    if (!master || !masterPrefix) return;
    const children = studioSceneChildren(document, master.id).filter(
      child => (document.masterLayout.placements[child.id] ?? 'foreground') === placement
    );
    for (const child of children)
      visit(child, multiply(masterPrefix, invert(worldMatrix(document, master))), 1);
  };
  paintMaster('background');
  for (const child of studioSceneChildren(document, root.id)) visit(child, inverseRoot, 1);
  paintMaster('foreground');
  return layers;
}
