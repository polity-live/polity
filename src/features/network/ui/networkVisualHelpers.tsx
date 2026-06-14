import { featureThemeRgba, featureThemeValue } from '@/features/shared/theme';
import React, { type CSSProperties, type ReactNode } from 'react';
import { RightBadge } from '@/features/shared/ui/status';

export type GroupNodeVisualVariant =
  | 'current'
  | 'parent'
  | 'child'
  | 'sibling-open'
  | 'sibling-elected'
  | 'sibling-parliament';

type GroupNodeVisualRole = 'current' | 'parent' | 'child' | 'sibling';

const GROUP_NODE_VISUALS: Record<
  GroupNodeVisualVariant,
  {
    symbol: string;
    backgroundColor: string;
    borderColor: string;
    textColor: string;
  }
> = {
  current: {
    symbol: '◉',
    backgroundColor: featureThemeValue('networkNetworkVisualHelpersInfoColor'),
    borderColor: featureThemeValue('chartChartRendererInfoColor'),
    textColor: featureThemeValue('networkNetworkVisualHelpersInfoColorAlpha'),
  },
  parent: {
    symbol: '▲',
    backgroundColor: featureThemeValue('networkNetworkVisualHelpersSuccessColor'),
    borderColor: featureThemeValue('networkNetworkVisualHelpersSuccessColorAlpha'),
    textColor: featureThemeValue('networkNetworkVisualHelpersSuccessColorBeta'),
  },
  child: {
    symbol: '▼',
    backgroundColor: featureThemeValue('networkNetworkVisualHelpersWarningColor'),
    borderColor: featureThemeValue('chartChartRendererThemeValue'),
    textColor: featureThemeValue('networkNetworkVisualHelpersWarningColorAlpha'),
  },
  'sibling-open': {
    symbol: '◎',
    backgroundColor: featureThemeValue('networkNetworkVisualHelpersWarningColorBeta'),
    borderColor: featureThemeValue('networkNetworkEdgeHelpersWarningColor'),
    textColor: featureThemeValue('networkNetworkVisualHelpersWarningColorGamma'),
  },
  'sibling-elected': {
    symbol: '◆',
    backgroundColor: featureThemeValue('networkNetworkVisualHelpersDangerColor'),
    borderColor: featureThemeValue('networkNetworkVisualHelpersDangerColorAlpha'),
    textColor: featureThemeValue('networkNetworkVisualHelpersDangerColorBeta'),
  },
  'sibling-parliament': {
    symbol: '⬢',
    backgroundColor: featureThemeValue('networkNetworkVisualHelpersAccentColor'),
    borderColor: featureThemeValue('chartChartRendererAccentColor'),
    textColor: featureThemeValue('networkNetworkVisualHelpersAccentColorAlpha'),
  },
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map(character => `${character}${character}`)
          .join('')
      : normalized;

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return featureThemeRgba(red, green, blue, alpha);
}

export function getGroupNodeVisualVariant({
  role,
  siblingMembershipMode,
}: {
  role: GroupNodeVisualRole;
  siblingMembershipMode?: string | null;
}): GroupNodeVisualVariant {
  if (role === 'current' || role === 'parent' || role === 'child') {
    return role;
  }

  if (siblingMembershipMode === 'elected') {
    return 'sibling-elected';
  }

  if (siblingMembershipMode === 'parliament') {
    return 'sibling-parliament';
  }

  return 'sibling-open';
}

export function getGroupNodeDisplayLabel(
  name: string | null | undefined,
  visualVariant: GroupNodeVisualVariant
): string {
  return `${GROUP_NODE_VISUALS[visualVariant].symbol} ${name ?? ''}`;
}

export function getGroupNodeStyle(
  visualVariant: GroupNodeVisualVariant,
  options: {
    width?: CSSProperties['width'];
    fontSize?: CSSProperties['fontSize'];
    fontWeight?: CSSProperties['fontWeight'];
    padding?: CSSProperties['padding'];
    borderRadius?: CSSProperties['borderRadius'];
    borderWidth?: number;
    textAlign?: CSSProperties['textAlign'];
    cursor?: CSSProperties['cursor'];
    boxShadow?: CSSProperties['boxShadow'];
  } = {}
): CSSProperties {
  const visual = GROUP_NODE_VISUALS[visualVariant];
  const borderWidth = options.borderWidth ?? (visualVariant === 'current' ? 3 : 2);

  return {
    background: visual.backgroundColor,
    color: visual.textColor,
    border: `${borderWidth}px solid ${visual.borderColor}`,
    borderRadius: options.borderRadius ?? '10px',
    padding: options.padding ?? '10px 12px',
    fontSize: options.fontSize ?? '12px',
    fontWeight: options.fontWeight ?? (visualVariant === 'current' ? '700' : '600'),
    width: options.width ?? 180,
    textAlign: options.textAlign ?? 'center',
    cursor: options.cursor,
    boxShadow:
      options.boxShadow ??
      `0 10px 24px ${hexToRgba(visual.borderColor, visualVariant === 'current' ? 0.22 : 0.16)}`,
  };
}

export function getGroupNodeLegendSwatch(visualVariant: GroupNodeVisualVariant): ReactNode {
  const visual = GROUP_NODE_VISUALS[visualVariant];

  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 items-center justify-center rounded-md border text-sm font-bold"
      style={{
        backgroundColor: visual.backgroundColor,
        borderColor: visual.borderColor,
        color: visual.borderColor,
      }}
    >
      {visual.symbol}
    </span>
  );
}

export function createGroupNodeLegendItem({
  id,
  label,
  visualVariant,
}: {
  id: string;
  label: string;
  visualVariant: GroupNodeVisualVariant;
}) {
  return {
    id,
    label,
    swatch: getGroupNodeLegendSwatch(visualVariant),
  };
}

export function getGroupDisplayLabel(
  name: string | null | undefined,
  groupType?: string | null
): string {
  const normalizedType = (groupType ?? '').toLowerCase();
  if (normalizedType === 'hierarchical') {
    return `🏛 ${name ?? ''}`;
  }
  if (normalizedType === 'base') {
    return `◉ ${name ?? ''}`;
  }
  if (normalizedType === 'sibling') {
    return `◎ ${name ?? ''}`;
  }
  return name ?? '';
}

export function renderRightsEdgeLabel(rights: string[]) {
  return (
    <div className="border-border/60 bg-background/95 flex flex-wrap gap-0.5 rounded-md border px-1.5 py-1 shadow-sm backdrop-blur-sm">
      {rights.map(right => (
        <RightBadge key={right} right={right} size="compact" />
      ))}
    </div>
  );
}
