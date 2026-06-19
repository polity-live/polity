export type VoteChoiceTranslator = (key: string, fallback?: string) => string;

type CanonicalVoteChoice = 'yes' | 'no' | 'abstain';

const CHOICE_LABELS: Record<
  string,
  {
    canonical: CanonicalVoteChoice;
    key: string;
    fallback: string;
  }
> = {
  accept: {
    canonical: 'yes',
    key: 'features.events.agenda.defaultChoiceLabels.yes',
    fallback: 'Yes',
  },
  approve: {
    canonical: 'yes',
    key: 'features.events.agenda.defaultChoiceLabels.yes',
    fallback: 'Yes',
  },
  approved: {
    canonical: 'yes',
    key: 'features.events.agenda.defaultChoiceLabels.yes',
    fallback: 'Yes',
  },
  ja: {
    canonical: 'yes',
    key: 'features.events.agenda.defaultChoiceLabels.yes',
    fallback: 'Yes',
  },
  support: {
    canonical: 'yes',
    key: 'features.events.agenda.defaultChoiceLabels.yes',
    fallback: 'Yes',
  },
  yes: {
    canonical: 'yes',
    key: 'features.events.agenda.defaultChoiceLabels.yes',
    fallback: 'Yes',
  },
  nein: {
    canonical: 'no',
    key: 'features.events.agenda.defaultChoiceLabels.no',
    fallback: 'No',
  },
  no: {
    canonical: 'no',
    key: 'features.events.agenda.defaultChoiceLabels.no',
    fallback: 'No',
  },
  oppose: {
    canonical: 'no',
    key: 'features.events.agenda.defaultChoiceLabels.no',
    fallback: 'No',
  },
  reject: {
    canonical: 'no',
    key: 'features.events.agenda.defaultChoiceLabels.no',
    fallback: 'No',
  },
  rejected: {
    canonical: 'no',
    key: 'features.events.agenda.defaultChoiceLabels.no',
    fallback: 'No',
  },
  abstain: {
    canonical: 'abstain',
    key: 'features.events.agenda.defaultChoiceLabels.abstain',
    fallback: 'Abstain',
  },
  abstention: {
    canonical: 'abstain',
    key: 'features.events.agenda.defaultChoiceLabels.abstain',
    fallback: 'Abstain',
  },
  enthalten: {
    canonical: 'abstain',
    key: 'features.events.agenda.defaultChoiceLabels.abstain',
    fallback: 'Abstain',
  },
  enthaltung: {
    canonical: 'abstain',
    key: 'features.events.agenda.defaultChoiceLabels.abstain',
    fallback: 'Abstain',
  },
};

export function getCanonicalVoteChoice(label: string | null | undefined) {
  const rawLabel = label?.trim().toLowerCase();
  return rawLabel ? CHOICE_LABELS[rawLabel]?.canonical : undefined;
}

export function getLocalizedVoteChoiceLabel(
  label: string | null | undefined,
  translate: VoteChoiceTranslator,
  fallback?: string
) {
  const rawLabel = label?.trim();

  if (!rawLabel) {
    return fallback ?? translate('features.events.agenda.defaultChoiceLabels.choice', 'Choice');
  }

  const configuredLabel = CHOICE_LABELS[rawLabel.toLowerCase()];

  if (configuredLabel) {
    return translate(configuredLabel.key, configuredLabel.fallback);
  }

  return rawLabel;
}
