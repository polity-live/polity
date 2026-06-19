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
} as const;
