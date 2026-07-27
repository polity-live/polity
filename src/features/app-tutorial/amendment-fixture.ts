export interface AppTutorialPreparedTextChange {
  changeRequestId: string;
  suggestionId: string;
  userId: string;
  title: string;
  description: string;
  newText: string;
}

export const APP_TUTORIAL_AMENDMENT_TITLE =
  'Klimafitte Euckenstraße: geschützter Radweg und Baumreihe';
export const APP_TUTORIAL_FIRST_EVENT_TITLE = 'Werkstatt Klimafitte Euckenstraße';
export const APP_TUTORIAL_AMENDMENT_AGENDA_TITLE = 'Klimafitte Euckenstraße beschließen';

export const APP_TUTORIAL_ELECTION_COPY = {
  de: {
    agendaTitle: 'Wahl zum Kreisvorsitzenden',
    agendaDescription: 'Die Initiative wählt eine Person für den Kreisvorsitz.',
    electionTitle: 'Kreisvorsitzende:r',
    electionDescription: 'Wahl zum Kreisvorsitz innerhalb der Initiative Klimafitte Euckenstraße.',
  },
  en: {
    agendaTitle: 'Election of the District Chair',
    agendaDescription: 'The initiative elects a person as district chair.',
    electionTitle: 'District Chair',
    electionDescription:
      'Election of the district chair within the Climate-Friendly Euckenstraße initiative.',
  },
} as const;

export type AppTutorialElectionLanguage = keyof typeof APP_TUTORIAL_ELECTION_COPY;

export function getAppTutorialElectionCopy(language: string | undefined) {
  return APP_TUTORIAL_ELECTION_COPY[language === 'en' ? 'en' : 'de'];
}

export const APP_TUTORIAL_ELECTION_AGENDA_TITLE = APP_TUTORIAL_ELECTION_COPY.de.agendaTitle;
export const APP_TUTORIAL_ELECTION_AGENDA_DESCRIPTION =
  APP_TUTORIAL_ELECTION_COPY.de.agendaDescription;
export const APP_TUTORIAL_ELECTION_TITLE = APP_TUTORIAL_ELECTION_COPY.de.electionTitle;
export const APP_TUTORIAL_ELECTION_DESCRIPTION = APP_TUTORIAL_ELECTION_COPY.de.electionDescription;

export const APP_TUTORIAL_PREPARED_TEXT_CHANGES = [
  {
    title: 'Baumstandorte klimaresilient planen',
    description: 'Die Baumarten und Standorte werden an Hitze und Starkregen angepasst.',
    newText: 'Die Baumreihe verwendet klimaresiliente Arten mit großzügigen Baumgruben.',
  },
  {
    title: 'Lieferzonen zeitlich sichern',
    description: 'Zeitfenster vermeiden Konflikte zwischen Lieferverkehr und Radweg.',
    newText: 'Lieferzonen werden morgens zeitlich begrenzt und niveaugleich integriert.',
  },
] as const;

export function createAppTutorialAmendmentTextFixture({
  baseText,
  closingText,
  changes,
  createdAt = Date.now(),
}: {
  baseText: string;
  closingText?: string;
  changes: readonly AppTutorialPreparedTextChange[];
  createdAt?: number;
}) {
  const documentContent = [
    { type: 'p', children: [{ text: baseText }] },
    ...changes.map(change => ({
      type: 'p',
      children: [
        {
          text: change.newText,
          suggestion: true,
          [`suggestion_${change.suggestionId}`]: {
            id: change.suggestionId,
            type: 'insert',
            userId: change.userId,
            createdAt,
          },
        },
      ],
    })),
    ...(closingText ? [{ type: 'p', children: [{ text: closingText }] }] : []),
  ];

  const discussions = changes.map((change, index) => ({
    id: change.suggestionId,
    comments: [],
    createdAt,
    isResolved: false,
    userId: change.userId,
    crId: `CR-${index + 1}`,
    displayCrId: `CR-${index + 1}`,
    title: change.title,
    description: change.description,
    changeRequestEntityId: change.changeRequestId,
    changeRequestStatus: 'open',
    confirmationStatus: 'confirmed',
    status: 'open',
  }));

  return { documentContent, discussions };
}
