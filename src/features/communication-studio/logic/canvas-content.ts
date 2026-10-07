import type Konva from 'konva';

/** Bind native interactions only after the canvas SDK has mounted its content. */
export function observeStudioCanvasContent(
  stage: Konva.Stage | null,
  observe: (content: HTMLDivElement) => (() => void) | undefined
) {
  const content = stage?.content;
  if (!content) return;
  return observe(content);
}
