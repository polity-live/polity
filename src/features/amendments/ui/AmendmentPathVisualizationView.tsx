'use client';
import { BadgeControl } from '@/features/shared/ui/status';
import { useState } from 'react';
import { CivicNetworkFlow } from '@/features/network/ui/CivicNetworkFlow';
import { createGroupNodeLegendItem } from '@/features/network/ui/networkVisualHelpers';
import { NetworkFlowSkeleton } from '@/features/network/ui/NetworkFlowSkeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Calendar, ArrowRight, Target } from 'lucide-react';
export interface AmendmentPathVisualizationViewProps {
  amendmentId: any;
  t: any;
  nodes: any;
  setNodes: any;
  edges: any;
  setEdges: any;
  amendment: any;
  hasTarget: any;
  pathSegments: any[];
}

export function AmendmentPathVisualizationView({
  t,
  nodes,
  edges,
  amendment,
  hasTarget,
  pathSegments,
}: AmendmentPathVisualizationViewProps) {
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(true);

  if (!amendment) {
    return <NetworkFlowSkeleton label={t('common.network.loadingNetwork')} />;
  }

  if (!hasTarget) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('features.amendments.pathVisualization.title')}
          </CardTitle>
          <CardDescription>
            {t('features.amendments.pathVisualization.noTargetSet')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t('features.amendments.pathVisualization.visitProcessTab')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!pathSegments || pathSegments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('features.amendments.pathVisualization.title')}
          </CardTitle>
          <CardDescription>
            {t('features.amendments.pathVisualization.pathCalculating')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p className="font-semibold">{t('features.amendments.process.target')}:</p>
            <div className="ml-4">
              <p>
                <span className="text-muted-foreground">
                  {t('features.amendments.process.targetGroup')}:
                </span>{' '}
                {amendment.group?.name}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t('features.amendments.process.event')}:
                </span>{' '}
                {amendment.event?.title}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('features.amendments.pathVisualization.title')}
          </CardTitle>
          <CardDescription>
            {t('features.amendments.pathVisualization.shortestPath', {
              count: pathSegments.length,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Target information */}
          <div className="bg-muted/50 mb-4 rounded-lg border p-4">
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <div className="text-muted-foreground font-semibold">
                  {t('features.amendments.process.targetGroup')}
                </div>
                <div className="mt-1">{amendment.group?.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground font-semibold">
                  {t('features.amendments.process.targetEvent')}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {amendment.event?.title}
                </div>
                {amendment.event?.start_date && (
                  <p className="text-muted-foreground text-xs">
                    {new Date(amendment.event?.start_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Path visualization */}
          <div className="bg-background h-[250px] overflow-hidden rounded-lg border">
            <CivicNetworkFlow
              nodes={nodes}
              edges={edges}
              nodesDraggable={false}
              nodesFocusable={false}
              nodesConnectable={false}
              edgesFocusable={false}
              containerClassName="h-full min-h-0"
              showMiniMap={false}
              panelConfig={{
                title: t('features.amendments.pathVisualization.title'),
                description: t('features.amendments.pathVisualization.shortestPath', {
                  count: pathSegments.length,
                }),
                panelCollapsed,
                onPanelCollapsedChange: setPanelCollapsed,
                legendCollapsed,
                onLegendCollapsedChange: setLegendCollapsed,
                legendTitle: t('common.network.legend'),
                showDisplayControls: false,
                showInteractiveToggle: false,
                isInteractive: false,
                onInteractiveChange: () => undefined,
              }}
              legendItems={[
                createGroupNodeLegendItem({
                  id: 'path-start',
                  label: t('features.amendments.pathVisualization.start'),
                  visualVariant: 'current',
                }),
                createGroupNodeLegendItem({
                  id: 'path-step',
                  label: t('features.amendments.pathVisualization.path'),
                  visualVariant: 'parent',
                }),
                createGroupNodeLegendItem({
                  id: 'path-target',
                  label: t('features.amendments.process.target'),
                  visualVariant: 'child',
                }),
              ]}
            />
          </div>

          {/* Path details list */}
          <div className="mt-6 space-y-3">
            {pathSegments?.map((segment: any, index: number) => (
              <div key={segment.group_id || index} className="flex items-start gap-3">
                <div className="bg-primary text-primary-foreground flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{segment.group_id || t('common.unspecified')}</h4>
                    {index === 0 && (
                      <BadgeControl variant="secondary">
                        {t('features.amendments.pathVisualization.start')}
                      </BadgeControl>
                    )}
                    {index === pathSegments.length - 1 && (
                      <BadgeControl variant="destructive">
                        {t('features.amendments.process.target')}
                      </BadgeControl>
                    )}
                  </div>
                  {segment.event_id && (
                    <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      <span>{segment.event_id}</span>
                    </div>
                  )}
                </div>
                {index < pathSegments.length - 1 && (
                  <ArrowRight className="text-muted-foreground mt-2 h-5 w-5 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
