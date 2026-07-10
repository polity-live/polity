/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TDataViewElement } from '@/features/charts/types';
import { openDataViewDialog } from '@/features/charts/ui/ChartDialog';
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
  openDataViewDialog: vi.fn(),
}));

vi.mock('@/features/charts/ui/DataViewRenderer', () => ({
  DataViewRenderer: () => <div data-testid="data-view-renderer" />,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: { access_token: 'token' } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const element: TDataViewElement = {
  type: 'data_view',
  view: 'chart',
  chartType: 'bar',
  query: {
    dimensionColumn: 'x',
    measureColumn: 'value',
    seriesColumn: null,
    filters: {},
    aggregation: 'sum',
  },
  presentation: {},
  source: {
    kind: 'dataset',
    provider: 'UPLOAD',
    datasetId: 'dataset-id',
    snapshotId: 'snapshot-id',
    title: 'Example',
  },
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
    expect(surface.contains(screen.getByTestId('data-view-renderer'))).toBe(true);

    fireEvent.click(screen.getByTitle('Edit data view'));
    expect(openDataViewDialog).toHaveBeenCalledWith(element);

    fireEvent.click(screen.getByTitle('Delete data view'));
    expect(findPath).toHaveBeenCalledWith(element);
    expect(removeNodes).toHaveBeenCalledWith({ at: [0] });
  });
});
