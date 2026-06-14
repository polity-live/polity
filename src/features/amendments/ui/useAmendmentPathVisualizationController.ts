'use client';
import { featureThemeValue } from '@/features/shared/theme';
import { useEffect } from 'react';
import { Node, Edge, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
interface AmendmentPathVisualizationProps {
  amendmentId: string;
}

export function useAmendmentPathVisualizationController({
  amendmentId,
}: AmendmentPathVisualizationProps) {
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

  return {
    amendmentId,
    t,
    nodes,
    setNodes,
    edges,
    setEdges,
    amendment,
    hasTarget,
    pathSegments,
  };
}
