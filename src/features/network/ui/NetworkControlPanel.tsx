'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Panel } from '@/features/network/ui/NetworkFlowBase';
import {
  NETWORK_FLOW_FILTER_TYPES,
  RIGHT_GRADIENTS,
  getRightLabel,
} from '@/features/shared/ui/status';
import { RightFilters } from '@/features/network/ui/RightFilters';
import { NETWORK_CONNECTION_DIRECTION_COLORS } from '@/features/network/logic/networkEdgeHelpers';
import { cn } from '@/features/shared/utils/utils';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

export interface NetworkLegendItem {
  id: string;
  label: string;
  swatchClassName?: string;
  swatch?: ReactNode;
}

export interface CivicNetworkLegendSection {
  id: string;
  title?: string;
  items: readonly NetworkLegendItem[];
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
  neutral: featureThemeClassName('networkNetworkControlPanelNeutralContrastBadge'),
  green: featureThemeClassName('networkNetworkControlPanelSuccessBadge'),
  blue: featureThemeClassName('networkNetworkControlPanelInfoBadge'),
  orange: featureThemeClassName('networkNetworkControlPanelWarningBadge'),
  purple: featureThemeClassName('networkNetworkControlPanelAccentBadge'),
} as const;

export interface NetworkControlPanelProps {
  title: string;
  description?: string;
  panelCollapsed: boolean;
  onPanelCollapsedChange: (collapsed: boolean) => void;
  legendCollapsed: boolean;
  onLegendCollapsedChange: (collapsed: boolean) => void;
  legendItems?: readonly NetworkLegendItem[];
  legendSections?: readonly CivicNetworkLegendSection[];
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
  onPanelCollapsedChange,
  onLegendCollapsedChange,
  legendItems,
  legendSections,
  legendTitle = 'Legend',
  showGroupTypeLegend = false,
  baseGroupLabel = translateText('generated.inline.0118_base_group_51212428'),
  hierarchicalGroupLabel = translateText('generated.inline.0119_hierarchical_group_9bdd8876'),
  siblingGroupLabel = translateText('generated.inline.0120_sibling_group_ab012d49'),
  showDisplayControls = true,
  showInteractiveToggle = true,
  depthFilters,
  showIndirect = false,
  onShowIndirectChange,
  isInteractive,
  onInteractiveChange,
  directLabel = 'Direct',
  indirectLabel = 'Indirect',
  lockLabel = translateText('generated.inline.0121_lock_editor_357aaa55'),
  unlockLabel = translateText('generated.inline.0122_unlock_editor_b60d9fb1'),
  showRightsFilter = false,
  selectedRights,
  onToggleRight,
  filterRight,
  filteredByPrefix = 'Filtered by',
  showRightsLegend = false,
  showConnectionDirectionLegend = false,
  connectionDirectionLegendTitle = translateText(
    'generated.inline.0123_connection_direction_701f52c9'
  ),
  bidirectionalConnectionLabel = 'Bidirectional',
  incomingConnectionLabel = 'Incoming',
  outgoingConnectionLabel = 'Outgoing',
  relationshipStatusFilters,
  relationshipStatusFiltersLabel,
  connectionDirectionFilters,
  controlsExtraContent,
  legendExtraContent,
}: NetworkControlPanelProps) {
  const { t } = useTranslation();
  const panelContentId = useId();
  const legendContentId = useId();
  const [renderedPanelCollapsed, setRenderedPanelCollapsed] = useState(true);
  const [renderedLegendCollapsed, setRenderedLegendCollapsed] = useState(true);
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
      <div className={featureThemeClassName('networkNetworkControlPanelThemedSurface')}>
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
                      featureThemeClassName('networkNetworkControlPanelThemedBadge')),
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
  const resolvedLegendSections =
    legendSections ??
    (legendItems
      ? [
          {
            id: 'default',
            items: legendItems,
          },
        ]
      : []);

  return (
    <Panel
      position="top-left"
      className={featureThemeClassName('networkNetworkControlPanelThemedSurfaceAlpha')}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <Button
          size="sm"
          variant="ghost"
          aria-label={title}
          aria-expanded={!renderedPanelCollapsed}
          aria-controls={panelContentId}
          onClick={() => {
            const nextCollapsed = !renderedPanelCollapsed;
            setRenderedPanelCollapsed(nextCollapsed);
            onPanelCollapsedChange(nextCollapsed);
          }}
          className="h-6 w-6 p-0"
        >
          {renderedPanelCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
      </div>

      {!renderedPanelCollapsed && (
        <div id={panelContentId} className="flex min-h-0 flex-1 flex-col">
          {description ? (
            <p className={featureThemeClassName('networkNetworkControlPanelNeutralText')}>
              {description}
            </p>
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
            <div className={featureThemeClassName('networkNetworkControlPanelInfoPanel')}>
              <span className="font-medium">{filteredByPrefix}:</span>{' '}
              <span className={featureThemeClassName('networkNetworkControlPanelInfoText')}>
                {getRightLabel(filterRight, (key, fallback) => t(key) || fallback || key)}
              </span>
            </div>
          ) : null}

          <div className={featureThemeClassName('networkNetworkControlPanelThemedSurfaceBeta')}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={!renderedLegendCollapsed}
              aria-controls={legendContentId}
              onClick={() => {
                const nextCollapsed = !renderedLegendCollapsed;
                setRenderedLegendCollapsed(nextCollapsed);
                onLegendCollapsedChange(nextCollapsed);
              }}
              className="hover:text-primary flex h-auto w-full shrink-0 items-center justify-between px-0 py-0 text-sm font-medium"
            >
              <span>{legendTitle}</span>
              {renderedLegendCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
            {!renderedLegendCollapsed && (
              <div
                id={legendContentId}
                className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm"
              >
                {resolvedLegendSections.map((section, sectionIndex) => (
                  <div key={section.id} className="space-y-2">
                    {sectionIndex > 0 ? (
                      <hr
                        className={featureThemeClassName('networkUseGroupNetworkFlowNeutralBorder')}
                      />
                    ) : null}
                    {section.title ? (
                      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {section.title}
                      </div>
                    ) : null}
                    {section.items.map(item => (
                      <div key={item.id} className="flex items-center gap-2">
                        {item.swatch ? (
                          item.swatch
                        ) : item.swatchClassName ? (
                          <div className={item.swatchClassName}></div>
                        ) : null}
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                ))}

                {showGroupTypeLegend ? (
                  <>
                    <hr
                      className={featureThemeClassName('networkUseGroupNetworkFlowNeutralBorder')}
                    />
                    <div className="flex items-center gap-2">
                      <div
                        className={featureThemeClassName(
                          'networkNetworkControlPanelNeutralSurface'
                        )}
                      ></div>
                      <span>{baseGroupLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={featureThemeClassName(
                          'networkNetworkControlPanelNeutralSurfaceAlpha'
                        )}
                      ></div>
                      <span>{hierarchicalGroupLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={featureThemeClassName(
                          'networkNetworkControlPanelThemedSurfaceGamma'
                        )}
                      ></div>
                      <span>{siblingGroupLabel}</span>
                    </div>
                  </>
                ) : null}

                {showConnectionDirectionLegend ? (
                  <>
                    <hr
                      className={featureThemeClassName('networkUseGroupNetworkFlowNeutralBorder')}
                    />
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
                    <hr
                      className={featureThemeClassName('networkUseGroupNetworkFlowNeutralBorder')}
                    />
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
                    <hr
                      className={featureThemeClassName('networkUseGroupNetworkFlowNeutralBorder')}
                    />
                    {NETWORK_FLOW_FILTER_TYPES.map(right => (
                      <div key={right} className="flex items-center gap-2">
                        <div className={`h-3 w-6 rounded-sm ${RIGHT_GRADIENTS[right]}`}></div>
                        <span>
                          {getRightLabel(right, (key, fallback) => t(key) || fallback || key)}
                        </span>
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
