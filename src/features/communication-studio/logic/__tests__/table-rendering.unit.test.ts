import { describe, expect, it, vi } from 'vitest';
import { element } from '../document';
import { drawStudioElement } from '../draw-element';
import { createTableData, setTableBorders } from '../table-operations';

describe('Studio table canvas borders', () => {
  it('draws visible edges and omits disabled edges in the shared raster renderer', () => {
    const table = element('table');
    table.table = createTableData({ rowCount: 1, colCount: 1 });
    const moveTo = vi.fn();
    const lineTo = vi.fn();
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      fillRect: vi.fn(),
      stroke: vi.fn(),
      moveTo,
      lineTo,
      measureText: vi.fn(() => ({ width: 0 })),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    drawStudioElement(context, table);
    expect(moveTo).toHaveBeenCalledTimes(4);
    expect(lineTo).toHaveBeenCalledTimes(4);

    moveTo.mockClear();
    lineTo.mockClear();
    table.table = setTableBorders(
      table.table!,
      {
        anchorRow: 0,
        focusRow: 0,
        anchorColumn: 0,
        focusColumn: 0,
      },
      'none'
    );
    drawStudioElement(context, table);
    expect(moveTo).not.toHaveBeenCalled();
    expect(lineTo).not.toHaveBeenCalled();
  });
});
