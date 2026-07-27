export const electionsTranslations = {
  title: 'Wahlen',
  mode: {
    typeLabel: 'Wahltyp',
    list: 'Listenwahl',
    single: 'Einzelwahl',
    position: 'Position',
    positions: 'Positionen',
    summary: '{{mode}} · {{seatCount}} {{seatLabel}}',
  },
  delegate: {
    assemblyFallback: 'Delegiertenversammlung',
    sourceGroupFallback: 'dieser Gruppe',
    targetGroupFallback: 'der Zielgruppe',
    agendaListTitle: 'Delegiertenwahl: {{event}}',
    agendaSingleTitle: 'Delegiertenwahl, Sitz {{seat}}: {{event}}',
    agendaListDescription: 'Listenwahl für {{count}} Delegiertensitze.',
    agendaListDescription_one: 'Listenwahl für {{count}} Delegiertensitz.',
    agendaListDescription_other: 'Listenwahl für {{count}} Delegiertensitze.',
    agendaSingleDescription: 'Einzelwahl für Delegiertensitz {{seat}} von {{total}}.',
    recordListTitle: 'Delegiertenwahl für {{event}}',
    recordSingleTitle: 'Delegiertensitz {{seat}} für {{event}}',
    recordSummary: 'Wählt die Delegierten von {{sourceGroup}} für {{event}}.',
    seatRoleName: 'Delegierte Person für {{event}} — Sitz {{seat}}',
    seatRoleDescription:
      'Temporäres Delegiertenmandat von {{sourceGroup}} für {{targetGroup}} bei {{event}} (Sitz {{seat}} von {{total}}).',
  },
} as const;
