import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CHART_PALETTE } from '@/features/charts/ui/ChartRenderer';
import { DIRECT_WITHOUT_PATH_LABEL } from '@/features/groups/logic/membershipComposition';
import type { MembershipCompositionBucket } from '../types/group.types';

export type CompositionDisplayMode = 'percent' | 'absolute';

export interface MembershipCompositionPanelLabels {
  title: string;
  description: string;
  modePercent: string;
  modeAbsolute: string;
  membersTitle: string;
  membersDescription: string;
  membersEmpty: string;
  leadershipTitle: string;
  leadershipDescription: string;
  leadershipEmpty: string;
  loading: string;
  total: (count: number) => string;
  leadershipFootnote: string;
}

interface MembershipCompositionPanelControllerOptions {
  labelOverrides?: Partial<MembershipCompositionPanelLabels>;
}

export function useMembershipCompositionPanelController(
  buckets: MembershipCompositionBucket[],
  options: MembershipCompositionPanelControllerOptions = {}
) {
  const { t } = useTranslation();
  const [displayMode, setDisplayMode] = useState<CompositionDisplayMode>('percent');
  const directWithoutPathLabel = t('features.groups.memberships.composition.directWithoutPath');

  const memberRows = useMemo(
    () =>
      buckets
        .filter(bucket => bucket.memberCount > 0)
        .map((bucket, index) => ({
          ...bucket,
          label: bucket.label === DIRECT_WITHOUT_PATH_LABEL ? directWithoutPathLabel : bucket.label,
          value: bucket.memberCount,
          percentage: bucket.memberPercentage,
          fill: CHART_PALETTE[index % CHART_PALETTE.length],
        })),
    [buckets, directWithoutPathLabel]
  );
  const leadershipRows = useMemo(
    () =>
      buckets
        .filter(bucket => bucket.leadershipAssignmentCount > 0)
        .map((bucket, index) => ({
          ...bucket,
          label: bucket.label === DIRECT_WITHOUT_PATH_LABEL ? directWithoutPathLabel : bucket.label,
          value: bucket.leadershipAssignmentCount,
          percentage: bucket.leadershipPercentage,
          fill: CHART_PALETTE[index % CHART_PALETTE.length],
        })),
    [buckets, directWithoutPathLabel]
  );

  const handleDisplayModeChange = (value: string) => {
    if (value === 'percent' || value === 'absolute') {
      setDisplayMode(value);
    }
  };

  return {
    displayMode,
    memberRows,
    leadershipRows,
    labels: {
      title: t('features.groups.memberships.composition.title'),
      description: t('features.groups.memberships.composition.description'),
      modePercent: t('features.groups.memberships.composition.modePercent', '%'),
      modeAbsolute: t('features.groups.memberships.composition.modeAbsolute'),
      membersTitle: t('features.groups.memberships.composition.membersTitle'),
      membersDescription: t('features.groups.memberships.composition.membersDescription'),
      membersEmpty: t('features.groups.memberships.composition.membersEmpty'),
      leadershipTitle: t('features.groups.memberships.composition.leadershipTitle'),
      leadershipDescription: t('features.groups.memberships.composition.leadershipDescription'),
      leadershipEmpty: t('features.groups.memberships.composition.leadershipEmpty'),
      loading: t('features.groups.memberships.composition.loading'),
      total: (count: number) =>
        t('features.groups.memberships.composition.total', {
          defaultValue: 'Total: {{count}}',
          count,
        }),
      leadershipFootnote: t('features.groups.memberships.composition.leadershipFootnote'),
      ...options.labelOverrides,
    } satisfies MembershipCompositionPanelLabels,
    onDisplayModeChange: handleDisplayModeChange,
  };
}
