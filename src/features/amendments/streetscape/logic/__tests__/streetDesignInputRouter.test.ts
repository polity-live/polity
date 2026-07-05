import { describe, expect, it } from 'vitest';
import {
  getStreetDesignKeyboardAction,
  getStreetDesignPointerAction,
  getStreetDesignWheelAction,
} from '../streetDesignInputRouter';

describe('streetDesignInputRouter', () => {
  it('uses mode primary actions for unmodified left pointer input', () => {
    expect(getStreetDesignPointerAction({ mode: 'camera', button: 0 })).toBe('move');
    expect(getStreetDesignPointerAction({ mode: 'select', button: 0 })).toBe('select');
    expect(getStreetDesignPointerAction({ mode: 'place', button: 0 })).toBe('place');
  });

  it('routes navigation gestures before select and place actions', () => {
    expect(getStreetDesignPointerAction({ mode: 'place', button: 0, isSpacePressed: true })).toBe(
      'move'
    );
    expect(getStreetDesignPointerAction({ mode: 'select', button: 0, shiftKey: true })).toBe(
      'turn'
    );
    expect(getStreetDesignPointerAction({ mode: 'select', button: 1 })).toBe('move');
    expect(getStreetDesignPointerAction({ mode: 'place', button: 2 })).toBe('turn');
    expect(getStreetDesignPointerAction({ mode: 'select', button: 0, touchPointCount: 2 })).toBe(
      'move'
    );
  });

  it('detects object rotation handles only in select mode', () => {
    expect(
      getStreetDesignPointerAction({
        mode: 'select',
        button: 0,
        isObjectRotateHandle: true,
      })
    ).toBe('objectRotate');
    expect(
      getStreetDesignPointerAction({
        mode: 'select',
        button: 0,
        isObjectRotateHandle: true,
        readOnly: true,
      })
    ).toBe('select');
  });

  it('disables place primaries in read-only mode', () => {
    expect(getStreetDesignPointerAction({ mode: 'place', button: 0, readOnly: true })).toBe('none');
  });

  it('routes wheel and keyboard navigation actions', () => {
    expect(getStreetDesignWheelAction()).toBe('zoom');
    expect(getStreetDesignKeyboardAction('ArrowLeft')).toBe('move');
    expect(getStreetDesignKeyboardAction('w')).toBe('move');
    expect(getStreetDesignKeyboardAction('-')).toBe('zoom');
    expect(getStreetDesignKeyboardAction('+')).toBe('zoom');
    expect(getStreetDesignKeyboardAction('q')).toBe('turn');
    expect(getStreetDesignKeyboardAction('Enter')).toBe('none');
  });
});
