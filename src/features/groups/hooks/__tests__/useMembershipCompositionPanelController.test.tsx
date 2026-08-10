/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DIRECT_WITHOUT_PATH_LABEL } from '../../logic/membershipComposition';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: any) => options?.defaultValue ?? key }),
}));
vi.mock('@/features/charts/ui/ChartRenderer', () => ({ CHART_PALETTE: ['red', 'blue'] }));

import { useMembershipCompositionPanelController } from '../useMembershipCompositionPanelController';

describe('useMembershipCompositionPanelController', () => {
  it('filters empty buckets, translates direct membership, cycles colors, and changes valid modes', () => {
    const buckets = [
      {
        label: DIRECT_WITHOUT_PATH_LABEL,
        memberCount: 2,
        memberPercentage: 50,
        leadershipAssignmentCount: 1,
        leadershipPercentage: 10,
      },
      {
        label: 'Path',
        memberCount: 0,
        memberPercentage: 0,
        leadershipAssignmentCount: 1,
        leadershipPercentage: 100,
      },
      {
        label: 'Third',
        memberCount: 1,
        memberPercentage: 50,
        leadershipAssignmentCount: 2,
        leadershipPercentage: 50,
      },
    ] as any;
    const { result } = renderHook(() =>
      useMembershipCompositionPanelController(buckets, { labelOverrides: { title: 'Override' } })
    );
    expect(result.current.memberRows).toHaveLength(2);
    expect(result.current.memberRows[0]).toMatchObject({
      label: 'features.groups.memberships.composition.directWithoutPath',
      fill: 'red',
    });
    expect(result.current.leadershipRows).toHaveLength(3);
    expect(result.current.labels.title).toBe('Override');
    expect(result.current.labels.total(3)).toBe('Total: {{count}}');
    act(() => result.current.onDisplayModeChange('invalid'));
    expect(result.current.displayMode).toBe('percent');
    act(() => result.current.onDisplayModeChange('absolute'));
    expect(result.current.displayMode).toBe('absolute');
    act(() => result.current.onDisplayModeChange('percent'));
    expect(result.current.displayMode).toBe('percent');
  });
});
