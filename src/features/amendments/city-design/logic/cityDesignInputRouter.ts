import type { CityDesignInteractionMode } from '../types';

export type CityDesignInputAction =
  'move' | 'zoom' | 'turn' | 'select' | 'place' | 'objectRotate' | 'none';

export interface CityDesignPointerActionInput {
  mode: CityDesignInteractionMode;
  button: number;
  pointerType?: string;
  isSpacePressed?: boolean;
  shiftKey?: boolean;
  touchPointCount?: number;
  isObjectRotateHandle?: boolean;
  readOnly?: boolean;
}

export function getCityDesignPointerAction(
  input: CityDesignPointerActionInput
): CityDesignInputAction {
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

export function getCityDesignWheelAction(): CityDesignInputAction {
  return 'zoom';
}

export function getCityDesignKeyboardAction(key: string): CityDesignInputAction {
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
