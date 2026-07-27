export const votesTranslations = {
  title: 'Abstimmungen',
  toasts: {
    votingCompleted: 'Abstimmung abgeschlossen: {{result}}',
  },
  scheduling: {
    overdueSince: 'Überfällig seit {{date}}',
    nextRevote: 'Nächste Neuwahl am {{date}}',
  },
  resultSentence: {
    electionTieForRole: 'Die Wahl für {{role}} endete mit einem Stimmengleichstand.',
    electionTie: 'Die Wahl endete mit einem Stimmengleichstand.',
    noWinnerForRole: 'Bei der Wahl für {{role}} wurde niemand gewählt.',
    noWinner: 'Bei der Wahl wurde niemand gewählt.',
    winnerForRoleWithShare:
      'Bei der Wahl für {{role}} gewann {{winner}} mit {{share}} % der Stimmen.',
    winnerForRole: 'Bei der Wahl für {{role}} gewann {{winner}}.',
    winnerWithShare: '{{winner}} gewann die Wahl mit {{share}} % der Stimmen.',
    winner: '{{winner}} gewann die Wahl.',
    voteTie: 'Die Abstimmung endete mit einem Stimmengleichstand.',
    motionAcceptedWithShare: 'Der Antrag wurde mit {{share}} % der Stimmen angenommen.',
    motionAccepted: 'Der Antrag wurde angenommen.',
    motionRejectedWithShare: 'Der Antrag wurde mit {{share}} % der Stimmen abgelehnt.',
    motionRejected: 'Der Antrag wurde abgelehnt.',
  },
} as const;
