/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ typeaheads: [] as any[] }));
vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: (props: any) => {
    mocks.typeaheads.push(props);
    return <div />;
  },
}));
vi.mock('@/features/network/ui/UserNetworkFlow', () => ({ UserNetworkFlow: () => <div /> }));
vi.mock('@/features/network/ui/GroupNetworkFlow', () => ({ GroupNetworkFlow: () => <div /> }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));

import { TargetGroupEventSelectorView } from '../TargetGroupEventSelectorView';

afterEach(() => {
  cleanup();
  mocks.typeaheads = [];
});

describe('TargetGroupEventSelectorView LSF path event callback', () => {
  it('forwards the selected event with its segment key', () => {
    const onPathSegmentEventChange = vi.fn();
    const source = { id: 'source', name: 'Source', description: null };
    const event = { id: 'event-1', title: 'Assembly', start_date: 1_800_000_000_000 };
    render(
      <TargetGroupEventSelectorView
        {...({
          activeSourceGroups: [source],
          allWorkflows: [],
          availableHierarchyPaths: [],
          availableTargetGroups: [source],
          collaborators: [],
          disablePortal: true,
          getUpcomingEventsForGroup: () => [event],
          handleSourceGroupSelection: vi.fn(),
          handleStartGraphGroupClick: vi.fn(),
          handleTargetGraphGroupClick: vi.fn(),
          layoutScope: 'test',
          networkGroups: [source],
          onHierarchyPathValueChange: vi.fn(),
          onPathModeValueChange: vi.fn(),
          onPathSegmentEventChange,
          onSelectedUserChange: vi.fn(),
          onTargetEventChange: vi.fn(),
          onTargetGroupChange: vi.fn(),
          onWorkflowItemChange: vi.fn(),
          pathMode: 'hierarchy',
          pathValidationError: null,
          pathWithEvents: [{ segmentKey: 'segment-1', groupId: 'source', groupName: 'Source' }],
          reachableWorkflows: [],
          selectedGroup: { id: 'source', data: source },
          selectedHierarchyPathId: '',
          selectedEvent: null,
          selectedSourceGroup: { id: 'source', data: source },
          selectedUserId: '',
          selectedWorkflowFinalGroup: null,
          selectedWorkflow: null,
          selectedWorkflowIdState: '',
          selectedWorkflowStartGroup: null,
          targetEventItems: [],
          targetPathSegment: null,
          upcomingEvents: [event],
        } as any)}
      />
    );
    const segmentSearch = mocks.typeaheads.find(props =>
      props.items?.some((item: any) => item.id === 'event-1')
    );
    expect(segmentSearch).toBeTruthy();
    segmentSearch.onChange({ id: 'event-1' });
    expect(onPathSegmentEventChange).toHaveBeenCalledWith('segment-1', { id: 'event-1' });
  });
});
