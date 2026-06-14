'use client';

import type { ReactNode } from 'react';

import { useNetworkViewportPanelController } from '../hooks/useNetworkViewportPanelController';
import { NetworkViewportPanelView } from './NetworkViewportPanelView';

const MIN_PANEL_HEIGHT_PX = 384;

interface NetworkViewportPanelProps {
  children: ReactNode;
  className?: string;
  minHeight?: number;
}

export function NetworkViewportPanel({
  children,
  className,
  minHeight = MIN_PANEL_HEIGHT_PX,
}: NetworkViewportPanelProps) {
  return (
    <NetworkViewportPanelView
      className={className}
      {...useNetworkViewportPanelController(minHeight)}
    >
      {children}
    </NetworkViewportPanelView>
  );
}
