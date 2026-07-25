export const changeRequestsTranslations = {
  title: 'Änderungsanträge',
  obsolete: {
    badge: 'Obsolet',
    title: 'Obsolete Änderungsanträge',
    description:
      'Diese Änderungsanträge wurden automatisch geschlossen, weil ihre Vorschläge nicht mehr im Volltext vorhanden sind.',
    closedAt: 'Geschlossen am',
    reasons: {
      suggestionRemovedInCollaborativeEditing:
        'Der letzte Vorschlagsmarker wurde beim kollaborativen Bearbeiten entfernt.',
    },
  },
} as const;
