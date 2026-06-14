import { useCursorOverlay } from '@platejs/selection/react';
import { CursorOverlayView } from './CursorOverlayView';
export function CursorOverlay() {
  const { cursors } = useCursorOverlay();
  return <CursorOverlayView cursors={cursors} />;
}
