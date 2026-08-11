/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpenAssignmentsPanelView } from '../OpenAssignmentsPanelView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/timeline/ui/LazyCardComponents', () => ({
  DynamicTimelineCard: () => <article data-testid="event-card" />,
}));

afterEach(cleanup);

describe('OpenAssignmentsPanelView actions', () => {
  it('cancels and creates assignment elections through stable dialog actions', () => {
    const closeEventDialog = vi.fn();
    const handleCreateAssignmentElection = vi.fn();
    render(
      <OpenAssignmentsPanelView
        groupId="group-1"
        groupName="Assembly"
        assignments={[{ id: 'assignment-1' }]}
        availableEvents={[]}
        isLoading={false}
        isScheduling={false}
        onScheduleRoleRenewal={vi.fn()}
        onScheduleDelegateElection={vi.fn()}
        onScheduleProcessTask={vi.fn()}
        t={(key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key}
        i18n={{ language: 'en' }}
        selectedEventIds={{}}
        setSelectedEventIds={vi.fn()}
        eventDialogAssignmentId="assignment-1"
        setEventDialogAssignmentId={vi.fn()}
        eventDialogEventId="event-1"
        setEventDialogEventId={vi.fn()}
        eventDialogSearchQuery=""
        setEventDialogSearchQuery={vi.fn()}
        eventDialogCorrelationId="correlation-1"
        setEventDialogCorrelationId={vi.fn()}
        agendaPreviewAssignmentId={null}
        setAgendaPreviewAssignmentId={vi.fn()}
        filteredAssignmentsWithProgress={[]}
        assignmentFilters={null}
        activeEventAssignment={{
          id: 'assignment-1',
          kind: 'role_renewal',
          description: 'Renew the chair role',
        }}
        activeAgendaPreviewAssignment={null}
        filteredEventDialogEvents={[]}
        openEventDialog={vi.fn()}
        closeEventDialog={closeEventDialog}
        handleCreateAssignmentElection={handleCreateAssignmentElection}
        isAmendmentProcessAssignment={vi.fn()}
        assignmentColumns={[]}
      />
    );

    const cancel = document.querySelector<HTMLElement>(
      '[data-action-id="groups.assignments.event-dialog.cancel"]'
    )!;
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(cancel);
    fireEvent.click(
      document.querySelector('[data-action-id="groups.assignments.event-dialog.create-election"]')!
    );
    expect(closeEventDialog).toHaveBeenCalledWith(false);
    expect(handleCreateAssignmentElection).toHaveBeenCalledTimes(1);
  });
});
