/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathProps: undefined as any }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/features/shared/global-state/language.store', () => ({
  useLanguageStore: { getState: () => ({ language: 'en' }) },
}));
vi.mock('@/features/app-tutorial/events', () => ({
  isAppTutorialActiveInDocument: () => false,
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: () => null,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  getAmendmentProcessInfoBadgeClassName: () => '',
  getAmendmentProcessStatusBadgeClassName: () => '',
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));
vi.mock('@/features/shared/ui/navigation/ScrollableTabs', () => ({
  ScrollableTabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/amendments/ui/AmendmentBranchSelectorSection', () => ({
  AmendmentBranchSelectorSection: () => null,
}));
vi.mock('@/features/network/ui/AmendmentPathVisualization', () => ({
  AmendmentPathVisualization: (props: any) => {
    mocks.pathProps = props;
    return <div data-testid="path" />;
  },
}));
vi.mock('@/features/amendments/ui/TargetGroupEventSelector', () => ({
  TargetGroupEventDisplay: () => null,
  TargetGroupEventSelector: () => null,
}));
vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: () => null,
}));
vi.mock('@/features/shared/ui/typeahead/toTypeaheadItems', () => ({
  toTypeaheadItems: () => [],
}));
vi.mock('@/features/shared/logic/richText', () => ({ richTextToPlainText: () => '' }));
vi.mock('@/features/groups/logic/groupAmendmentStatus', () => ({
  normalizeGroupAmendmentDisplayStatus: () => null,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { AmendmentProcessFlowView } from '../AmendmentProcessFlowView';

afterEach(cleanup);

describe('AmendmentProcessFlowView LSF navigation adapters', () => {
  it('routes group and event visualization selections', () => {
    const navigate = vi.fn();
    render(
      <AmendmentProcessFlowView
        {...({
          amendmentId: 'amendment-1',
          t: (key: string) => key,
          navigate,
          user: null,
          canManageProcess: false,
          selectorOpen: false,
          setSelectorOpen: vi.fn(),
          pendingSelection: null,
          setPendingSelection: vi.fn(),
          isSaving: false,
          setIsSaving: vi.fn(),
          processSubmission: { isActive: false },
          amendment: { id: 'amendment-1', title: 'Amendment' },
          collaborators: [],
          isLoading: false,
          currentRun: {
            id: 'run-1',
            status: 'scheduled',
            selected_target_group: null,
            selected_target_workflow: null,
          },
          allRuns: [],
          historicalRuns: [],
          branches: [],
          currentRunStepRuns: [],
          displayPath: null,
          displayPathSegments: [],
          displayPathSegmentByStepRunId: new Map(),
          displayPathSegmentByOrder: new Map(),
          currentRunDisplayStepRuns: [],
          derivedActiveStepRun: null,
          resolvedActiveBranchId: 'branch-1',
          selectedBranchId: 'branch-1',
          activeBranch: { id: 'branch-1', title: 'Branch', change_requests: [] },
          activeBranchStepRuns: [],
          firstUnresolvedStepId: null,
          openTasks: [],
          groupDecisions: [],
          groupTypeById: new Map(),
          pathVisualizationData: [],
          branchDiffCandidates: [],
          defaultBranchDiffRightCandidateId: null,
          onBranchChange: vi.fn(),
          selectorCollaborators: [],
          existingBranchStartGroupIds: [],
          currentRunPathMode: 'hierarchy',
          eventEditorBranch: null,
          branchEventEditorRows: [],
          eventDraftsByStepRunId: {},
          isReplanningBranchEvents: false,
          openBranchEventEditor: vi.fn(),
          closeBranchEventEditor: vi.fn(),
          updateBranchEventDraft: vi.fn(),
          saveBranchEventReplan: vi.fn(),
          handleConfirmSelection: vi.fn(),
        } as any)}
      />
    );

    mocks.pathProps.onGroupClick('group-1');
    mocks.pathProps.onNodeClick('event-1');

    expect(navigate).toHaveBeenNthCalledWith(1, {
      to: '/group/$id',
      params: { id: 'group-1' },
    });
    expect(navigate).toHaveBeenNthCalledWith(2, {
      to: '/event/$id/agenda',
      params: { id: 'event-1' },
    });
  });
});
