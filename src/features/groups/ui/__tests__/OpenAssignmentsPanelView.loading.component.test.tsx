/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpenAssignmentsPanelView } from '../OpenAssignmentsPanelView';

const labels: Record<string, string> = {
  'features.groups.memberships.openAssignments.title': 'Open assignments',
  'features.groups.memberships.openAssignments.loadingDescription': 'Loading assignments',
};

afterEach(() => {
  cleanup();
});

describe('OpenAssignmentsPanelView loading state', () => {
  it('renders section skeleton rows instead of loading description text', () => {
    render(
      <OpenAssignmentsPanelView
        {...({
          groupName: 'Group',
          assignments: [],
          isLoading: true,
          isScheduling: false,
          t: (key: string) => labels[key] ?? key,
          filteredAssignmentsWithProgress: [],
          assignmentFilters: [],
          filteredEventDialogEvents: [],
          closeEventDialog: vi.fn(),
          handleCreateAssignmentElection: vi.fn(),
          assignmentColumns: [],
        } as any)}
      />
    );

    expect(screen.getByText('Open assignments')).toBeTruthy();
    expect(document.querySelector('[data-slot="section-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('Loading assignments')).toBeNull();
  });
});
