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
  });
});
