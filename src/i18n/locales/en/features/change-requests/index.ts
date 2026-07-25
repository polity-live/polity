export const changeRequestsTranslations = {
  title: 'Change Requests',
  obsolete: {
    badge: 'Obsolete',
    title: 'Obsolete change requests',
    description:
      'These change requests were closed automatically because their suggestions no longer exist in the full text.',
    closedAt: 'Closed at',
    reasons: {
      suggestionRemovedInCollaborativeEditing:
        'The final suggestion marker was removed during collaborative editing.',
    },
  },
} as const;
