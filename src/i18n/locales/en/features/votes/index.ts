export const votesTranslations = {
  title: 'Votes',
  toasts: {
    votingCompleted: 'Voting completed: {{result}}',
  },
  scheduling: {
    overdueSince: 'Overdue since {{date}}',
    nextRevote: 'Next revote {{date}}',
  },
  resultSentence: {
    electionTieForRole: 'The election for {{role}} ended in a tie.',
    electionTie: 'The election ended in a tie.',
    noWinnerForRole: 'The election for {{role}} did not produce a winner.',
    noWinner: 'The election did not produce a winner.',
    winnerForRoleWithShare:
      'In the election for {{role}}, {{winner}} won with {{share}}% of the votes.',
    winnerForRole: 'In the election for {{role}}, {{winner}} won.',
    winnerWithShare: '{{winner}} won the election with {{share}}% of the votes.',
    winner: '{{winner}} won the election.',
    voteTie: 'The vote ended in a tie.',
    motionAcceptedWithShare: 'The motion was accepted with {{share}}% of the votes.',
    motionAccepted: 'The motion was accepted.',
    motionRejectedWithShare: 'The motion was rejected with {{share}}% of the votes.',
    motionRejected: 'The motion was rejected.',
  },
} as const;
