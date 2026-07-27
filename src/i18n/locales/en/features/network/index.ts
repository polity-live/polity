export const networkTranslations = {
  title: 'Network',
  tabs: {
    currentNetwork: 'Current Network',
    manageNetwork: 'Manage Network',
  },
  workflows: {
    acceptedPending: 'Accepted, waiting for others',
    acceptedPendingDescription:
      'Workflow requests this group accepted that still need confirmations from other groups.',
    stepLabel: 'Step {{number}}',
    stepTransition: 'Step {{from}} → {{to}}',
    filters: {
      active: 'Active',
      allStatuses: 'All statuses',
      archived: 'Archived',
      clearSearch: 'Clear search',
      emptyDescription: 'No workflows match the selected status or group search.',
      emptyTitle: 'No matching workflows',
      groupSearchPlaceholder: 'Search involved groups...',
      pendingApproval: 'Pending approval',
      rejected: 'Rejected',
    },
  },
  membershipModes: {
    all_members: 'All active members',
    role_members: 'Members with selected role',
    selected_source_groups: 'Parliament membership',
    none: 'No automatic membership',
  },
  amendmentPath: {
    eventScheduled: 'Event scheduled',
    eventRequestedPending: 'Event requested, pending',
    eventPending: 'Event pending',
  },
} as const;
