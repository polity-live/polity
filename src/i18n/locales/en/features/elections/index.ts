export const electionsTranslations = {
  title: 'Elections',
  mode: {
    typeLabel: 'Election type',
    list: 'List election',
    single: 'Single election',
    position: 'position',
    positions: 'positions',
    summary: '{{mode}} · {{seatCount}} {{seatLabel}}',
  },
  delegate: {
    assemblyFallback: 'delegate assembly',
    sourceGroupFallback: 'this group',
    targetGroupFallback: 'the target group',
    agendaListTitle: 'Delegate election: {{event}}',
    agendaSingleTitle: 'Delegate election, seat {{seat}}: {{event}}',
    agendaListDescription: 'List election for {{count}} delegate seats.',
    agendaListDescription_one: 'List election for {{count}} delegate seat.',
    agendaListDescription_other: 'List election for {{count}} delegate seats.',
    agendaSingleDescription: 'Single election for delegate seat {{seat}} of {{total}}.',
    recordListTitle: 'Delegate election for {{event}}',
    recordSingleTitle: 'Delegate seat {{seat}} for {{event}}',
    recordSummary: 'Elects the delegates from {{sourceGroup}} for {{event}}.',
    seatRoleName: 'Delegate for {{event}} — seat {{seat}}',
    seatRoleDescription:
      'Temporary delegate mandate from {{sourceGroup}} for {{targetGroup}} at {{event}} (seat {{seat}} of {{total}}).',
  },
} as const;
