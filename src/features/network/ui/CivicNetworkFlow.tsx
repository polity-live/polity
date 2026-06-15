'use client';

import type { Node } from '@xyflow/react';
import type { ReactNode } from 'react';
import { NetworkFlowBase, type NetworkFlowBaseProps } from '@/features/network/ui/NetworkFlowBase';
import { CivicNetworkFlowPanel } from '@/features/network/ui/CivicNetworkFlowPanel';
import type {
  CivicNetworkLegendSection,
  NetworkControlPanelProps,
  NetworkLegendItem,
} from '@/features/network/ui/NetworkControlPanel';

type CivicNetworkPanelConfig = Omit<
  NetworkControlPanelProps,
  'legendItems' | 'legendSections' | 'controlsExtraContent' | 'legendExtraContent'
>;

export interface CivicNetworkFlowProps<TNode extends Node = Node> extends Omit<
  NetworkFlowBaseProps<TNode>,
  'panel'
> {
  panelConfig: CivicNetworkPanelConfig;
  legendItems?: readonly NetworkLegendItem[];
  legendSections?: readonly CivicNetworkLegendSection[];
  controlsExtraContent?: ReactNode;
  legendExtraContent?: ReactNode;
}

export function CivicNetworkFlow<TNode extends Node = Node>({
  panelConfig,
  legendItems,
  legendSections,
  controlsExtraContent,
  legendExtraContent,
  ...flowProps
}: CivicNetworkFlowProps<TNode>) {
  return (
    <NetworkFlowBase
      {...flowProps}
      panel={
        <CivicNetworkFlowPanel
          {...panelConfig}
          legendItems={legendItems}
          legendSections={legendSections}
          controlsExtraContent={controlsExtraContent}
          legendExtraContent={legendExtraContent}
        />
      }
    />
  );
}
