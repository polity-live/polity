/* @vitest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  childProps: [] as { name: string; props: Record<string, any> }[],
  subscribe: vi.fn(async () => undefined),
}));

function view(name: string) {
  return (props: Record<string, any>) => {
    mocks.childProps.push({ name, props });
    return <div data-testid={name}>{props.children}</div>;
  };
}

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));
vi.mock('@/features/shared/ui/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableCell: ({ children }: any) => <td>{children}</td>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/rich-text', () => ({
  MentionHashtagText: ({ text }: any) => <span>{text}</span>,
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: ({ onBack, onRetry }: any) => (
    <div>
      <button onClick={onBack}>overlay-back</button>
      <button onClick={onRetry}>overlay-retry</button>
    </div>
  ),
}));

vi.mock('@/features/agendas/hooks/useAccreditationSectionController', () => ({
  useAccreditationSectionController: () => ({ marker: 'accreditation' }),
}));
vi.mock('@/features/agendas/ui/AccreditationSectionView', () => ({
  AccreditationSectionView: view('accreditation'),
}));
vi.mock('@/features/agendas/ui/useAgendaSpeakerListSectionController', () => ({
  useAgendaSpeakerListSectionController: (props: unknown) => ({ marker: 'speakers', props }),
}));
vi.mock('@/features/agendas/ui/AgendaSpeakerListSectionView', () => ({
  AgendaSpeakerListSectionView: view('speakers'),
}));
vi.mock('@/features/agendas/hooks/useCreateAgendaItemFormController', () => ({
  useCreateAgendaItemFormController: () => ({ marker: 'create-agenda' }),
}));
vi.mock('@/features/agendas/ui/CreateAgendaItemFormView', () => ({
  CreateAgendaItemFormView: view('create-agenda'),
}));
vi.mock('@/features/agendas/hooks/useFixedAgendaToolbarController', () => ({
  useFixedAgendaToolbarController: () => ({ className: 'fixed' }),
}));
vi.mock('@/features/agendas/ui/FixedAgendaToolbarView', () => ({
  FixedAgendaToolbarView: view('fixed-toolbar'),
}));
vi.mock('@/features/agendas/hooks/useOfflineTallyDialogController', () => ({
  useOfflineTallyDialogController: () => ({ isOverLimit: false, totalVotes: 2 }),
}));
vi.mock('@/features/agendas/hooks/useOfflineTallySubmissionProgress', () => ({
  useOfflineTallySubmissionProgress: () => [],
}));
vi.mock('@/features/agendas/ui/OfflineElectionTallyDialogView', () => ({
  OfflineElectionTallyDialogView: (props: any) => (
    <div>
      <button onClick={() => props.onOpenChange(false)}>close-tally</button>
      <button onClick={props.onConfirmCounts}>confirm-counts</button>
      <button onClick={props.onBackToCounts}>back-counts</button>
    </div>
  ),
}));
vi.mock('@/features/agendas/hooks/useTransferAgendaItemDialogController', () => ({
  useTransferAgendaItemDialogController: () => ({ marker: 'transfer' }),
}));
vi.mock('@/features/agendas/ui/TransferAgendaItemDialogView', () => ({
  TransferAgendaItemDialogView: view('transfer'),
}));

vi.mock('@/features/blogs/hooks/useBlogEditorController', () => ({
  useBlogEditorController: () => ({ marker: 'blog-editor' }),
}));
vi.mock('@/features/blogs/ui/BlogEditorView', () => ({ BlogEditorView: view('blog-editor') }));
vi.mock('@/features/blogs/hooks/useBlogNotificationsController', () => ({
  useBlogNotificationsController: () => ({ entityName: 'Blog' }),
}));
vi.mock('@/features/blogs/ui/BlogNotificationsView', () => ({
  BlogNotificationsView: view('blog-notifications'),
}));
vi.mock('@/features/blogs/hooks/useSubscribeBlog', () => ({
  useSubscribeBlog: () => ({
    isSubscribed: false,
    toggleSubscribe: mocks.subscribe,
    isLoading: false,
  }),
}));
vi.mock('@/features/blogs/ui/BlogSubscribeButtonView', () => ({
  BlogSubscribeButtonView: (props: any) => <button onClick={props.handleClick}>subscribe</button>,
}));
vi.mock('@/features/blogs/ui/useCreateBlogFormController', () => ({
  useCreateBlogFormController: () => ({ marker: 'create-blog' }),
}));
vi.mock('@/features/blogs/ui/CreateBlogFormView', () => ({
  CreateBlogFormView: view('create-blog'),
}));
vi.mock('@/features/blogs/hooks/useBlogModeSelectorController', () => ({
  useBlogModeSelectorController: () => ({ handleModeChange: vi.fn() }),
}));
vi.mock('@/features/blogs/ui/ModeSelectorView', () => ({ ModeSelectorView: view('mode') }));
vi.mock('@/features/editor/ui/VersionControl', () => ({
  VersionControl: view('version-control'),
}));

vi.mock('@/features/change-requests/ui/useChangeRequestsPageContainerController', () => ({
  useChangeRequestsPageContainerController: () => ({ marker: 'change-requests' }),
}));
vi.mock('@/features/change-requests/ui/ChangeRequestsPageContainerView', () => ({
  ChangeRequestsPageContainerView: view('change-requests'),
}));
vi.mock('@/features/change-requests/hooks/useCREditorPreviewModel', () => ({
  useCREditorPreviewModel: () => ({
    editor: {},
    isInteractive: true,
    isOpen: true,
    onOpenChange: vi.fn(),
  }),
}));
vi.mock('@/features/change-requests/ui/CREditorPreviewView', () => ({
  CREditorPreviewView: view('cr-preview'),
}));
vi.mock('@/features/change-requests/hooks/useEditorViewModeToggleController', () => ({
  useEditorViewModeToggleController: () => ({ marker: 'mode-toggle' }),
}));
vi.mock('@/features/change-requests/ui/EditorViewModeToggleView', () => ({
  EditorViewModeToggleView: view('mode-toggle'),
}));
vi.mock('@/features/decision-terminal/ui/useDecisionRowController', () => ({
  useDecisionRowController: () => ({ marker: 'decision-row' }),
}));
vi.mock('@/features/decision-terminal/ui/DecisionRowView', () => ({
  DecisionRowView: view('decision-row'),
}));

import { useElectionDetailsSectionController } from '../hooks/useElectionDetailsSectionController';
import { AccreditationSection } from '../ui/AccreditationSection';
import { AgendaSpeakerListSection } from '../ui/AgendaSpeakerListSection';
import { CreateAgendaItemForm } from '../ui/CreateAgendaItemForm';
import { FixedAgendaToolbar } from '../ui/FixedAgendaToolbar';
import { OfflineElectionTallyDialog } from '../ui/OfflineElectionTallyDialog';
import { TimelineItem } from '../ui/TimelineItem';
import { TransferAgendaItemDialog } from '../ui/TransferAgendaItemDialog';
import { BlogEditor } from '../../blogs/ui/BlogEditor';
import { BlogNotifications } from '../../blogs/ui/BlogNotifications';
import { BlogSubscribeButton } from '../../blogs/ui/BlogSubscribeButton';
import { CreateBlogForm } from '../../blogs/ui/CreateBlogForm';
import { ModeSelector } from '../../blogs/ui/ModeSelector';
import { VersionControl } from '../../blogs/ui/VersionControl';
import { ChangeRequestsPageContainer } from '../../change-requests/ui/ChangeRequestsPageContainer';
import { CREditorPreview } from '../../change-requests/ui/CREditorPreview';
import { EditorViewModeToggle } from '../../change-requests/ui/EditorViewModeToggle';
import { ManualChartTableEditorView } from '../../charts/ui/ManualChartTableEditorView';
import { useDecisionDashboardGridController } from '../../decision-terminal/hooks/useDecisionDashboardGridController';
import { isIndicativeDecisionStatus } from '../../decision-terminal/logic/decision-phase';
import { DecisionRow } from '../../decision-terminal/ui/DecisionRow';
import { DecisionTable } from '../../decision-terminal/ui/DecisionTable';
import { MeetingDetails } from '../../meet/ui/MeetingDetails';
import { StatementTextRenderer } from '../../statements/ui/StatementTextRenderer';

afterEach(cleanup);

describe('A10 feature facade LSF contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.childProps.length = 0;
  });

  it('executes stateful agenda and blog wrappers', async () => {
    const election = renderHook(() => useElectionDetailsSectionController());
    act(() => election.result.current.onOpenChange(true));
    expect(election.result.current.open).toBe(true);

    const subscribeChange = vi.fn();
    render(
      <>
        <AccreditationSection eventId="event" agendaItemId="agenda" />
        <AgendaSpeakerListSection
          speakers={[]}
          isUserInSpeakerList={false}
          canManageSpeakers
          isAddingSpeaker={false}
        />
        <CreateAgendaItemForm />
        <FixedAgendaToolbar>toolbar</FixedAgendaToolbar>
        <TimelineItem order={1} startTime="10:00" endTime="11:00" duration={60}>
          timeline
        </TimelineItem>
        <TransferAgendaItemDialog
          agendaItemId="agenda"
          agendaItemTitle="Agenda"
          currentEventId="event"
          currentEventTitle="Event"
        />
        <BlogEditor blogId="blog" />
        <BlogNotifications blogId="blog" />
        <BlogSubscribeButton blogId="blog" onSubscribeChange={subscribeChange} />
        <CreateBlogForm />
        <ModeSelector blogId="blog" currentMode="view" isOwnerOrCollaborator />
        <VersionControl
          blogId="blog"
          currentContent={[]}
          currentUserId="user"
          onRestoreVersion={vi.fn()}
        />
      </>
    );
    fireEvent.click(screen.getByText('subscribe'));
    await vi.waitFor(() => expect(subscribeChange).toHaveBeenCalledWith(true));
    expect(mocks.subscribe).toHaveBeenCalledOnce();
  });

  it('executes change-request, decision, meeting, and statement wrappers', () => {
    const decision = { id: 'decision', title: 'Decision' } as never;
    render(
      <>
        <ChangeRequestsPageContainer amendmentId="amendment" />
        <CREditorPreview documentContent={[]} suggestionIds={new Set()} />
        <EditorViewModeToggle
          mode="all"
          onModeChange={vi.fn()}
          selectedCRId={null}
          onSelectedCRChange={vi.fn()}
          changeRequests={[]}
        />
        <DecisionRow decision={decision} />
        <DecisionTable decisions={[decision]} />
        <MeetingDetails
          startTime="2026-08-10T10:00:00Z"
          endTime="2026-08-10T11:00:00Z"
          meetingType="online"
          isAvailable
          isPast={false}
        />
        <StatementTextRenderer text="statement" />
      </>
    );
    expect(screen.getAllByTestId('decision-row')).toHaveLength(2);
    expect(screen.getByText('statement')).toBeTruthy();
    expect(isIndicativeDecisionStatus('draft')).toBe(true);
  });

  it('executes offline tally noop callbacks and step transitions', () => {
    const openChange = vi.fn();
    render(
      <OfflineElectionTallyDialog
        open
        onOpenChange={openChange}
        title="Tally"
        description="Description"
        phase="final"
        candidates={[]}
        tallies={[]}
        onSubmit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('confirm-counts'));
    fireEvent.click(screen.getByText('back-counts'));
    fireEvent.click(screen.getByText('close-tally'));
    fireEvent.click(screen.getByText('overlay-back'));
    fireEvent.click(screen.getByText('overlay-retry'));
    expect(openChange).toHaveBeenCalledWith(false);
  });

  it('executes chart cell, column, and pagination callbacks', () => {
    const onChange = vi.fn();
    const renameColumn = vi.fn();
    const removeColumn = vi.fn();
    const removeRow = vi.fn();
    const setPage = vi.fn((update: React.SetStateAction<number>) =>
      typeof update === 'function' ? update(1) : update
    );
    render(
      <ManualChartTableEditorView
        table={{ columns: ['A', 'Column 3'], rows: [{ A: '1', 'Column 3': '2' }] }}
        onChange={onChange}
        t={(key: string) => key}
        page={1}
        setPage={setPage}
        pageCount={3}
        visibleRows={[{ A: '1', 'Column 3': '2' }]}
        renameColumn={renameColumn}
        removeColumn={removeColumn}
        removeRow={removeRow}
      />
    );
    fireEvent.blur(screen.getAllByRole('textbox')[0], { target: { value: 'Renamed' } });
    fireEvent.click(document.querySelector('[data-action-id="charts.manual-table.add-column"]')!);
    fireEvent.click(
      document.querySelector('[data-action-id="charts.manual-table.previous-page"]')!
    );
    fireEvent.click(document.querySelector('[data-action-id="charts.manual-table.next-page"]')!);
    expect(renameColumn).toHaveBeenCalledWith('A', 'Renamed');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ columns: ['A', 'Column 3', 'Column 4'] })
    );
    expect(setPage).toHaveBeenCalledTimes(2);
  });

  it('persists a decision layout after a breakpoint change', () => {
    const onConfigChange = vi.fn();
    const config = { layouts: { lg: [] } } as never;
    const hook = renderHook(() => useDecisionDashboardGridController({ config, onConfigChange }));
    act(() => hook.result.current.handleBreakpointChange('md'));
    act(() =>
      hook.result.current.persistActiveLayout([{ i: 'one', x: 0, y: 0, w: 1, h: 1 }] as never)
    );
    expect(onConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ layouts: expect.objectContaining({ md: expect.any(Array) }) })
    );
  });
});
