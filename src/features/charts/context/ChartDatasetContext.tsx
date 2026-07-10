import * as React from 'react';

export interface ChartDatasetContextValue {
  defaultGroupId?: string | null;
  defaultGroupName?: string | null;
  canViewDatasets?: boolean;
  canManageDatasets?: boolean;
  canUploadDatasets?: boolean;
}

const ChartDatasetContext = React.createContext<ChartDatasetContextValue>({
  defaultGroupId: null,
  defaultGroupName: null,
  canViewDatasets: false,
  canManageDatasets: false,
  canUploadDatasets: false,
});

export function ChartDatasetContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value?: ChartDatasetContextValue | null;
}) {
  return (
    <ChartDatasetContext.Provider
      value={{
        defaultGroupId: value?.defaultGroupId ?? null,
        defaultGroupName: value?.defaultGroupName ?? null,
        canViewDatasets: value?.canViewDatasets ?? false,
        canManageDatasets: value?.canManageDatasets ?? false,
        canUploadDatasets: value?.canUploadDatasets ?? false,
      }}
    >
      {children}
    </ChartDatasetContext.Provider>
  );
}

export function useChartDatasetContext() {
  return React.useContext(ChartDatasetContext);
}
