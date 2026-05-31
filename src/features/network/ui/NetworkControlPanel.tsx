'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Panel } from '@/features/network/ui/NetworkFlowBase';
import {
  RightFilters,
  RIGHT_TYPES,
  RIGHT_GRADIENTS,
  RIGHT_LABELS,
} from '@/features/network/ui/RightFilters';
import { NETWORK_CONNECTION_DIRECTION_COLORS } from '@/features/network/logic/networkEdgeHelpers';
import { cn } from '@/features/shared/utils/utils';

export interface NetworkLegendItem {
  id: string;
  label: string;
  swatchClassName?: string;
  swatch?: ReactNode;
}

export interface NetworkRelationshipStatusFilter {
  id: string;
  label: string;
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  activeClassName?: string;
  inactiveClassName?: string;
}

export const NETWORK_FILTER_ACTIVE_CLASS_NAMES = {
  neutral:
    'border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200 hover:text-slate-950 dark:border-white/70 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:hover:text-white',
  green:
    'border-emerald-200 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 hover:text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-100 dark:hover:bg-emerald-900 dark:hover:text-emerald-50',
  blue: 'border-blue-200 bg-blue-100 text-blue-900 hover:bg-blue-200 hover:text-blue-950 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-100 dark:hover:bg-blue-900 dark:hover:text-blue-50',
  orange:
    'border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-200 hover:text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-100 dark:hover:bg-amber-900 dark:hover:text-amber-50',
  purple:
    'border-violet-200 bg-violet-100 text-violet-900 hover:bg-violet-200 hover:text-violet-950 dark:border-violet-800 dark:bg-violet-950/70 dark:text-violet-100 dark:hover:bg-violet-900 dark:hover:text-violet-50',
} as const;

interface NetworkControlPanelProps {
  title: string;
  description?: string;
  panelCollapsed: boolean;
  onPanelCollapsedChange: (collapsed: boolean) => void;
  legendCollapsed: boolean;
  onLegendCollapsedChange: (collapsed: boolean) => void;
  legendItems: readonly NetworkLegendItem[];
  legendTitle?: string;
  showGroupTypeLegend?: boolean;
  baseGroupLabel?: string;
  hierarchicalGroupLabel?: string;
  siblingGroupLabel?: string;
  showDisplayControls?: boolean;
  showInteractiveToggle?: boolean;
  depthFilters?: readonly NetworkRelationshipStatusFilter[];
  showIndirect?: boolean;
  onShowIndirectChange?: (showIndirect: boolean) => void;
  isInteractive: boolean;
  onInteractiveChange: (isInteractive: boolean) => void;
  directLabel?: string;
  indirectLabel?: string;
  lockLabel?: string;
  unlockLabel?: string;
  showRightsFilter?: boolean;
  selectedRights?: Set<string>;
  onToggleRight?: (right: string) => void;
  filterRight?: string;
  filteredByPrefix?: string;
  showRightsLegend?: boolean;
  showConnectionDirectionLegend?: boolean;
  connectionDirectionLegendTitle?: string;
  bidirectionalConnectionLabel?: string;
  incomingConnectionLabel?: string;
  outgoingConnectionLabel?: string;
  relationshipStatusFilters?: readonly NetworkRelationshipStatusFilter[];
  relationshipStatusFiltersLabel?: string;
  connectionDirectionFilters?: readonly NetworkRelationshipStatusFilter[];
  controlsExtraContent?: ReactNode;
  legendExtraContent?: ReactNode;
}

export function NetworkControlPanel({
  title,
  description,
  panelCollapsed,
  onPanelCollapsedChange,
  legendCollapsed,
  onLegendCollapsedChange,
  legendItems,
  legendTitle = 'Legend',
  showGroupTypeLegend = false,
  baseGroupLabel = '◉ Base group',
  hierarchicalGroupLabel = '🏛 Hierarchical group',
  siblingGroupLabel = '◎ Sibling group',
  showDisplayControls = true,
  showInteractiveToggle = true,
  depthFilters,
  showIndirect = false,
  onShowIndirectChange,
  isInteractive,
  onInteractiveChange,
  directLabel = 'Direct',
  indirectLabel = 'Indirect',
  lockLabel = 'Lock Editor',
  unlockLabel = 'Unlock Editor',
  showRightsFilter = false,
  selectedRights,
  onToggleRight,
  filterRight,
  filteredByPrefix = 'Filtered by',
  showRightsLegend = false,
  showConnectionDirectionLegend = false,
  connectionDirectionLegendTitle = 'Connection direction',
  bidirectionalConnectionLabel = 'Bidirectional',
  incomingConnectionLabel = 'Incoming',
  outgoingConnectionLabel = 'Outgoing',
  relationshipStatusFilters,
  relationshipStatusFiltersLabel,
  connectionDirectionFilters,
  controlsExtraContent,
  legendExtraContent,
}: NetworkControlPanelProps) {
  const canRenderRightFilter = showRightsFilter && !filterRight && selectedRights && onToggleRight;
  const resolvedDepthFilters =
    depthFilters ??
    (showDisplayControls && onShowIndirectChange
      ? [
          {
            id: 'direct',
            label: directLabel,
            active: !showIndirect,
            onToggle: () => onShowIndirectChange(false),
          },
          {
            id: 'indirect',
            label: indirectLabel,
            active: showIndirect,
            onToggle: () => onShowIndirectChange(true),
          },
        ]
      : undefined);

  const renderFilterRow = (filters: readonly NetworkRelationshipStatusFilter[] | undefined) => {
    if (!filters || filters.length === 0) {
      return null;
    }

    return (
      <div className="border-border/70 bg-background/95 dark:bg-card/95 rounded-lg border p-2 shadow-sm">
        <div className="flex shrink-0 flex-wrap gap-2">
          {filters.map(filter => (
            <Button
              key={filter.id}
              type="button"
              size="sm"
              variant="outline"
              onClick={filter.onToggle}
              disabled={filter.disabled}
              className={cn(
                filter.active
                  ? (filter.activeClassName ??
                      'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground')
                  : (filter.inactiveClassName ??
                      'border-border bg-background/90 text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-card/90 dark:text-foreground'),
                filter.disabled && 'pointer-events-none opacity-50'
              )}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Panel
      position="top-left"
      className="border-border/80 bg-background/95 dark:bg-background/95 flex max-h-[calc(100%-1rem)] w-[calc(100%-1rem)] max-w-sm flex-col overflow-hidden rounded border p-4 shadow-lg supports-[backdrop-filter]:backdrop-blur-sm"
    >
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onPanelCollapsedChange(!panelCollapsed)}
          className="h-6 w-6 p-0"
        >
          {panelCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {!panelCollapsed && (
        <div className="flex min-h-0 flex-1 flex-col">
          {description ? (
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{description}</p>
          ) : null}

          <div className="space-y-3">
            {renderFilterRow(resolvedDepthFilters)}
            {renderFilterRow(connectionDirectionFilters)}
            {renderFilterRow(relationshipStatusFilters)}

            {showInteractiveToggle || controlsExtraContent ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                {showInteractiveToggle ? (
                  <Button
                    size="sm"
                    variant={isInteractive ? 'outline' : 'default'}
                    onClick={() => onInteractiveChange(!isInteractive)}
                  >
                    {isInteractive ? lockLabel : unlockLabel}
                  </Button>
                ) : null}

                {controlsExtraContent}
              </div>
            ) : null}
          </div>

          {canRenderRightFilter ? (
            <RightFilters selectedRights={selectedRights} onToggleRight={onToggleRight} />
          ) : null}

          {filterRight ? (
            <div className="mt-3 shrink-0 rounded-md bg-blue-50 p-2 text-sm dark:bg-blue-950/20">
              <span className="font-medium">{filteredByPrefix}:</span>{' '}
              <span className="text-blue-700 dark:text-blue-300">
                {filterRight.replace('Right', '')}
              </span>
            </div>
          ) : null}

          <div className="border-border/70 bg-background/95 dark:bg-card/95 mt-3 flex min-h-0 flex-1 flex-col rounded-lg border p-3 shadow-sm">
            <button
              onClick={() => onLegendCollapsedChange(!legendCollapsed)}
              className="hover:text-primary flex w-full shrink-0 items-center justify-between text-sm font-medium"
            >
              <span>{legendTitle}</span>
              {legendCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
            {!legendCollapsed && (
              <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm">
                {legendItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    {item.swatch ? (
                      item.swatch
                    ) : item.swatchClassName ? (
                      <div className={item.swatchClassName}></div>
                    ) : null}
                    <span>{item.label}</span>
                  </div>
                ))}

                {showGroupTypeLegend ? (
                  <>
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded border-2 border-solid border-gray-400 bg-gray-100"></div>
                      <span>{baseGroupLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded border-2 border-dashed border-gray-400 bg-gray-100"></div>
                      <span>{hierarchicalGroupLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded border-2 border-[#fbbf24] bg-[#fff8e1]"></div>
                      <span>{siblingGroupLabel}</span>
                    </div>
                  </>
                ) : null}

                {showConnectionDirectionLegend ? (
                  <>
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    <div className="space-y-2">
                      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {connectionDirectionLegendTitle}
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1 w-8 rounded-full"
                          style={{
                            backgroundColor: NETWORK_CONNECTION_DIRECTION_COLORS.bidirectional,
                          }}
                        ></div>
                        <span>{bidirectionalConnectionLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1 w-8 rounded-full"
                          style={{ backgroundColor: NETWORK_CONNECTION_DIRECTION_COLORS.outgoing }}
                        ></div>
                        <span>{outgoingConnectionLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1 w-8 rounded-full"
                          style={{ backgroundColor: NETWORK_CONNECTION_DIRECTION_COLORS.incoming }}
                        ></div>
                        <span>{incomingConnectionLabel}</span>
                      </div>
                    </div>
                  </>
                ) : null}

                {relationshipStatusFilters &&
                relationshipStatusFilters.length > 0 &&
                relationshipStatusFiltersLabel ? (
                  <>
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    <div className="space-y-2">
                      {relationshipStatusFiltersLabel ? (
                        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          {relationshipStatusFiltersLabel}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {showRightsLegend ? (
                  <>
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    {RIGHT_TYPES.map(right => (
                      <div key={right} className="flex items-center gap-2">
                        <div className={`h-3 w-6 rounded-sm ${RIGHT_GRADIENTS[right]}`}></div>
                        <span>{RIGHT_LABELS[right]}</span>
                      </div>
                    ))}
                  </>
                ) : null}

                {legendExtraContent ? <>{legendExtraContent}</> : null}
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
