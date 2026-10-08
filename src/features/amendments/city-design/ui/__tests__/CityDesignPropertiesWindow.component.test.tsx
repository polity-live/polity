/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CityDesignPropertiesWindow } from '../CityDesignPropertiesWindow';

afterEach(cleanup);

describe('CityDesignPropertiesWindow', () => {
  it('expands a new selection and retains the keyboard position across selections', () => {
    const props = {
      selectionKey: 'object:a',
      canvasSize: { width: 900, height: 600 },
      onClose: vi.fn(),
    };
    const { rerender } = render(
      <CityDesignPropertiesWindow {...props}>
        <input aria-label="Width" />
      </CityDesignPropertiesWindow>
    );
    const window = screen.getByRole('complementary');
    expect(window.style.left).toBe('16px');
    expect(window.style.top).toBe('16px');
    const move = screen.getByRole('button', { name: 'Move properties' });
    fireEvent.keyDown(move, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(move, { key: 'ArrowDown' });
    expect(window.style.left).toBe('36px');
    expect(window.style.top).toBe('26px');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse properties' }));
    expect(screen.queryByRole('textbox', { name: 'Width' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Expand properties' }).getAttribute('aria-expanded')
    ).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Expand properties' }));
    expect(screen.getByRole('textbox', { name: 'Width' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse properties' }));
    rerender(
      <CityDesignPropertiesWindow {...props} selectionKey="osm:b">
        <input aria-label="Width" />
      </CityDesignPropertiesWindow>
    );
    expect(window.style.left).toBe('36px');
    expect(screen.getByRole('textbox', { name: 'Width' })).toBeTruthy();
    rerender(
      <CityDesignPropertiesWindow {...props}>
        <input aria-label="Width" />
      </CityDesignPropertiesWindow>
    );
    expect(screen.getByRole('textbox', { name: 'Width' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close properties' }));
    expect(props.onClose).toHaveBeenCalledOnce();
    rerender(
      <CityDesignPropertiesWindow {...props} selectionKey={null}>
        Details
      </CityDesignPropertiesWindow>
    );
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('bounds the window after resize and isolates property input from canvas gestures', () => {
    const gesture = vi.fn();
    const key = vi.fn();
    const props = {
      selectionKey: 'object:a',
      canvasSize: { width: 900, height: 600 },
      onClose: vi.fn(),
    };
    const content = <input aria-label="Width" />;
    const { rerender } = render(
      <div onPointerDown={gesture} onKeyDown={key}>
        <CityDesignPropertiesWindow {...props}>{content}</CityDesignPropertiesWindow>
      </div>
    );
    const move = screen.getByRole('button', { name: 'Move properties' });
    for (let i = 0; i < 50; i++) fireEvent.keyDown(move, { key: 'ArrowRight', shiftKey: true });
    expect(screen.getByRole('complementary').style.left).toBe('548px');
    fireEvent.pointerDown(screen.getByRole('textbox', { name: 'Width' }));
    fireEvent.wheel(screen.getByRole('textbox', { name: 'Width' }), { deltaY: 20 });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Width' }), { key: 'ArrowRight' });
    expect(gesture).not.toHaveBeenCalled();
    expect(key).not.toHaveBeenCalled();
    rerender(
      <div>
        <CityDesignPropertiesWindow {...props} canvasSize={{ width: 390, height: 300 }}>
          {content}
        </CityDesignPropertiesWindow>
      </div>
    );
    expect(screen.getByRole('complementary').style.left).toBe('38px');
    const handle = screen.getByRole('button', { name: 'Move properties' });
    for (let i = 0; i < 15; i++) fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true });
    expect(screen.getByRole('complementary').style.transform).toBe(
      'translateY(calc(-100% + 2.75rem))'
    );
  });

  it('ignores secondary and unrelated pointers and stops dragging after cancellation', () => {
    render(
      <CityDesignPropertiesWindow selectionKey="object:a" canvasSize={null} onClose={vi.fn()}>
        Details
      </CityDesignPropertiesWindow>
    );
    const move = screen.getByRole('button', { name: 'Move properties' });
    const panel = screen.getByRole('complementary');
    const pointer = (
      target: HTMLElement | Window,
      type: string,
      pointerId: number,
      button = 0,
      x = 20
    ) => {
      const event = new MouseEvent(type, { bubbles: true, button, clientX: x, clientY: 20 });
      Object.defineProperty(event, 'pointerId', { value: pointerId });
      fireEvent(target, event);
    };
    pointer(move, 'pointerdown', 1, 2);
    pointer(window, 'pointermove', 1, 0, 100);
    expect(panel.style.left).toBe('16px');
    pointer(move, 'pointerdown', 1);
    pointer(window, 'pointermove', 2, 0, 100);
    expect(panel.style.left).toBe('16px');
    pointer(window, 'pointermove', 1, 0, 100);
    expect(panel.style.left).toBe('96px');
    pointer(window, 'pointercancel', 1);
    pointer(window, 'pointermove', 1, 0, 200);
    expect(panel.style.left).toBe('96px');
    fireEvent.keyDown(move, { key: 'Enter' });
    expect(panel.style.left).toBe('96px');
  });
});
