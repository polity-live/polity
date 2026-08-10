/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  controllerOptions: undefined as any,
  overlayProps: undefined as any,
  views: {} as Record<string, any>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input {...props} />,
  FormControlLabel: ({ children }: any) => <label>{children}</label>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: (props: any) => {
    mocks.overlayProps = props;
    return <div />;
  },
}));
vi.mock('../../hooks/useAddLinkDialogController', () => ({
  useAddLinkDialogController: (options: any) => {
    mocks.controllerOptions = options;
    return {
      actionSubmission: {
        isActive: false,
        status: 'idle',
        progressSteps: [],
        error: null,
        reset: vi.fn(),
        retry: vi.fn(),
      },
      label: '',
      url: '',
      onLabelChange: vi.fn(),
      onUrlChange: vi.fn(),
      onSubmit: vi.fn(),
    };
  },
}));

vi.mock('@/features/network/hooks/useEventNetworkFlowController', () => ({
  useEventNetworkFlowController: (props: any) => props,
}));
vi.mock('../../hooks/useGroupEventsListController', () => ({
  useGroupEventsListController: () => ({ eventsLoading: false, futureEvents: [], labels: {} }),
}));
vi.mock('../../hooks/useGroupNetworkFlowController', () => ({
  useGroupNetworkFlowController: (props: any) => props,
}));
vi.mock('../../hooks/useUserNetworkFlowController', () => ({
  useUserNetworkFlowController: (props: any) => props,
}));
vi.mock('../useHierarchyConflictDialogController', () => ({
  useHierarchyConflictDialogController: (props: any) => props,
}));
vi.mock('../useLinkGroupDialogController', () => ({
  useLinkGroupDialogController: (props: any) => props,
}));
vi.mock('../useRightsLabelEdgeController', () => ({
  useRightsLabelEdgeController: (props: any) => props,
}));
vi.mock('../useWorkflowFlowVisualizationController', () => ({
  useWorkflowFlowVisualizationController: (props: any) => props,
}));

vi.mock('../EventNetworkFlowView', () => ({
  EventNetworkFlowView: (props: any) => {
    mocks.views.event = props;
    return <div />;
  },
}));
vi.mock('../GroupEventsListView', () => ({
  GroupEventsListView: (props: any) => {
    mocks.views.events = props;
    return <div />;
  },
}));
vi.mock('../GroupNetworkFlowContentView', () => ({
  GroupNetworkFlowContentView: (props: any) => {
    mocks.views.group = props;
    return <div />;
  },
}));
vi.mock('../UserNetworkFlowContentView', () => ({
  UserNetworkFlowContentView: (props: any) => {
    mocks.views.user = props;
    return <div />;
  },
}));
vi.mock('../HierarchyConflictDialogView', () => ({
  HierarchyConflictDialogView: (props: any) => {
    mocks.views.conflict = props;
    return <div />;
  },
}));
vi.mock('../LinkGroupDialogView', () => ({
  LinkGroupDialogView: (props: any) => {
    mocks.views.link = props;
    return <div />;
  },
}));
vi.mock('../RightsLabelEdgeView', () => ({
  RightsLabelEdgeView: (props: any) => {
    mocks.views.edge = props;
    return <div />;
  },
}));
vi.mock('../WorkflowFlowVisualizationView', () => ({
  WorkflowFlowVisualizationView: (props: any) => {
    mocks.views.workflow = props;
    return <div />;
  },
}));

import { AddLinkDialog } from '../AddLinkDialog';
import { AddLinkDialogView } from '../AddLinkDialogView';
import { CurrentNetworkTab } from '../CurrentNetworkTab';
import { EventNetworkFlow } from '../EventNetworkFlow';
import { GroupEventsList } from '../GroupEventsList';
import { GroupNetworkFlow } from '../GroupNetworkFlow';
import { HierarchyConflictDialog } from '../HierarchyConflictDialog';
import { LinkGroupDialog } from '../LinkGroupDialog';
import { RightsLabelEdge } from '../RightsLabelEdge';
import { UserNetworkFlow } from '../UserNetworkFlow';
import { WorkflowFlowVisualization } from '../WorkflowFlowVisualization';

it('renders all network wrapper/controller boundaries', () => {
  const onOpenChange = vi.fn();
  render(<AddLinkDialog isOpen onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
  mocks.controllerOptions.onSuccess();
  expect(onOpenChange).toHaveBeenCalledWith(false);
  render(<CurrentNetworkTab groupId="group" />);
  render(<EventNetworkFlow {...({ eventId: 'event' } as any)} />);
  render(<GroupEventsList groupId="group" />);
  render(<GroupNetworkFlow groupId="group" />);
  render(
    <HierarchyConflictDialog
      open
      onOpenChange={vi.fn()}
      groupName="Group"
      otherGroupName="Other"
      relationships={[]}
      affectedUsers={[]}
      partnerUsers={[]}
      canAccept
      onAccept={vi.fn()}
      onReject={vi.fn()}
    />
  );
  render(<LinkGroupDialog currentGroupId="group" currentGroupName="Group" />);
  render(
    <RightsLabelEdge
      {...({
        id: 'edge',
        source: 'a',
        target: 'b',
        sourceX: 0,
        sourceY: 0,
        targetX: 1,
        targetY: 1,
      } as any)}
    />
  );
  render(<UserNetworkFlow {...({ userId: 'user' } as any)} />);
  render(<WorkflowFlowVisualization workflow={{ name: 'Flow', steps: [] }} />);
  expect(mocks.views.group.groupId).toBe('group');
  expect(mocks.views.workflow.workflow.name).toBe('Flow');
});

it('executes the add-link retry adapter', () => {
  const retry = vi.fn();
  render(
    <AddLinkDialogView
      actionSubmission={
        {
          isActive: true,
          status: 'error',
          progressSteps: [],
          error: null,
          reset: vi.fn(),
          retry,
        } as any
      }
      isOpen
      onOpenChange={vi.fn()}
      label="Docs"
      url="https://example.test"
      onLabelChange={vi.fn()}
      onUrlChange={vi.fn()}
      onSubmit={vi.fn()}
    />
  );
  mocks.overlayProps.onRetry();
  expect(retry).toHaveBeenCalled();
});
