import { useState } from 'react';

interface HoverTooltipItem {
  color?: string;
  name: string;
  value: string;
}

export interface HoverTooltipState {
  items: HoverTooltipItem[];
  label?: string;
  x: number;
  y: number;
}

export function useChartRendererController(staticMode: boolean) {
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(null);

  return {
    hoverTooltip,
    onHoverChange: staticMode ? undefined : setHoverTooltip,
  };
}
