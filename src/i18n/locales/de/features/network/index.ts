export const networkTranslations = {
  title: 'Netzwerk',
  tabs: {
    currentNetwork: 'Aktuelles Netzwerk',
    manageNetwork: 'Netzwerk verwalten',
  },
  workflows: {
    acceptedPending: 'Akzeptiert, wartet auf andere',
    acceptedPendingDescription:
      'Workflow-Anfragen, die diese Gruppe akzeptiert hat und die noch Bestätigungen anderer Gruppen brauchen.',
    stepLabel: 'Schritt {{number}}',
    stepTransition: 'Schritt {{from}} → {{to}}',
    filters: {
      active: 'Aktiv',
      allStatuses: 'Alle Status',
      archived: 'Archiviert',
      clearSearch: 'Suche löschen',
      emptyDescription: 'Keine Workflows passen zum gewählten Status oder zur Gruppensuche.',
      emptyTitle: 'Keine passenden Workflows',
      groupSearchPlaceholder: 'Beteiligte Gruppen suchen...',
      pendingApproval: 'Wartet auf Bestätigung',
      rejected: 'Abgelehnt',
    },
  },
  membershipModes: {
    all_members: 'Alle aktiven Mitglieder',
    role_members: 'Mitglieder mit ausgewählter Rolle',
    selected_source_groups: 'Parlamentsmitgliedschaft',
    none: 'Keine automatische Mitgliedschaft',
  },
  amendmentPath: {
    eventScheduled: 'Event geplant',
    eventRequestedPending: 'Event angefragt, ausstehend',
    eventPending: 'Event ausstehend',
  },
} as const;
