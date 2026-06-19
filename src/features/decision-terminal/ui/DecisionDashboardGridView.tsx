'use client';

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

import type { DecisionTerminalDashboardConfig } from '@/zero/preferences';
import {
  DECISION_TERMINAL_GRID_BREAKPOINTS,
  DECISION_TERMINAL_GRID_COLUMNS,
  selectWidgetDecisions,
  type DecisionTerminalGridBreakpoint,
} from '../logic/dashboard-config';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { DecisionWidgetContent } from './DecisionWidgetContent';
import { DecisionWidgetFrame } from './DecisionWidgetFrame';
import type { DecisionItem } from './types';

const ResponsiveDecisionGrid = WidthProvider(Responsive);

export interface DecisionDashboardGridViewProps {
  config: DecisionTerminalDashboardConfig;
  decisions: DecisionItem[];
  layouts: ResponsiveLayouts<DecisionTerminalGridBreakpoint>;
  isLoading?: boolean;
  searchQuery?: string;
  onBreakpointChange: (breakpoint: string) => void;
  onLayoutPersist: (layout: Layout) => void;
  onVoteDecision: (decision: DecisionItem) => void;
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
      data-swipe-lock
    />
  );
}

export function DecisionDashboardGridView({
  config,
  decisions,
  layouts,
  isLoading = false,
  searchQuery = '',
  onBreakpointChange,
  onLayoutPersist,
  onVoteDecision,
}: DecisionDashboardGridViewProps) {
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
        onBreakpointChange={onBreakpointChange}
        onDragStop={onLayoutPersist}
        onResizeStop={onLayoutPersist}
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
