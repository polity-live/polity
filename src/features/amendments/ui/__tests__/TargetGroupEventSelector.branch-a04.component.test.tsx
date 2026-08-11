/* @vitest-environment jsdom */

import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const onViewProps = vi.hoisted(() => vi.fn());
const selectorData = vi.hoisted(() => ({
  emptyRows: [] as never[],
  groups: [
    { id: 'source', name: 'Source' },
    { id: 'target', name: 'Target' },
  ],
  workflow: {
    id: 'unreachable-workflow',
    start_group_id: 'source',
    group_id: 'target',
    steps: [{ id: 'step-1', group_id: 'target' }],
  },
}));

vi.mock('../TargetGroupEventSelectorView', () => ({
  TargetGroupEventSelectorView: (props: Record<string, unknown>) => {
    onViewProps(props);
    if (onViewProps.mock.calls.length > 20) {
      throw new Error('TargetGroupEventSelector rendered more than 20 times');
    }
    return <div data-testid="selector-view" />;
  },
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    allGroups: selectorData.groups,
    allGroupRelationships: selectorData.emptyRows,
    allGroupMemberships: selectorData.emptyRows,
    allEvents: selectorData.emptyRows,
  }),
}));

vi.mock('@/zero/network/useWorkflowState', () => ({
  useWorkflowState: () => ({ allWorkflows: [selectorData.workflow] }),
}));

vi.mock('@/features/amendments/logic/amendmentPathHelpers', () => ({
  getActiveUserGroupIds: () => ['source'],
  getReachableTargetGroupsFromSource: () => selectorData.emptyRows,
  getReachableWorkflowsFromSource: () => selectorData.emptyRows,
  getProcessPathGroupOptions: () => selectorData.emptyRows,
  calculateProcessPathWithClosestEventsForGroupIds: () => null,
  calculateProcessPathWithClosestEvents: () => null,
  calculateWorkflowProcessPathWithClosestEvents: () => null,
  getEligibleEventsForPathSegment: () => selectorData.emptyRows,
  getWorkflowStartGroupId: (workflow: { start_group_id?: string }) =>
    workflow.start_group_id ?? null,
  getWorkflowFinalGroupId: (workflow: { group_id?: string }) => workflow.group_id ?? null,
  rehydratePathSegmentsWithWindows: (segments: unknown[]) => segments,
}));

vi.mock('@/features/shared/ui/typeahead/toTypeaheadItems', () => ({
  toTypeaheadItems: () => [],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));

vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: vi.fn(),
}));

vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/timeline/ui/cards/EventTimelineCard', () => ({
  EventTimelineCard: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { TargetGroupEventSelector } from '../TargetGroupEventSelector';

describe('TargetGroupEventSelector A04 priority branch', () => {
  afterEach(() => {
    cleanup();
    onViewProps.mockClear();
  });

  it('clears a controlled workflow once its source group makes it unreachable', async () => {
    const onSelect = vi.fn();
    const onWorkflowSelectionChange = vi.fn();

    render(
      <TargetGroupEventSelector
        userId="user-1"
        onSelect={onSelect}
        selectedSourceGroupId="source"
        selectedPathMode="workflow"
        selectedWorkflowId="unreachable-workflow"
        onWorkflowSelectionChange={onWorkflowSelectionChange}
      />
    );

    await waitFor(() => expect(onWorkflowSelectionChange).toHaveBeenCalledWith(null));
    expect(onSelect).toHaveBeenCalledWith(null);
    await waitFor(() =>
      expect(onViewProps.mock.calls.at(-1)?.[0]).toMatchObject({
        selectedWorkflowIdState: '',
      })
    );
  });
});
