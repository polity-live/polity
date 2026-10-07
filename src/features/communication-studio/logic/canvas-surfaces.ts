export function configureStudioCanvasSurfaces({
  lower,
  upper,
  controls,
  editable,
  contain,
  editingText,
}: {
  lower?: HTMLCanvasElement;
  upper?: HTMLCanvasElement;
  controls?: HTMLCanvasElement;
  editable: boolean;
  contain: boolean;
  editingText: boolean;
}) {
  for (const canvas of [lower, upper, controls]) {
    if (canvas) canvas.style.touchAction = editable && !contain ? 'none' : '';
  }
  if (lower) lower.style.zIndex = '0';
  if (upper) {
    upper.style.zIndex = '2';
    // The upper layer is mounted only while the HTML text editor is active.
    upper.style.pointerEvents = 'none';
  }
  if (controls) {
    controls.style.zIndex = '3';
    controls.style.pointerEvents = editingText ? 'none' : 'auto';
  }
}
