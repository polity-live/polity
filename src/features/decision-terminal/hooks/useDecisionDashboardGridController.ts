'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Layout, ResponsiveLayouts } from 'react-grid-layout/legacy';

import type {
  DecisionTerminalDashboardConfig,
  DecisionTerminalGridLayoutItem,
} from '@/zero/preferences';

import type { DecisionTerminalGridBreakpoint } from '../logic/dashboard-config';

function toDashboardLayout(layout: Layout): DecisionTerminalGridLayoutItem[] {
  return layout.map(item => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
    static: item.static,
  }));
}

function toGridLayouts(
  layouts: Record<string, DecisionTerminalGridLayoutItem[]>
): ResponsiveLayouts<DecisionTerminalGridBreakpoint> {
  return Object.fromEntries(
    Object.entries(layouts).map(([breakpoint, layout]) => [
      breakpoint,
      layout.map(item => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
        static: item.static,
      })),
    ])
  ) as ResponsiveLayouts<DecisionTerminalGridBreakpoint>;
}

interface UseDecisionDashboardGridControllerOptions {
  config: DecisionTerminalDashboardConfig;
  onConfigChange: (config: DecisionTerminalDashboardConfig) => void;
}

export function useDecisionDashboardGridController({
  config,
  onConfigChange,
}: UseDecisionDashboardGridControllerOptions) {
  const [activeBreakpoint, setActiveBreakpoint] = useState<DecisionTerminalGridBreakpoint>('lg');
  const layouts = useMemo(() => toGridLayouts(config.layouts), [config.layouts]);

  const persistActiveLayout = useCallback(
    (layout: Layout) => {
      onConfigChange({
        ...config,
        layouts: {
          ...config.layouts,
          [activeBreakpoint]: toDashboardLayout(layout),
        },
      });
    },
    [activeBreakpoint, config, onConfigChange]
  );

  const handleBreakpointChange = useCallback((breakpoint: string) => {
    setActiveBreakpoint(breakpoint as DecisionTerminalGridBreakpoint);
  }, []);

  return {
    layouts,
    handleBreakpointChange,
    persistActiveLayout,
  };
}
