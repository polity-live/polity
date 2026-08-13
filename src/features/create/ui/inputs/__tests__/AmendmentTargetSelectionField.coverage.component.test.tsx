/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ selector: undefined as Record<string, any> | undefined }));

vi.mock('@/features/shared/ui/form', () => ({
  SummaryPillList: ({ items }: { items: string[] }) => <div>{items.join(',')}</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  SectionSkeleton: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock('@/features/amendments/ui/TargetGroupEventSelector', () => ({
  TargetGroupEventSelector: (props: Record<string, any>) => {
    captured.selector = props;
    return <div>selector</div>;
  },
  TargetGroupEventDisplay: () => <div>selection display</div>,
}));

import { AmendmentTargetSelectionField } from '../AmendmentTargetSelectionField';

afterEach(cleanup);

const baseProps = {
  hint: 'Choose target',
  loadingLabel: 'Loading target',
  sourceGroupIdParam: 'source-param',
  targetGroupIdParam: 'target-param',
  pathMode: 'hierarchy' as const,
  openEventStepsLabel: 'Open steps',
  missingEventStepsDescription: 'Events are needed',
  onSourceGroupSelectionChange: vi.fn(),
  onGroupSelectionChange: vi.fn(),
  onPathModeChange: vi.fn(),
  onWorkflowSelectionChange: vi.fn(),
  onSelect: vi.fn(),
};

describe('AmendmentTargetSelectionField branches', () => {
  it('shows loading without a user and omits an empty selection', () => {
    render(<AmendmentTargetSelectionField {...baseProps} targetSelection={null} />);
    expect(screen.getByText('Loading target')).toBeTruthy();
    expect(screen.queryByText('selection display')).toBeNull();
  });

  it('uses parameter fallbacks and omits empty optional ids', () => {
    render(
      <AmendmentTargetSelectionField
        {...baseProps}
        userId="user-1"
        workflowId=""
        targetSelection={null}
      />
    );
    expect(captured.selector).toMatchObject({
      selectedSourceGroupId: 'source-param',
      selectedGroupId: 'target-param',
      selectedEventId: undefined,
      selectedWorkflowId: undefined,
    });
  });

  it('uses selected ids and renders missing event steps', () => {
    render(
      <AmendmentTargetSelectionField
        {...baseProps}
        userId="user-1"
        workflowId="workflow-1"
        targetSelection={
          {
            sourceGroupId: 'source-selected',
            groupId: 'target-selected',
            groupData: { id: 'target-selected', name: 'Target' },
            eventId: 'event-1',
            eventData: { id: 'event-1', title: 'Assembly' },
            pathWithEvents: [],
            missingEventSteps: [{ groupName: 'Intermediate' }],
          } as any
        }
      />
    );
    expect(captured.selector).toMatchObject({
      selectedSourceGroupId: 'source-selected',
      selectedGroupId: 'target-selected',
      selectedEventId: 'event-1',
      selectedWorkflowId: 'workflow-1',
    });
    expect(screen.getByText('Intermediate')).toBeTruthy();
  });

  it('renders a target without missing event steps', () => {
    render(
      <AmendmentTargetSelectionField
        {...baseProps}
        userId="user-1"
        targetSelection={
          {
            sourceGroupId: 'source-selected',
            groupId: 'target-selected',
            groupData: { id: 'target-selected' },
            eventId: null,
            eventData: null,
            pathWithEvents: [],
            missingEventSteps: [],
          } as any
        }
      />
    );
    expect(screen.queryByText('Open steps')).toBeNull();
  });
});
