import type { EditorMode } from '@/features/editor/types';
import { useModeSyncController } from './useModeSyncController';

interface ModeSyncProps {
  currentMode?: EditorMode;
  readOnly?: boolean;
}

/**
 * Component that syncs the external mode with PlateJS internal state.
 * Must be rendered inside <Plate> component.
 */
export function ModeSync({ currentMode, readOnly = false }: ModeSyncProps) {
  useModeSyncController({ currentMode, readOnly });
  return null;
}
