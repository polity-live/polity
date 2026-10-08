import { useEffect, useRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import { expect, it, vi } from 'vitest';
import '@/styles.css';
import { CityDesignPropertiesWindow } from '../CityDesignPropertiesWindow';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));

it.each([900, 390])(
  'moves, collapses and bounds the inspector with native input at %ipx',
  async width => {
    await page.viewport(width + 40, 700);
    const gesture = vi.fn();
    function Harness() {
      const host = useRef<HTMLDivElement>(null);
      const [size, setSize] = useState<{ width: number; height: number } | null>(null);
      const [hostWidth, setHostWidth] = useState(width);
      const [selection, setSelection] = useState<string | null>('object:tree');
      useEffect(() => {
        const observer = new ResizeObserver(([entry]) =>
          setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
        );
        observer.observe(host.current!);
        return () => observer.disconnect();
      }, []);
      return (
        <>
          <button onClick={() => setSelection('osm:road')}>Select road</button>
          <button onClick={() => setHostWidth(320)}>Narrow canvas</button>
          <div
            ref={host}
            onPointerDown={gesture}
            style={{ width: hostWidth, height: 520, position: 'relative' }}
          >
            <div
              data-testid="drag-target"
              style={{
                position: 'absolute',
                left: Math.min(width - 32, 450),
                top: 180,
                width: 20,
                height: 20,
              }}
            >
              Target
            </div>
            <CityDesignPropertiesWindow
              selectionKey={selection}
              canvasSize={size}
              onClose={() => setSelection(null)}
            >
              <label>
                Width
                <input aria-label="Width" defaultValue="3" />
              </label>
              <div style={{ height: 700 }}>Long properties</div>
            </CityDesignPropertiesWindow>
          </div>
        </>
      );
    }
    render(<Harness />);
    const panel = screen.getByRole('complementary');
    const handle = screen.getByRole('button', { name: 'move' });
    expect(panel.style.left).toBe('16px');
    await userEvent.dragAndDrop(handle, screen.getByTestId('drag-target'));
    await waitFor(() => expect(panel.style.top).not.toBe('16px'));
    const draggedX = parseFloat(panel.style.left);
    const draggedY = parseFloat(panel.style.top);
    expect(gesture).not.toHaveBeenCalled();
    handle.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(parseFloat(panel.style.left)).toBe(Math.max(0, draggedX - 10));
    await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(parseFloat(panel.style.top)).toBe(Math.max(0, draggedY - 20));
    await userEvent.fill(screen.getByRole('textbox', { name: 'Width' }), '5');
    expect(gesture).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'collapse' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('textbox')).toBeNull();
    const position = panel.style.left;
    await userEvent.click(screen.getByRole('button', { name: 'Select road' }));
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(panel.style.left).toBe(position);
    await userEvent.click(screen.getByRole('button', { name: 'Narrow canvas' }));
    await waitFor(() => {
      const rect = panel.getBoundingClientRect();
      const parent = panel.parentElement!.getBoundingClientRect();
      expect(rect.left).toBeGreaterThanOrEqual(parent.left);
      expect(rect.right).toBeLessThanOrEqual(parent.right);
      expect(rect.bottom).toBeLessThanOrEqual(parent.bottom);
    });
    screen.getByRole('button', { name: 'close' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('complementary')).toBeNull();
  }
);
