'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Ref } from 'react';
import {
  Responsive,
  WidthProvider,
  type Layout,
  type ResizeHandleAxis,
  type ResponsiveLayouts,
} from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type {
  DecisionTerminalDashboardConfig,
  DecisionTerminalGridLayoutItem,
} from '@/zero/preferences';
import {
  DECISION_TERMINAL_GRID_BREAKPOINTS,
  DECISION_TERMINAL_GRID_COLUMNS,
  type DecisionTerminalGridBreakpoint,
  selectWidgetDecisions,
} from '../logic/dashboard-config';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { DecisionWidgetContent } from './DecisionWidgetContent';
import { DecisionWidgetFrame } from './DecisionWidgetFrame';
import type { DecisionItem } from './types';

const ResponsiveDecisionGrid = WidthProvider(Responsive);

interface DecisionDashboardGridProps {
  config: DecisionTerminalDashboardConfig;
  decisions: DecisionItem[];
  isLoading?: boolean;
  searchQuery?: string;
  onConfigChange: (config: DecisionTerminalDashboardConfig) => void;
  onVoteDecision: (decision: DecisionItem) => void;
}

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

function DecisionResizeHandle(axis: ResizeHandleAxis, ref: Ref<HTMLElement>) {
  return (
    <span
      ref={ref}
      aria-hidden="true"
      title={translateText('generated.inline.resize_widget_2d9d64d6')}
      className={cn(
        `react-resizable-handle react-resizable-handle-${axis}`,
        'decision-terminal-resize-handle'
      )}
      data-resize-axis={axis}
      data-testid="decision-widget-resize-handle"
    />
  );
}

export function DecisionDashboardGrid({
  config,
  decisions,
  isLoading = false,
  searchQuery = '',
  onConfigChange,
  onVoteDecision,
}: DecisionDashboardGridProps) {
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

  const renderWidget = (widget: DecisionTerminalDashboardConfig['widgets'][number]) => {
    const widgetDecisions = selectWidgetDecisions(decisions, widget, searchQuery);

    return (
      <div key={widget.id}>
        <DecisionWidgetFrame title={widget.title} count={widgetDecisions.length}>
          <DecisionWidgetContent
            widget={widget}
            decisions={widgetDecisions}
            isLoading={isLoading}
            onVoteDecision={onVoteDecision}
          />
        </DecisionWidgetFrame>
      </div>
    );
  };

  return (
    <div className="decision-terminal-grid-shell min-h-full">
      <ResponsiveDecisionGrid
        className="decision-terminal-grid"
        data-testid="decision-grid"
        layouts={layouts}
        breakpoints={DECISION_TERMINAL_GRID_BREAKPOINTS}
        cols={DECISION_TERMINAL_GRID_COLUMNS}
        rowHeight={DECISION_TERMINAL_ROW_HEIGHT}
        margin={DECISION_TERMINAL_GRID_MARGIN}
        containerPadding={DECISION_TERMINAL_GRID_PADDING}
        compactType="vertical"
        isBounded={false}
        isDraggable
        draggableHandle=".decision-widget-drag-handle"
        draggableCancel={DECISION_TERMINAL_DRAG_CANCEL}
        isResizable
        resizeHandles={['se']}
        resizeHandle={DecisionResizeHandle}
        useCSSTransforms
        onBreakpointChange={breakpoint =>
          setActiveBreakpoint(breakpoint as DecisionTerminalGridBreakpoint)
        }
        onDragStop={persistActiveLayout}
        onResizeStop={persistActiveLayout}
      >
        {config.widgets.map(renderWidget)}
      </ResponsiveDecisionGrid>
    </div>
  );
}

const DECISION_TERMINAL_ROW_HEIGHT = 36;

const DECISION_TERMINAL_GRID_MARGIN: Record<DecisionTerminalGridBreakpoint, [number, number]> = {
  lg: [10, 10],
  md: [10, 10],
  sm: [8, 8],
  xs: [8, 8],
  xxs: [8, 8],
};

const DECISION_TERMINAL_GRID_PADDING: Record<DecisionTerminalGridBreakpoint, [number, number]> = {
  lg: [10, 10],
  md: [10, 10],
  sm: [8, 8],
  xs: [8, 8],
  xxs: [8, 8],
};

const DECISION_TERMINAL_DRAG_CANCEL = [
  '.decision-widget-content',
  '.decision-widget-content button',
  '.decision-widget-content a',
  '.decision-widget-content input',
  '.decision-widget-content textarea',
  '.decision-widget-content select',
  '.decision-widget-content [role="button"]',
  '[contenteditable="true"]',
  '.react-resizable-handle',
].join(',');
