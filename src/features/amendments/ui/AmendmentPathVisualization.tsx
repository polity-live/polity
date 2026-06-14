'use client';

import { featureThemeClassName, featureThemeValue } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { useEffect } from 'react';
import { Node, Edge, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import { NetworkFlowBase, Panel } from '@/features/network/ui/NetworkFlowBase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Calendar, ArrowRight, Target } from 'lucide-react';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

interface AmendmentPathVisualizationProps {
  amendmentId: string;
}

export function AmendmentPathVisualization({ amendmentId }: AmendmentPathVisualizationProps) {
  const { t } = useTranslation();
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);

  // Fetch amendment data with target, event, and path segments
  const { amendmentPathViz: amendment } = useAmendmentState({
    amendmentId,
    includePathViz: true,
  });
  const hasTarget = amendment?.group && amendment?.event;

  // Derive pathSegments for use in JSX
  const pathSegments = [...(amendment?.paths?.[0]?.segments || [])].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );

  // Generate visualization nodes and edges
  useEffect(() => {
    const segments = [...(amendment?.paths?.[0]?.segments || [])].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );

    if (!segments || segments.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Create nodes for each step in the path
    segments.forEach((segment, index) => {
      const xPos = 100 + index * 250;
      const yPos = 200;
      const isFirst = index === 0;
      const isTarget = index === segments.length - 1;

      newNodes.push({
        id: `path-node-${index}`,
        type: 'default',
        position: { x: xPos, y: yPos },
        data: {
          label: segment.group_id || 'Unknown Group',
          event: segment.event_id || 'No Event',
          type: 'group',
        },
        style: {
          background: isTarget
            ? featureThemeValue('amendmentAmendmentPathVisualizationDangerColor')
            : isFirst
              ? featureThemeValue('amendmentAmendmentPathVisualizationThemeValue')
              : featureThemeValue('amendmentAmendmentPathVisualizationSuccessColor'),
          color: featureThemeValue('amendmentAmendmentPathVisualizationNeutralColor'),
          border: `2px solid ${isTarget ? featureThemeValue('amendmentAmendmentPathVisualizationDangerColorAlpha') : isFirst ? featureThemeValue('amendmentAmendmentPathVisualizationInfoColor') : featureThemeValue('amendmentAmendmentPathVisualizationThemeValueAlpha')}`,
          borderRadius: '5px',
          padding: '10px',
          fontSize: '12px',
          fontWeight: '500',
          width: 180,
          textAlign: 'center',
        },
      });
    });

    // Create edges between groups
    segments.forEach((segment, index) => {
      if (index < segments.length - 1) {
        newEdges.push({
          id: `path-edge-${index}`,
          source: `path-node-${index}`,
          target: `path-node-${index + 1}`,
          type: 'smoothstep',
          animated: true,
          label: translateText('generated.inline.0021_amendmentright_eba6c724'),
          style: {
            stroke: featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
            strokeWidth: 2,
          },
          labelStyle: {
            fill: featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorBeta'),
            fontWeight: 600,
            fontSize: '11px',
          },
          labelBgStyle: {
            fill: 'white',
            fillOpacity: 0.9,
          },
          labelBgPadding: [8, 4] as [number, number],
          labelBgBorderRadius: 4,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
          },
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [amendment?.paths, setNodes, setEdges]);

  if (!amendment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('features.amendments.pathVisualization.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t('features.amendments.process.loading')}
          </p>
        </CardContent>
      </Card>
    );
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
            <NetworkFlowBase
              nodes={nodes}
              edges={edges}
              nodesDraggable={false}
              containerClassName="h-full min-h-0"
              panel={
                <Panel
                  position="top-right"
                  className={featureThemeClassName(
                    'amendmentAmendmentPathVisualizationContrastPanel'
                  )}
                >
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className={featureThemeClassName(
                          'amendmentAmendmentPathVisualizationThemedSurface'
                        )}
                      ></div>
                      <span>{t('features.amendments.pathVisualization.start')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={featureThemeClassName(
                          'amendmentAmendmentPathVisualizationThemedSurfaceAlpha'
                        )}
                      ></div>
                      <span>{t('features.amendments.pathVisualization.path')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={featureThemeClassName(
                          'amendmentAmendmentPathVisualizationThemedSurfaceBeta'
                        )}
                      ></div>
                      <span>{t('features.amendments.process.target')}</span>
                    </div>
                  </div>
                </Panel>
              }
            />
          </div>

          {/* Path details list */}
          <div className="mt-6 space-y-3">
            {pathSegments?.map((segment, index) => (
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
