import type { StreetDesignInteractionMode } from '../types';

export type StreetDesignInputAction =
  | 'move'
  | 'zoom'
  | 'turn'
  | 'select'
  | 'place'
  | 'objectRotate'
  | 'none';

export interface StreetDesignPointerActionInput {
  mode: StreetDesignInteractionMode;
  button: number;
  pointerType?: string;
  isSpacePressed?: boolean;
  shiftKey?: boolean;
  touchPointCount?: number;
  isObjectRotateHandle?: boolean;
  readOnly?: boolean;
}

export function getStreetDesignPointerAction(
  input: StreetDesignPointerActionInput
): StreetDesignInputAction {
  if ((input.touchPointCount ?? 0) >= 2) return 'move';
  if (input.button === 1) return 'move';
  if (input.button === 2) return 'turn';
  if (input.isSpacePressed) return 'move';
  if (input.shiftKey && input.button === 0) return 'turn';

  if (input.mode === 'camera') {
    return input.button === 0 ? 'move' : 'none';
  }

  if (input.button !== 0) return 'none';

  if (input.mode === 'select') {
    return input.isObjectRotateHandle && !input.readOnly ? 'objectRotate' : 'select';
  }

  if (input.mode === 'place') {
    return input.readOnly ? 'none' : 'place';
  }

  return 'none';
}

export function getStreetDesignWheelAction(): StreetDesignInputAction {
  return 'zoom';
}

export function getStreetDesignKeyboardAction(key: string): StreetDesignInputAction {
  const normalizedKey = key.toLowerCase();
  if (
    normalizedKey === 'arrowleft' ||
    normalizedKey === 'arrowright' ||
    normalizedKey === 'arrowup' ||
    normalizedKey === 'arrowdown' ||
    normalizedKey === 'w' ||
    normalizedKey === 'a' ||
    normalizedKey === 's' ||
    normalizedKey === 'd'
  ) {
    return 'move';
  }

  if (normalizedKey === '+' || normalizedKey === '-' || normalizedKey === '=') {
    return 'zoom';
  }

  if (normalizedKey === 'q' || normalizedKey === 'e') {
    return 'turn';
  }

  return 'none';
}
