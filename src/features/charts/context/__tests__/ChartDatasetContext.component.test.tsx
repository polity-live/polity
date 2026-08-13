/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChartDatasetContextProvider, useChartDatasetContext } from '../ChartDatasetContext';

describe('ChartDatasetContextProvider', () => {
  it('provides explicit dataset scope and permissions', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChartDatasetContextProvider
        value={{
          defaultGroupId: 'group-1',
          defaultGroupName: 'Group One',
          canViewDatasets: true,
          canManageDatasets: true,
          canUploadDatasets: true,
        }}
      >
        {children}
      </ChartDatasetContextProvider>
    );

    const { result } = renderHook(() => useChartDatasetContext(), { wrapper });
    expect(result.current).toEqual({
      defaultGroupId: 'group-1',
      defaultGroupName: 'Group One',
      canViewDatasets: true,
      canManageDatasets: true,
      canUploadDatasets: true,
    });
  });

  it('normalizes absent and null values to safe defaults', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChartDatasetContextProvider value={null}>{children}</ChartDatasetContextProvider>
    );
    const { result } = renderHook(() => useChartDatasetContext(), { wrapper });
    expect(result.current).toEqual({
      defaultGroupId: null,
      defaultGroupName: null,
      canViewDatasets: false,
      canManageDatasets: false,
      canUploadDatasets: false,
    });
  });
});
