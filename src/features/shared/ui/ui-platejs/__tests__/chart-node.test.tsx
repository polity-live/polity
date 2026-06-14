/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TChartElement } from '@/features/charts/types';
import { openChartDialog } from '@/features/charts/ui/ChartDialog';
import { ChartElement } from '../chart-node';

const findPath = vi.fn(() => [0]);
const removeNodes = vi.fn();

vi.mock('platejs/react', () => ({
  PlateElement: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  useEditorRef: () => ({
    api: { findPath },
    tf: { removeNodes },
  }),
  useFocused: () => true,
  useReadOnly: () => false,
  useSelected: () => true,
}));

vi.mock('@/features/charts/ui/ChartDialog', () => ({
  openChartDialog: vi.fn(),
}));

vi.mock('@/features/charts/ui/ChartRenderer', () => ({
  ChartRenderer: () => <div data-testid="chart-renderer" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const element: TChartElement = {
  type: 'chart',
  chartType: 'bar',
  mapping: { xColumn: 'x', valueColumn: 'value', seriesColumn: null },
  presentation: {},
  source: { kind: 'manual', columns: ['x', 'value'], rows: [{ x: 'A', value: '1' }] },
  points: [{ x: 'A', value: 1, series: null }],
  children: [{ text: '' }],
};

describe('ChartElement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps edit controls separate from the chart interaction surface', () => {
    const props = {
      attributes: {},
      children: null,
      element,
      nodeProps: {},
    } as unknown as ComponentProps<typeof ChartElement>;

    render(<ChartElement {...props} />);

    const toolbar = screen.getByTestId('plate-chart-toolbar');
    const surface = screen.getByTestId('plate-chart-interaction-surface');

    expect(toolbar.getAttribute('contenteditable')).toBe('false');
    expect(surface.getAttribute('contenteditable')).toBe('false');
    expect(toolbar.className).not.toContain('absolute');
    expect(surface.contains(screen.getByTestId('chart-renderer'))).toBe(true);

    fireEvent.click(screen.getByTitle('Edit chart'));
    expect(openChartDialog).toHaveBeenCalledWith(element);

    fireEvent.click(screen.getByTitle('Delete chart'));
    expect(findPath).toHaveBeenCalledWith(element);
    expect(removeNodes).toHaveBeenCalledWith({ at: [0] });
  });
});
