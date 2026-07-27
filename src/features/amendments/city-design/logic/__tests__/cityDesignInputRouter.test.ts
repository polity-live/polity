import { describe, expect, it } from 'vitest';
import {
  getCityDesignKeyboardAction,
  getCityDesignPointerAction,
  getCityDesignWheelAction,
} from '../cityDesignInputRouter';

describe('cityDesignInputRouter', () => {
  it('uses mode primary actions for unmodified left pointer input', () => {
    expect(getCityDesignPointerAction({ mode: 'camera', button: 0 })).toBe('move');
    expect(getCityDesignPointerAction({ mode: 'select', button: 0 })).toBe('select');
    expect(getCityDesignPointerAction({ mode: 'place', button: 0 })).toBe('place');
  });

  it('routes navigation gestures before select and place actions', () => {
    expect(getCityDesignPointerAction({ mode: 'place', button: 0, isSpacePressed: true })).toBe(
      'move'
    );
    expect(getCityDesignPointerAction({ mode: 'select', button: 0, shiftKey: true })).toBe('turn');
    expect(getCityDesignPointerAction({ mode: 'select', button: 1 })).toBe('move');
    expect(getCityDesignPointerAction({ mode: 'place', button: 2 })).toBe('turn');
    expect(getCityDesignPointerAction({ mode: 'select', button: 0, touchPointCount: 2 })).toBe(
      'move'
    );
  });

  it('detects object rotation handles only in select mode', () => {
    expect(
      getCityDesignPointerAction({
        mode: 'select',
        button: 0,
        isObjectRotateHandle: true,
      })
    ).toBe('objectRotate');
    expect(
      getCityDesignPointerAction({
        mode: 'select',
        button: 0,
        isObjectRotateHandle: true,
        readOnly: true,
      })
    ).toBe('select');
  });

  it('disables place primaries in read-only mode', () => {
    expect(getCityDesignPointerAction({ mode: 'place', button: 0, readOnly: true })).toBe('none');
  });

  it('routes wheel and keyboard navigation actions', () => {
    expect(getCityDesignWheelAction()).toBe('zoom');
    expect(getCityDesignKeyboardAction('ArrowLeft')).toBe('move');
    expect(getCityDesignKeyboardAction('w')).toBe('move');
    expect(getCityDesignKeyboardAction('-')).toBe('zoom');
    expect(getCityDesignKeyboardAction('+')).toBe('zoom');
    expect(getCityDesignKeyboardAction('q')).toBe('turn');
    expect(getCityDesignKeyboardAction('Enter')).toBe('none');
  });
});
