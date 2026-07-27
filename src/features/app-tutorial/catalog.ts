import { APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION } from './events';

export const APP_TUTORIAL_FIXTURE_VERSION = 6;

export const APP_TUTORIAL_NETWORK_RIGHT_DIRECTIONS = {
  outgoing: 'current_grants_right_to_partner',
  incoming: 'partner_grants_right_to_current',
} as const;

export type AppTutorialLanguage = 'de' | 'en';

export const APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE = {
  de: {
    groupSearch: 'Initiative Klimafitte Euckenstraße',
    networkGroupSearch: 'Münchner Klimarat',
    cityDesignStreet: 'Euckenstraße',
    cityDesignHouseNumber: '38',
    networkRightsOutgoing: 'informationRight amendmentRight current_grants_right_to_partner',
    networkRightsIncoming: 'informationRight amendmentRight current_has_right_in_partner',
    amendmentAddition:
      'Zusätzliche entsiegelte Flächen verbessern die Versickerung bei Starkregen.',
    changeRequestText: 'Am Knotenpunkt wird eine barrierefreie, schattige Querung ergänzt.',
    assistantTodo: 'Erstelle mir die Aufgabe „Die Welt zu einem besseren Ort machen“.',
    votingPassword: '1234',
  },
  en: {
    groupSearch: 'Climate-Friendly Euckenstraße Initiative',
    networkGroupSearch: 'Munich Climate Council',
    cityDesignStreet: 'Euckenstraße',
    cityDesignHouseNumber: '38',
    networkRightsOutgoing: 'informationRight amendmentRight current_grants_right_to_partner',
    networkRightsIncoming: 'informationRight amendmentRight current_has_right_in_partner',
    amendmentAddition: 'Additional unsealed areas improve infiltration during heavy rainfall.',
    changeRequestText: 'An accessible, shaded crossing is added at the intersection.',
    assistantTodo: 'Create the task “Make the world a better place” for me.',
    votingPassword: '1234',
  },
} as const;

// Compatibility alias for persisted German fixtures and existing server-side checks.
export const APP_TUTORIAL_EXPECTED_INPUTS = APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.de;

export type AppTutorialExpectedInputKey = keyof typeof APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.de;

export function getAppTutorialExpectedInputs(language: AppTutorialLanguage) {
  return APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE[language];
}

export function getAppTutorialExpectedInput(
  key: AppTutorialExpectedInputKey,
  language: AppTutorialLanguage
): string {
  return APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE[language][key];
}

export function getAppTutorialExpectedInputVariants(
  key: AppTutorialExpectedInputKey
): readonly string[] {
  return Array.from(
    new Set([
      APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.de[key],
      APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.en[key],
    ])
  );
}

export function getAppTutorialExpectedInputKey(value: string): AppTutorialExpectedInputKey | null {
  const keys = Object.keys(
    APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.de
  ) as AppTutorialExpectedInputKey[];
  return (
    keys.find(key =>
      getAppTutorialExpectedInputVariants(key).some(variant => matchesTutorialInput(value, variant))
    ) ?? null
  );
}

export function localizeAppTutorialExpectedInput(
  value: string,
  language: AppTutorialLanguage
): string {
  const key = getAppTutorialExpectedInputKey(value);
  return key ? getAppTutorialExpectedInput(key, language) : value;
}

export function matchesAppTutorialExpectedInput(
  actual: string,
  key: AppTutorialExpectedInputKey
): boolean {
  return getAppTutorialExpectedInputVariants(key).some(expected =>
    matchesTutorialInput(actual, expected)
  );
}

export function containsAppTutorialExpectedInput(
  actual: string,
  key: AppTutorialExpectedInputKey
): boolean {
  const normalizedActual = normalizeTutorialInput(actual);
  return getAppTutorialExpectedInputVariants(key).some(expected =>
    normalizedActual.includes(normalizeTutorialInput(expected))
  );
}

export function localizeAppTutorialText(value: string, language: AppTutorialLanguage): string {
  if (language === 'de') return value;

  const keys = Object.keys(
    APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.de
  ) as AppTutorialExpectedInputKey[];
  return keys.reduce((localizedValue, key) => {
    const germanInput = getAppTutorialExpectedInput(key, 'de');
    const englishInput = getAppTutorialExpectedInput(key, 'en');
    return localizedValue.replaceAll(germanInput, englishInput);
  }, value);
}

export type AppTutorialRouteAlias =
  | 'userId'
  | 'initiativeGroupId'
  | 'climateCouncilGroupId'
  | 'networkTodoId'
  | 'amendmentId'
  | 'firstEventId'
  | 'secondEventId'
  | 'firstAgendaItemId'
  | 'amendmentVoteId'
  | 'amendmentAcceptChoiceId'
  | 'electionAgendaItemId'
  | 'electionId'
  | 'tutorialConversationId'
  | 'assistantTodoId';

export type AppTutorialCompletion =
  | { type: 'acknowledge' }
  | { type: 'horizontal-scroll'; minimumPixels: number }
  | { type: 'click' }
  | { type: 'view' }
  | { type: 'input'; expected: string; expectedInputKey?: never }
  | { type: 'input'; expectedInputKey: AppTutorialExpectedInputKey; expected?: never }
  | {
      type: 'action';
      event: string;
      expected?: string;
      expectedInputKey?: AppTutorialExpectedInputKey;
    }
  | {
      type: 'entity-selection';
      expectedEntityAlias: 'initiativeGroupId' | 'climateCouncilGroupId';
    }
  | { type: 'drop'; event: string }
  | { type: 'mutation'; event: string }
  | { type: 'automatic' };

export type AppTutorialEffect =
  | 'accept-membership'
  | 'confirm-network-rights'
  | 'accept-reviewed-change-request'
  | 'cast-simulated-amendment-votes'
  | 'forward-amendment'
  | 'cast-simulated-election-votes'
  | 'assistant-todo-fallback'
  | 'complete-and-cleanup';

export interface AppTutorialCopy {
  title: string;
  body: string;
  instruction: string;
}

export interface AppTutorialCheckpoint {
  id: string;
  chapter: number;
  route: string;
  anchor: string;
  spotlightAnchor?: string;
  completion: AppTutorialCompletion;
  effect?: AppTutorialEffect;
  cardAction?: Record<AppTutorialLanguage, string>;
  copyText?: string;
  copyTexts?: readonly string[];
  copy: Record<AppTutorialLanguage, AppTutorialCopy>;
}

function copy(
  deTitle: string,
  deBody: string,
  deInstruction: string,
  enTitle: string,
  enBody: string,
  enInstruction: string
): Record<AppTutorialLanguage, AppTutorialCopy> {
  return {
    de: { title: deTitle, body: deBody, instruction: deInstruction },
    en: { title: enTitle, body: enBody, instruction: enInstruction },
  };
}

function checkpoint(
  value: Omit<AppTutorialCheckpoint, 'copy'> & {
    copy: ReturnType<typeof copy>;
  }
): AppTutorialCheckpoint {
  return value;
}

export const APP_TUTORIAL_CHECKPOINTS = [
  checkpoint({
    id: 'primary-navigation',
    chapter: 1,
    route: '/home',
    anchor: 'primary-navigation',
    completion: { type: 'horizontal-scroll', minimumPixels: 48 },
    copy: copy(
      'Navigation',
      'Die Primary Bar verbindet deine globalen Arbeitsbereiche. Auf Desktop liegt sie links, auf Mobile unten. Dort siehst du auch, was um dich herum passiert und wo als Nächstes deine Aufmerksamkeit gefragt ist.',
      'Scrolle die Primary Bar auf Mobile horizontal. Auf Desktop bestätigst du ihre Position.',
      'Navigation',
      'The primary bar connects your global work areas. It sits on the left on desktop and at the bottom on mobile. It also helps you see what is happening around you and where your attention is needed next.',
      'Scroll the primary bar horizontally on mobile. On desktop, confirm its position.'
    ),
  }),
  checkpoint({
    id: 'open-create',
    chapter: 1,
    route: '/home',
    anchor: 'primary-create',
    completion: { type: 'click' },
    copy: copy(
      'Initiativen starten',
      'Nutze Erstellen, um neue Initiativen zu starten oder Organisationen zu digitalisieren. Polity öffnet direkt den passenden fachlichen Workflow.',
      'Klicke auf Erstellen.',
      'Start initiatives',
      'Use Create to start new initiatives or digitize organizations. Polity opens the appropriate domain workflow directly.',
      'Select Create.'
    ),
  }),
  checkpoint({
    id: 'open-search',
    chapter: 2,
    route: '/create',
    anchor: 'primary-search',
    completion: { type: 'click' },
    copy: copy(
      'Globale Suche',
      'Mit der Suche findest du alle Inhalte, auf die du Zugriff hast, ohne ihren Arbeitsbereich vorher kennen zu müssen.',
      'Öffne die Suche.',
      'Global search',
      'Search finds every item you are allowed to access without requiring you to know its workspace first.',
      'Open Search.'
    ),
  }),
  checkpoint({
    id: 'search-initiative',
    chapter: 2,
    route: '/search',
    anchor: 'search-input',
    completion: { type: 'input', expectedInputKey: 'groupSearch' },
    copyText: APP_TUTORIAL_EXPECTED_INPUTS.groupSearch,
    copy: copy(
      'Initiative finden',
      'Sandboxinhalte erscheinen ausschließlich in deiner Suche und sind für andere Nutzer unsichtbar.',
      `Suche nach „${APP_TUTORIAL_EXPECTED_INPUTS.groupSearch}“.`,
      'Find the initiative',
      'Sandbox content appears only in your search and remains invisible to every other user.',
      `Search for “${APP_TUTORIAL_EXPECTED_INPUTS.groupSearch}”.`
    ),
  }),
  checkpoint({
    id: 'open-initiative-result',
    chapter: 2,
    route: '/search',
    anchor: 'tutorial-search-result',
    completion: { type: 'click' },
    copy: copy(
      'Treffer öffnen',
      'Der Treffer führt dich direkt in den fachlichen Kontext der Initiative.',
      'Öffne die Initiative.',
      'Open the result',
      'The result takes you directly into the initiative’s domain context.',
      'Open the initiative.'
    ),
  }),
  checkpoint({
    id: 'subscribe-initiative',
    chapter: 2,
    route: '/group/:initiativeGroupId',
    anchor: 'subscribe',
    completion: { type: 'mutation', event: 'subscriber.created' },
    copy: copy(
      'Folgen',
      'Durch Folgen erscheinen neue Aktivitäten dieser Initiative in deiner Timeline.',
      'Folge der Initiative.',
      'Follow',
      'Following the initiative adds its new activity to your timeline.',
      'Follow the initiative.'
    ),
  }),
  checkpoint({
    id: 'request-membership',
    chapter: 2,
    route: '/group/:initiativeGroupId',
    anchor: 'request-membership',
    completion: { type: 'action', event: 'group-membership.requested' },
    copy: copy(
      'Mitgliedschaft anfragen',
      'Eine Mitgliedschaft gibt dir – abhängig von Rolle und Rechten – Zugang zur gemeinsamen Arbeit.',
      'Frage die Mitgliedschaft an.',
      'Request membership',
      'Membership gives you access to shared work according to your role and rights.',
      'Request membership.'
    ),
  }),
  checkpoint({
    id: 'secondary-navigation',
    chapter: 3,
    route: '/group/:initiativeGroupId',
    anchor: 'secondary-navigation',
    completion: { type: 'acknowledge' },
    copy: copy(
      'Secondary Navigation',
      'Die Secondary Bar zeigt Unterbereiche und Aktionen des aktuell geöffneten Kontexts. Auf Desktop liegt sie rechts, auf Mobile oben.',
      'Bestätige, dass du die Secondary Bar gefunden hast.',
      'Secondary navigation',
      'The secondary bar shows subsections and actions for the context currently open. It sits on the right on desktop and at the top on mobile.',
      'Confirm that you found the secondary bar.'
    ),
  }),
  checkpoint({
    id: 'open-avatar-menu',
    chapter: 3,
    route: '/group/:initiativeGroupId',
    anchor: 'primary-avatar',
    completion: { type: 'action', event: APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION },
    copy: copy(
      'Persönliches Menü',
      'Das Avatar-Menü enthält dein Profil, Einstellungen, Dokumentation und kontobezogene Ziele.',
      'Öffne das Avatar-Menü.',
      'Personal menu',
      'The avatar menu contains your profile, settings, documentation, and account-related destinations.',
      'Open the avatar menu.'
    ),
  }),
  checkpoint({
    id: 'open-profile',
    chapter: 3,
    route: '/group/:initiativeGroupId',
    anchor: 'avatar-profile',
    completion: { type: 'click' },
    copy: copy(
      'Dein Profil',
      'Im Profil verwaltest du deine Identität, Veröffentlichungen und Mitgliedschaften.',
      'Öffne dein Profil.',
      'Your profile',
      'Your profile brings together your identity, publications, and memberships.',
      'Open your profile.'
    ),
  }),
  checkpoint({
    id: 'open-memberships',
    chapter: 3,
    route: '/user/:userId',
    anchor: 'secondary-memberships',
    completion: { type: 'click' },
    copy: copy(
      'Mitgliedschaften',
      'Hier bleiben aktive und angefragte Mitgliedschaften nachvollziehbar.',
      'Öffne Mitgliedschaften.',
      'Memberships',
      'Active and requested memberships remain traceable here.',
      'Open Memberships.'
    ),
  }),
  checkpoint({
    id: 'view-membership-request',
    chapter: 3,
    route: '/user/:userId/memberships',
    anchor: 'tutorial-membership-request',
    completion: { type: 'view' },
    effect: 'accept-membership',
    copy: copy(
      'Anfrage wird geprüft',
      'Du siehst den Pending-State. Für das Tutorial nimmt die Initiative deine Anfrage jetzt kontrolliert an.',
      'Sieh dir die Anfrage an.',
      'Request under review',
      'You can see the pending state. For this tutorial, the initiative now accepts your request in a controlled simulation.',
      'Review the request.'
    ),
  }),
  checkpoint({
    id: 'open-notifications',
    chapter: 4,
    route: '/user/:userId/memberships',
    anchor: 'primary-notifications',
    completion: { type: 'click' },
    copy: copy(
      'Benachrichtigung',
      'Wichtige Änderungen aus deinen Arbeitsräumen werden zentral gebündelt.',
      'Öffne Benachrichtigungen.',
      'Notification',
      'Important changes from your workspaces are collected centrally.',
      'Open Notifications.'
    ),
  }),
  checkpoint({
    id: 'read-membership-notification',
    chapter: 4,
    route: '/notifications',
    anchor: 'tutorial-notification-read',
    completion: { type: 'mutation', event: 'notification.read' },
    copy: copy(
      'Als gelesen markieren',
      'Der Lesestatus hilft dir, neue Signale von bereits bearbeiteten zu unterscheiden.',
      'Markiere die Benachrichtigung als gelesen.',
      'Mark as read',
      'Read status separates new signals from items you have already handled.',
      'Mark the notification as read.'
    ),
  }),
  checkpoint({
    id: 'open-membership-notification',
    chapter: 4,
    route: '/notifications',
    anchor: 'tutorial-membership-notification',
    completion: { type: 'click' },
    copy: copy(
      'Kontext öffnen',
      'Benachrichtigungen führen direkt zum Ort der Änderung.',
      'Öffne die Benachrichtigung.',
      'Open context',
      'Notifications take you directly to the place where something changed.',
      'Open the notification.'
    ),
  }),
  checkpoint({
    id: 'visit-group-amendments',
    chapter: 4,
    route: '/group/:initiativeGroupId',
    anchor: 'secondary-amendments',
    completion: { type: 'click' },
    copy: copy(
      'Amendments',
      'Amendments entwickeln fachliche Vorschläge transparent vom Entwurf bis zur Entscheidung.',
      'Öffne Amendments.',
      'Amendments',
      'Amendments develop domain proposals transparently from draft to decision.',
      'Open Amendments.'
    ),
  }),
  checkpoint({
    id: 'visit-group-events',
    chapter: 4,
    route: '/group/:initiativeGroupId/amendments',
    anchor: 'secondary-events',
    completion: { type: 'click' },
    copy: copy(
      'Events',
      'Events verbinden Termin, Teilnehmende, Agenda und formale Ergebnisse.',
      'Öffne Events.',
      'Events',
      'Events connect time, participants, agenda, and formal outcomes.',
      'Open Events.'
    ),
  }),
  checkpoint({
    id: 'visit-group-publications',
    chapter: 4,
    route: '/group/:initiativeGroupId/events',
    anchor: 'secondary-publications',
    completion: { type: 'click' },
    copy: copy(
      'Blogs & Statements',
      'Veröffentlichungen machen Informationen und Positionen dauerhaft zugänglich.',
      'Öffne Blogs & Statements.',
      'Blogs & statements',
      'Publications make information and positions permanently accessible.',
      'Open Blogs & Statements.'
    ),
  }),
  checkpoint({
    id: 'visit-group-operation',
    chapter: 4,
    route: '/group/:initiativeGroupId/blogs-and-statements',
    anchor: 'secondary-operation',
    completion: { type: 'click' },
    copy: copy(
      'Operation',
      'Operation bündelt offene Arbeit und operative Zuständigkeiten der Gruppe.',
      'Öffne Operation.',
      'Operation',
      'Operation collects open work and operational responsibility for the group.',
      'Open Operation.'
    ),
  }),
  checkpoint({
    id: 'open-network-todo',
    chapter: 5,
    route: '/group/:initiativeGroupId/operation',
    anchor: 'tutorial-network-todo',
    completion: { type: 'click' },
    copy: copy(
      'Netzwerk-Aufgabe',
      'Die vorbereitete Aufgabe führt dich durch eine echte gruppenübergreifende Verbindung.',
      'Öffne die zugewiesene Netzwerk-Aufgabe.',
      'Network task',
      'The prepared task guides you through a real cross-group connection.',
      'Open the assigned network task.'
    ),
  }),
  checkpoint({
    id: 'open-network',
    chapter: 5,
    route: '/todos/:networkTodoId',
    anchor: 'tutorial-open-network',
    spotlightAnchor: 'todo-complete',
    completion: { type: 'click' },
    cardAction: {
      de: 'Netzwerk',
      en: 'Network',
    },
    copy: copy(
      'Zum Netzwerk',
      'Netzwerke beschreiben Beziehungen, Rechte und mögliche Prozesspfade zwischen Gruppen.',
      'Wechsle zum Netzwerk der Initiative.',
      'Go to the network',
      'Networks describe relationships, rights, and possible process paths between groups.',
      'Go to the initiative network.'
    ),
  }),
  checkpoint({
    id: 'manage-network',
    chapter: 5,
    route: '/group/:initiativeGroupId/network?tab=current-network',
    anchor: 'manage-network',
    completion: { type: 'click' },
    copy: copy(
      'Netzwerk verwalten',
      'Im Verwaltungsmodus kannst du neue Verbindungen und die dafür benötigten Rechte anfragen.',
      'Öffne Netzwerk verwalten.',
      'Manage network',
      'Management mode lets you request new links and the rights needed for them.',
      'Open Manage Network.'
    ),
  }),
  checkpoint({
    id: 'link-climate-council',
    chapter: 5,
    route: '/group/:initiativeGroupId/network?tab=manage-network',
    anchor: 'link-group',
    completion: {
      type: 'entity-selection',
      expectedEntityAlias: 'climateCouncilGroupId',
    },
    copyText: APP_TUTORIAL_EXPECTED_INPUTS.networkGroupSearch,
    copy: copy(
      'Münchner Klimarat suchen',
      'Öffne „Gruppe verknüpfen“. Suche anschließend nach dem exakten Gruppennamen und wähle das Ergebnis aus.',
      `Suche nach „${APP_TUTORIAL_EXPECTED_INPUTS.networkGroupSearch}“ und wähle diese Gruppe aus.`,
      'Find Münchner Klimarat',
      'Open Link Group. Then search for the exact group name and select the result.',
      `Search for “${APP_TUTORIAL_EXPECTED_INPUTS.networkGroupSearch}” and select that group.`
    ),
  }),
  checkpoint({
    id: 'select-climate-council-child',
    chapter: 5,
    route: '/group/:initiativeGroupId/network?tab=manage-network',
    anchor: 'network-child-preset',
    completion: { type: 'click' },
    copy: copy(
      'Als Untergruppe verknüpfen',
      'Die Initiative wird als Untergruppe des Münchner Klimarats eingeordnet. Dadurch entsteht ein nachvollziehbarer hierarchischer Prozessweg.',
      'Wähle „This group is child“.',
      'Link as a child group',
      'The initiative becomes a child group of Münchner Klimarat, creating a clear hierarchical process path.',
      'Select “This group is child”.'
    ),
  }),
  checkpoint({
    id: 'select-climate-council-rights',
    chapter: 5,
    route: '/group/:initiativeGroupId/network?tab=manage-network',
    anchor: 'network-rights-selector',
    completion: {
      type: 'input',
      expectedInputKey: 'networkRightsOutgoing',
    },
    copy: copy(
      'Rechte auswählen',
      'Information Right ermöglicht Information und Zugriff. Amendment Right ist das Recht, Anträge einzureichen. Zunächst zeigt die Richtung, dass diese Gruppe die Rechte an den Münchner Klimarat gibt.',
      'Wähle „Information Right“ und „Amendment Right“.',
      'Select rights',
      'Information Right provides information and access. Amendment Right is the right to submit motions. Initially, the direction shows this group giving the rights to Münchner Klimarat.',
      'Select “Information Right” and “Amendment Right”.'
    ),
  }),
  checkpoint({
    id: 'request-climate-council-rights',
    chapter: 5,
    route: '/group/:initiativeGroupId/network?tab=manage-network',
    anchor: 'link-group',
    completion: {
      type: 'input',
      expectedInputKey: 'networkRightsIncoming',
    },
    copy: copy(
      'Rechterichtung umstellen',
      'Die Initiative soll beide Rechte im Münchner Klimarat haben. Öffne „Gruppe verknüpfen“ bei Bedarf erneut und stelle dann beide Richtungen von „gives … to“ auf „has … in“ um.',
      'Stelle Information Right und Amendment Right jeweils auf „This group has … in Münchner Klimarat“.',
      'Change right directions',
      'The initiative should have both rights in Münchner Klimarat. Open Link Group again if needed, then change both directions from “gives … to” to “has … in”.',
      'Set Information Right and Amendment Right to “This group has … in Münchner Klimarat”.'
    ),
  }),
  checkpoint({
    id: 'create-climate-council-link',
    chapter: 5,
    route: '/group/:initiativeGroupId/network?tab=manage-network',
    anchor: 'network-link-create',
    completion: { type: 'click' },
    copy: copy(
      'Verknüpfung erstellen',
      'Die Initiative ist jetzt als Untergruppe konfiguriert und hat Informations- sowie Antragsrecht im Münchner Klimarat.',
      'Klicke „Create“.',
      'Create the link',
      'The initiative is now configured as a child group with information and amendment rights in Münchner Klimarat.',
      'Select “Create”.'
    ),
  }),
  checkpoint({
    id: 'view-network-pending',
    chapter: 5,
    route: '/group/:initiativeGroupId/network?tab=manage-network',
    anchor: 'tutorial-network-pending',
    completion: { type: 'view' },
    effect: 'confirm-network-rights',
    copy: copy(
      'Anfrage ausstehend',
      'Rechte werden nicht stillschweigend vergeben. Der Pending-State bleibt sichtbar, bis die andere Gruppe bestätigt.',
      'Sieh dir den Pending-State an.',
      'Request pending',
      'Rights are never granted silently. The pending state remains visible until the other group confirms.',
      'Review the pending state.'
    ),
  }),
  checkpoint({
    id: 'view-network-confirmed',
    chapter: 5,
    route: '/group/:initiativeGroupId/network?tab=manage-network',
    anchor: 'tutorial-network-confirmed',
    completion: { type: 'view' },
    copy: copy(
      'Verknüpfung bestätigt',
      'Der Münchner Klimarat hat die Anfrage akzeptiert. Die Verknüpfung und beide Rechte werden jetzt als aktive Beziehung angezeigt.',
      'Sieh dir den akzeptierten Link an.',
      'Link accepted',
      'Münchner Klimarat has accepted the request. The link and both rights now appear as an active relationship.',
      'Review the accepted link.'
    ),
  }),
  checkpoint({
    id: 'view-network-flow',
    chapter: 5,
    route: '/group/:initiativeGroupId/network?tab=current-network',
    anchor: 'tutorial-network-flow',
    completion: { type: 'view' },
    copy: copy(
      'Prozessweg',
      'Die Flow-Karte zeigt nun, wie ein Amendment von der Initiative zum Klimarat gelangen kann.',
      'Sieh dir die bestätigte Flow-Karte an.',
      'Process path',
      'The flow map now shows how an amendment can travel from the initiative to the climate council.',
      'Review the confirmed flow map.'
    ),
  }),
  checkpoint({
    id: 'complete-network-todo',
    chapter: 5,
    route: '/todos',
    anchor: 'tutorial-network-todo-board',
    completion: { type: 'drop', event: 'todo.completed' },
    copy: copy(
      'Aufgabe per Drag-and-drop abschließen',
      'Auf dem Kanban-Board dokumentiert die Spalte „Erledigt“, dass der operative Schritt abgeschlossen wurde.',
      'Ziehe die Netzwerk-Aufgabe in die Spalte „Erledigt“.',
      'Complete the task with drag and drop',
      'On the Kanban board, the “Completed” column documents that the operational step has been handled.',
      'Drag the network task into the “Completed” column.'
    ),
  }),
  checkpoint({
    id: 'edit-amendment-text',
    chapter: 6,
    route: '/amendment/:amendmentId/text',
    anchor: 'amendment-text-editor',
    completion: { type: 'input', expectedInputKey: 'amendmentAddition' },
    copyText: APP_TUTORIAL_EXPECTED_INPUTS.amendmentAddition,
    copy: copy(
      'Volltext ergänzen',
      'Der Volltext ist die gemeinsame, versionierte Arbeitsgrundlage des Amendments.',
      `Füge am Ende hinzu: „${APP_TUTORIAL_EXPECTED_INPUTS.amendmentAddition}“`,
      'Add to the full text',
      'The full text is the shared, versioned working basis of the amendment.',
      `Append at the end: “${APP_TUTORIAL_EXPECTED_INPUTS.amendmentAddition}”`
    ),
  }),
  checkpoint({
    id: 'open-city-design',
    chapter: 6,
    route: '/amendment/:amendmentId/text',
    anchor: 'secondary-city-design',
    completion: { type: 'click' },
    copy: copy(
      'Stadtgestaltung',
      'Die Stadtgestaltung überträgt die nachvollziehbare Änderungslogik auf den Straßenraum.',
      'Öffne die Stadtgestaltung.',
      'City Design',
      'City Design applies traceable change logic to the street environment.',
      'Open City Design.'
    ),
  }),
  checkpoint({
    id: 'open-city-design-map-selection',
    chapter: 6,
    route: '/amendment/:amendmentId/citydesign',
    anchor: 'city-design-map-selection',
    completion: { type: 'click' },
    copy: copy(
      'Kartenausschnitt auswählen',
      'Über die Kartenauswahl legst du fest, welchen realen Straßenraum der Entwurf als Grundlage verwendet.',
      'Öffne die Kartenauswahl.',
      'Select the map area',
      'Map selection defines which real street area the design uses as its basis.',
      'Open map selection.'
    ),
  }),
  checkpoint({
    id: 'select-city-design-address',
    chapter: 6,
    route: '/amendment/:amendmentId/citydesign',
    anchor: 'city-design-location-search',
    completion: { type: 'action', event: 'city-design.location-selected' },
    copyTexts: [
      APP_TUTORIAL_EXPECTED_INPUTS.cityDesignStreet,
      APP_TUTORIAL_EXPECTED_INPUTS.cityDesignHouseNumber,
    ],
    copy: copy(
      'Euckenstraße 38 auswählen',
      'Die strukturierte Adresssuche positioniert den Kartenausschnitt eindeutig am Tutorial-Ort.',
      'Gib im Feld „Straße“ Euckenstraße ein und wähle den Treffer aus. Gib danach im Feld „Hausnummer“ 38 ein und wähle auch diesen Treffer aus.',
      'Select Euckenstraße 38',
      'The structured address search positions the map area unambiguously at the tutorial location.',
      'Enter Euckenstraße in the Street field and select the result. Then enter 38 in the House Number field and select that result.'
    ),
  }),
  checkpoint({
    id: 'load-city-design-osm',
    chapter: 6,
    route: '/amendment/:amendmentId/citydesign',
    anchor: 'city-design-load-osm',
    completion: { type: 'action', event: 'city-design.osm-loaded' },
    copy: copy(
      'OSM laden',
      'Der ausgewählte Kartenausschnitt der Euckenstraße 38 wird jetzt live aus OpenStreetMap geladen.',
      'Klicke auf „OSM laden“ und warte, bis die echten OSM-Daten des Straßenraums geladen sind.',
      'Load OSM',
      'The selected map section for Euckenstraße 38 is now loaded live from OpenStreetMap.',
      'Select “Load OSM” and wait until the real OSM data for the street scene has loaded.'
    ),
  }),
  checkpoint({
    id: 'open-city-design-trees',
    chapter: 6,
    route: '/amendment/:amendmentId/citydesign',
    anchor: 'city-design-trees-menu',
    completion: { type: 'click' },
    copy: copy(
      'Bäume öffnen',
      'Die Elementgruppen bündeln die Werkzeuge für die verschiedenen Bestandteile des Straßenraums.',
      'Öffne die Elementgruppe „Bäume“.',
      'Open Trees',
      'Element groups collect the tools for the different parts of the street environment.',
      'Open the “Trees” element group.'
    ),
  }),
  checkpoint({
    id: 'select-city-design-deciduous',
    chapter: 6,
    route: '/amendment/:amendmentId/citydesign',
    anchor: 'city-design-tree-deciduous',
    completion: { type: 'click' },
    copy: copy(
      'Laubbaum auswählen',
      'Ein Laubbaum sorgt im Beispiel für Schatten und ergänzt die klimaresiliente Straßenraumplanung.',
      'Wähle das Werkzeug „Laubbaum“ aus.',
      'Select a deciduous tree',
      'In this example, a deciduous tree provides shade and complements climate-resilient City Design.',
      'Select the “Deciduous tree” tool.'
    ),
  }),
  checkpoint({
    id: 'add-tree-row',
    chapter: 6,
    route: '/amendment/:amendmentId/citydesign',
    anchor: 'city-design-tree-placement-workspace',
    completion: { type: 'mutation', event: 'city-design.tree-row-added' },
    copy: copy(
      'Bäume platzieren',
      'Eine Pfadlinie verteilt die ausgewählten Laubbäume als Baumreihe entlang des Straßenraums. Falls die Platzierung unterbrochen wird oder du ein bestehendes Objekt auswählst, öffne „Bäume“ erneut und wähle wieder „Laubbaum“.',
      'Setze mindestens zwei Punkte in der Karte und schließe die Baumreihe mit „Fertig“ oder Enter ab.',
      'Place the trees',
      'A path line distributes the selected deciduous trees as a row along the street environment. If placement is interrupted or you select an existing object, reopen “Trees” and select “Deciduous tree” again.',
      'Set at least two points on the map and finish the tree row with “Done” or Enter.'
    ),
  }),
  checkpoint({
    id: 'save-city-design',
    chapter: 6,
    route: '/amendment/:amendmentId/citydesign',
    anchor: 'city-design-save',
    completion: { type: 'mutation', event: 'city-design.saved' },
    copy: copy(
      'Entwurf speichern',
      'Speichern hält den räumlichen Vorschlag am Amendment fest.',
      'Speichere die Stadtgestaltung.',
      'Save the design',
      'Saving attaches the spatial proposal to the amendment.',
      'Save the City Design.'
    ),
  }),
  checkpoint({
    id: 'return-amendment-text',
    chapter: 6,
    route: '/amendment/:amendmentId/citydesign',
    anchor: 'secondary-amendment-text',
    completion: { type: 'click' },
    copy: copy(
      'Zurück zum Text',
      'Text- und Straßenansicht bleiben zwei Perspektiven desselben Amendments.',
      'Kehre zur Textansicht zurück.',
      'Return to text',
      'Text and street views remain two perspectives on the same amendment.',
      'Return to the text view.'
    ),
  }),
  checkpoint({
    id: 'switch-suggest-internal',
    chapter: 6,
    route: '/amendment/:amendmentId/text',
    anchor: 'amendment-mode-suggest-internal',
    completion: { type: 'mutation', event: 'amendment.mode.suggest_internal' },
    copy: copy(
      'Interne Vorschläge',
      'Im Modus „Intern vorschlagen“ können Mitglieder konkrete Änderungen als Change Request einreichen.',
      'Wechsle zu Intern vorschlagen.',
      'Internal suggestions',
      'Suggest internal mode lets members submit concrete edits as change requests.',
      'Switch to Suggest internal.'
    ),
  }),
  checkpoint({
    id: 'create-change-request',
    chapter: 6,
    route: '/amendment/:amendmentId/text',
    anchor: 'amendment-text-editor',
    completion: {
      type: 'action',
      event: 'change-request.created',
      expectedInputKey: 'changeRequestText',
    },
    copyText: APP_TUTORIAL_EXPECTED_INPUTS.changeRequestText,
    copy: copy(
      'Change Request',
      'Im Vorschlagsmodus wird deine Änderung im Textbereich automatisch als einzeln prüfbarer Change Request erfasst.',
      `Ergänze im Textbereich: „${APP_TUTORIAL_EXPECTED_INPUTS.changeRequestText}“`,
      'Change request',
      'In suggestion mode, your edit in the text panel is automatically captured as an independently reviewable change request.',
      `Add this in the text panel: “${APP_TUTORIAL_EXPECTED_INPUTS.changeRequestText}”`
    ),
  }),
  checkpoint({
    id: 'switch-vote-internal',
    chapter: 6,
    route: '/amendment/:amendmentId/text',
    anchor: 'amendment-mode-vote-internal',
    completion: { type: 'mutation', event: 'amendment.mode.vote_internal' },
    copy: copy(
      'Intern bewerten',
      'Im internen Voting-Modus priorisiert die Gruppe bestehende Änderungsvorschläge.',
      'Wechsle zu Intern abstimmen.',
      'Internal review',
      'Vote internal mode lets the group prioritize existing change proposals.',
      'Switch to Vote internal.'
    ),
  }),
  checkpoint({
    id: 'vote-change-request',
    chapter: 6,
    route: '/amendment/:amendmentId/text',
    anchor: 'tutorial-change-request-editor-trigger',
    completion: { type: 'click' },
    copy: copy(
      'Änderung öffnen',
      'Bestehende Change Requests werden direkt an ihrer Änderung im Text geprüft.',
      'Öffne einen bestehenden Change Request über das Bearbeitungssymbol.',
      'Open a change',
      'Existing change requests are reviewed directly at their change in the full text.',
      'Open an existing change request using its edit icon.'
    ),
  }),
  checkpoint({
    id: 'accept-change-request',
    chapter: 6,
    route: '/amendment/:amendmentId/text',
    anchor: 'tutorial-change-request-accept',
    completion: { type: 'mutation', event: 'change-request.voted' },
    effect: 'accept-reviewed-change-request',
    copy: copy(
      'Änderung bewerten',
      'Deine Bewertung bleibt mit dem konkreten Change Request verbunden.',
      'Stimme dem Change Request mit „Accept“ zu.',
      'Review a change',
      'Your vote remains attached to the specific change request.',
      'Vote for the change request by selecting “Accept”.'
    ),
  }),
  checkpoint({
    id: 'open-change-requests',
    chapter: 6,
    route: '/amendment/:amendmentId/change-requests',
    anchor: 'tutorial-change-request-overview',
    completion: { type: 'view' },
    copy: copy(
      'Änderungsübersicht',
      'Die Übersicht macht offene, angenommene und abgelehnte Änderungen auffindbar.',
      'Sieh dir die Change-Request-Übersicht an.',
      'Change overview',
      'The overview keeps open, accepted, and rejected changes discoverable.',
      'Review the change request overview.'
    ),
  }),
  checkpoint({
    id: 'open-amendment-process',
    chapter: 6,
    route: '/amendment/:amendmentId/change-requests',
    anchor: 'secondary-process',
    completion: { type: 'click' },
    copy: copy(
      'Prozess',
      'Ein Prozesspfad legt fest, welche verbundenen Gruppen den Vorschlag als Nächstes behandeln.',
      'Öffne den Prozess.',
      'Process',
      'A process path defines which connected groups will handle the proposal next.',
      'Open Process.'
    ),
  }),
  checkpoint({
    id: 'create-amendment-path',
    chapter: 6,
    route: '/amendment/:amendmentId/process',
    anchor: 'tutorial-process-start-group',
    completion: {
      type: 'entity-selection',
      expectedEntityAlias: 'initiativeGroupId',
    },
    copyText: APP_TUTORIAL_EXPECTED_INPUTS.groupSearch,
    copy: copy(
      'Startgruppe auswählen',
      'Die Initiative ist die Gruppe, aus der das Amendment in den Prozess startet.',
      `Verwende „${APP_TUTORIAL_EXPECTED_INPUTS.groupSearch}“ als Startgruppe.`,
      'Select the start group',
      'The initiative is the group from which the amendment enters the process.',
      `Use “${APP_TUTORIAL_EXPECTED_INPUTS.groupSearch}” as the start group.`
    ),
  }),
  checkpoint({
    id: 'select-amendment-path-target',
    chapter: 6,
    route: '/amendment/:amendmentId/process',
    anchor: 'tutorial-process-target-group',
    completion: {
      type: 'entity-selection',
      expectedEntityAlias: 'climateCouncilGroupId',
    },
    copyText: APP_TUTORIAL_EXPECTED_INPUTS.networkGroupSearch,
    copy: copy(
      'Zielgruppe auswählen',
      'Der Münchner Klimarat ist die verbundene Gruppe, in der das Amendment anschließend behandelt wird.',
      `Verwende „${APP_TUTORIAL_EXPECTED_INPUTS.networkGroupSearch}“ als Zielgruppe.`,
      'Select the target group',
      'Münchner Klimarat is the connected group that handles the amendment next.',
      `Use “${APP_TUTORIAL_EXPECTED_INPUTS.networkGroupSearch}” as the target group.`
    ),
  }),
  checkpoint({
    id: 'review-amendment-process-path',
    chapter: 6,
    route: '/amendment/:amendmentId/process',
    anchor: 'tutorial-process-path-review',
    completion: { type: 'view' },
    copy: copy(
      'Prozesspfad prüfen',
      'Das System ordnet die vorbereiteten Events entlang des Pfads in chronologischer Reihenfolge zu.',
      'Prüfe Startgruppe, Zielgruppe und die zugeordneten Events.',
      'Review the process path',
      'The system assigns the prepared events along the path in chronological order.',
      'Review the start group, target group, and assigned events.'
    ),
  }),
  checkpoint({
    id: 'confirm-amendment-process',
    chapter: 6,
    route: '/amendment/:amendmentId/process',
    anchor: 'tutorial-confirm-process-path',
    completion: { type: 'mutation', event: 'amendment-process.started' },
    copy: copy(
      'Prozess bestätigen',
      'Mit der Bestätigung wird der geprüfte Pfad angelegt und das Amendment an die Agenden gehängt.',
      'Klicke auf „Confirm process“.',
      'Confirm the process',
      'Confirmation creates the reviewed path and attaches the amendment to the agendas.',
      'Select “Confirm process”.'
    ),
  }),
  checkpoint({
    id: 'open-home',
    chapter: 7,
    route: '/amendment/:amendmentId/process',
    anchor: 'primary-home',
    completion: { type: 'click' },
    copy: copy(
      'Home',
      'Home verbindet deine Timeline mit dem Decision Terminal. Nutze Home, um zu sehen, was um dich herum passiert und wo deine Aufmerksamkeit oder eine Entscheidung als Nächstes benötigt wird.',
      'Wechsle zu Home.',
      'Home',
      'Home connects your timeline with the Decision Terminal. Use Home to see what is happening around you and where your attention or a decision is needed next.',
      'Go to Home.'
    ),
  }),
  checkpoint({
    id: 'view-decision-terminal',
    chapter: 7,
    route: '/home',
    anchor: 'tutorial-decision-terminal-item',
    completion: { type: 'view' },
    copy: copy(
      'Anstehende Entscheidung',
      'Das Decision Terminal bündelt aktive Abstimmungen, Wahlen und Entscheidungssignale.',
      'Sieh dir die anstehende Entscheidung an.',
      'Upcoming decision',
      'The Decision Terminal collects active votes, elections, and decision signals.',
      'Review the upcoming decision.'
    ),
  }),
  checkpoint({
    id: 'open-calendar',
    chapter: 7,
    route: '/home',
    anchor: 'primary-calendar',
    completion: { type: 'click' },
    copy: copy(
      'Kalender',
      'Der Kalender ordnet deine anstehenden Events chronologisch.',
      'Öffne den Kalender.',
      'Calendar',
      'Calendar arranges your upcoming events chronologically.',
      'Open Calendar.'
    ),
  }),
  checkpoint({
    id: 'open-first-event',
    chapter: 7,
    route: '/calendar',
    anchor: 'tutorial-first-event',
    completion: { type: 'click' },
    copy: copy(
      'Erstes Event',
      'Das frühere Event steht vor dem Folgeevent und behandelt das Amendment zuerst.',
      'Öffne das erste Event.',
      'First event',
      'The earlier event comes before the follow-up event and handles the amendment first.',
      'Open the first event.'
    ),
  }),
  checkpoint({
    id: 'start-first-event',
    chapter: 7,
    route: '/event/:firstEventId/agenda',
    anchor: 'event-start',
    completion: { type: 'mutation', event: 'event.started' },
    copy: copy(
      'Event starten',
      'Ein gestartetes Event aktiviert die vorbereitete Agenda für die gemeinsame Bearbeitung.',
      'Starte das Event.',
      'Start the event',
      'Starting an event activates its prepared agenda for joint work.',
      'Start the event.'
    ),
  }),
  checkpoint({
    id: 'open-amendment-agenda-item',
    chapter: 8,
    route: '/event/:firstEventId/agenda',
    anchor: 'tutorial-amendment-agenda-item',
    completion: { type: 'click' },
    copy: copy(
      'Agenda-Punkt öffnen',
      'Jeder Agenda-Punkt hat eine eigene Detailansicht für Kontext, Änderungen und Abstimmung.',
      'Öffne den Agenda-Punkt zum Amendment.',
      'Open the agenda item',
      'Each agenda item has its own detail view for context, changes, and voting.',
      'Open the amendment agenda item.'
    ),
  }),
  checkpoint({
    id: 'review-amendment-change-requests',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:firstAgendaItemId',
    anchor: 'tutorial-amendment-change-requests',
    completion: { type: 'view' },
    copy: copy(
      'Change Requests prüfen',
      'Vor der finalen Abstimmung bleiben die einzelnen Änderungsvorschläge mit ihrem Status nachvollziehbar.',
      'Sieh dir die Change Requests an und wähle dann „Weiter“.',
      'Review change requests',
      'Before the final vote, every proposed change and its status remains traceable.',
      'Review the change requests, then select Continue.'
    ),
  }),
  checkpoint({
    id: 'open-amendment-agenda-vote',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:firstAgendaItemId',
    anchor: 'agenda-amendment-vote',
    completion: { type: 'click' },
    copy: copy(
      'Abstimmung öffnen',
      'Die Abstimmung wird über die obere Action Bar gestartet, damit der aktive Agenda-Kontext erhalten bleibt.',
      'Wähle in der oberen Leiste „Abstimmen“.',
      'Open the vote',
      'Voting starts from the top action bar so the active agenda context stays visible.',
      'Select Vote in the top bar.'
    ),
  }),
  checkpoint({
    id: 'select-amendment-yes',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:firstAgendaItemId',
    anchor: 'agenda-amendment-yes',
    completion: { type: 'click' },
    copy: copy(
      'Ja auswählen',
      'Mit „Ja“ stimmst du dem Amendment in der vorliegenden Fassung zu.',
      'Wähle „Ja“.',
      'Select Yes',
      'Selecting Yes approves the amendment in its current form.',
      'Select Yes.'
    ),
  }),
  checkpoint({
    id: 'confirm-amendment-vote',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:firstAgendaItemId',
    anchor: 'agenda-amendment-submit',
    completion: { type: 'click' },
    copy: copy(
      'Auswahl bestätigen',
      'Bestätige deine Auswahl, um die Stimmabgabe mit dem Tutorial-Abstimmungspasswort zu schützen.',
      'Wähle „Bestätigen“.',
      'Confirm your selection',
      'Confirm your selection to protect the vote with the tutorial voting password.',
      'Select Confirm.'
    ),
  }),
  checkpoint({
    id: 'submit-amendment-vote',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:firstAgendaItemId',
    anchor: 'agenda-amendment-password',
    completion: { type: 'mutation', event: 'agenda-amendment.voted' },
    effect: 'cast-simulated-amendment-votes',
    copyText: APP_TUTORIAL_EXPECTED_INPUTS.votingPassword,
    copy: copy(
      'Stimme abgeben',
      'Nach deiner bestätigten Stimme stimmen die simulierten Teilnehmenden kontrolliert ab.',
      `Kopiere ${APP_TUTORIAL_EXPECTED_INPUTS.votingPassword}, füge das Passwort ein und gib deine Stimme ab.`,
      'Submit your vote',
      'After your vote is confirmed, the simulated participants cast their controlled votes.',
      `Copy ${APP_TUTORIAL_EXPECTED_INPUTS.votingPassword}, paste the password, and submit your vote.`
    ),
  }),
  checkpoint({
    id: 'view-amendment-result',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:firstAgendaItemId',
    anchor: 'tutorial-amendment-result',
    completion: { type: 'view' },
    effect: 'forward-amendment',
    copy: copy(
      'Angenommen und weitergeleitet',
      'Die Mehrheit hat das Amendment angenommen. Der vorbereitete Prozess leitet es automatisch an das Folgeevent weiter.',
      'Sieh dir das Abstimmungsergebnis an und wähle dann „Weiter“.',
      'Accepted and forwarded',
      'The majority accepted the amendment. The prepared process automatically forwards it to the follow-up event.',
      'Review the voting result, then select Continue.'
    ),
  }),
  checkpoint({
    id: 'open-election-agenda-item',
    chapter: 8,
    route: '/event/:firstEventId/agenda',
    anchor: 'tutorial-election-agenda-item',
    completion: { type: 'click' },
    copy: copy(
      'Wahl öffnen',
      'Nach dem angenommenen Amendment wurde automatisch ein weiterer Agenda-Punkt für die Wahl zum Kreisvorsitz ergänzt.',
      'Öffne den Wahl-Agenda-Punkt.',
      'Open the election',
      'After the amendment was accepted, another agenda item was added automatically for the district chair election.',
      'Open the election agenda item.'
    ),
  }),
  checkpoint({
    id: 'review-election-options',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:electionAgendaItemId',
    anchor: 'tutorial-election-options',
    completion: { type: 'view' },
    copy: copy(
      'Wahloptionen',
      'Die Detailansicht zeigt Kandidierende, Wahlmodus und den aktuellen Abstimmungsstand.',
      'Sieh dir die Wahloptionen an und wähle dann „Weiter“.',
      'Election options',
      'The detail view shows candidates, election mode, and current voting progress.',
      'Review the election options, then select Continue.'
    ),
  }),
  checkpoint({
    id: 'open-election-agenda-vote',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:electionAgendaItemId',
    anchor: 'agenda-election-vote',
    completion: { type: 'click' },
    copy: copy(
      'Wahl starten',
      'Auch die Personenwahl wird aus dem aktiven Agenda-Kontext über die obere Leiste geöffnet.',
      'Wähle in der oberen Leiste „Abstimmen“.',
      'Start the election vote',
      'The candidate election also opens from the active agenda context in the top bar.',
      'Select Vote in the top bar.'
    ),
  }),
  checkpoint({
    id: 'select-election-option',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:electionAgendaItemId',
    anchor: 'agenda-election-option',
    completion: { type: 'click' },
    copy: copy(
      'Wahl treffen',
      'Wähle eine Person für den Kreisvorsitz aus.',
      'Wähle eine der kandidierenden Personen.',
      'Choose a candidate',
      'Choose one person for the district chair.',
      'Select one of the candidates.'
    ),
  }),
  checkpoint({
    id: 'confirm-election-vote',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:electionAgendaItemId',
    anchor: 'agenda-election-submit',
    completion: { type: 'click' },
    copy: copy(
      'Wahl bestätigen',
      'Bestätige deine Auswahl, um die Wahl mit dem Tutorial-Abstimmungspasswort zu schützen.',
      'Wähle „Bestätigen“.',
      'Confirm the election',
      'Confirm your selection to protect the election with the tutorial voting password.',
      'Select Confirm.'
    ),
  }),
  checkpoint({
    id: 'submit-election-vote',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:electionAgendaItemId',
    anchor: 'agenda-election-password',
    completion: { type: 'mutation', event: 'agenda-election.voted' },
    effect: 'cast-simulated-election-votes',
    copyText: APP_TUTORIAL_EXPECTED_INPUTS.votingPassword,
    copy: copy(
      'Wahl abgeben',
      'Deine bestätigte Wahl löst die kontrollierten Stimmen der simulierten Teilnehmenden aus und schließt die Wahl.',
      `Kopiere ${APP_TUTORIAL_EXPECTED_INPUTS.votingPassword}, füge das Passwort ein und gib deine Wahl ab.`,
      'Submit the election',
      'Your confirmed selection triggers the controlled votes from the simulated participants and closes the election.',
      `Copy ${APP_TUTORIAL_EXPECTED_INPUTS.votingPassword}, paste the password, and submit your election.`
    ),
  }),
  checkpoint({
    id: 'view-election-result',
    chapter: 8,
    route: '/event/:firstEventId/agenda/:electionAgendaItemId',
    anchor: 'tutorial-election-result',
    completion: { type: 'view' },
    copy: copy(
      'Wahlergebnis',
      'Die Wahl ist geschlossen. Das Ergebnis bleibt im Agenda-Punkt nachvollziehbar.',
      'Sieh dir das Wahlergebnis an und wähle dann „Weiter“.',
      'Election result',
      'The election is closed. Its result remains traceable in the agenda item.',
      'Review the election result, then select Continue.'
    ),
  }),
  checkpoint({
    id: 'open-settings',
    chapter: 9,
    route: '/event/:firstEventId/agenda/:electionAgendaItemId',
    anchor: 'primary-avatar',
    completion: { type: 'action', event: APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION },
    copy: copy(
      'Einstellungen öffnen',
      'Die nächsten Hinweise zeigen Personalisierung und AI-Konfiguration, ohne deine Einstellungen dauerhaft zu verändern.',
      'Öffne das Avatar-Menü.',
      'Open settings',
      'The next hints show personalization and AI configuration without changing your settings permanently.',
      'Open the avatar menu.'
    ),
  }),
  checkpoint({
    id: 'select-settings',
    chapter: 9,
    route: '/event/:firstEventId/agenda/:electionAgendaItemId',
    anchor: 'avatar-settings',
    completion: { type: 'click' },
    copy: copy(
      'Persönliche Einstellungen',
      'Einstellungen gelten für dein Konto und können später jederzeit angepasst werden.',
      'Öffne Einstellungen.',
      'Personal settings',
      'Settings apply to your account and can be adjusted again at any time.',
      'Open Settings.'
    ),
  }),
  checkpoint({
    id: 'view-appearance-settings',
    chapter: 9,
    route: '/user/:userId/settings?tab=preferences',
    anchor: 'settings-appearance',
    completion: { type: 'view' },
    copy: copy(
      'Sprache, Theme & Währung',
      'Darstellung, Hell/Dunkel/System, Sprache und Anzeigewährung passen Polity an deinen Kontext an.',
      'Sieh dir die Darstellungsoptionen an, ohne sie zu ändern.',
      'Language, theme & currency',
      'Appearance, light/dark/system, language, and display currency adapt Polity to your context.',
      'Review the appearance options without changing them.'
    ),
  }),
  checkpoint({
    id: 'view-ai-skills',
    chapter: 9,
    route: '/user/:userId/settings?tab=ai',
    anchor: 'settings-ai-skills',
    completion: { type: 'view' },
    copy: copy(
      'AI-Skills',
      'Skills geben Assistent Aria & Kai wiederverwendbare fachliche Arbeitsanweisungen.',
      'Sieh dir AI-Skills an und wähle dann „Weiter“.',
      'AI skills',
      'Skills give Assistent Aria & Kai reusable domain instructions.',
      'Review AI Skills, then select Continue.'
    ),
  }),
  checkpoint({
    id: 'view-ai-tools',
    chapter: 9,
    route: '/user/:userId/settings?tab=ai',
    anchor: 'settings-ai-tools',
    completion: { type: 'view' },
    copy: copy(
      'Tools',
      'Tools erlauben Assistent Aria & Kai, freigegebene Aktionen nachvollziehbar auszuführen.',
      'Sieh dir Tools an und wähle dann „Weiter“.',
      'Tools',
      'Tools let Assistent Aria & Kai execute approved actions traceably.',
      'Review Tools, then select Continue.'
    ),
  }),
  checkpoint({
    id: 'view-byoc',
    chapter: 9,
    route: '/user/:userId/settings?tab=ai',
    anchor: 'settings-byoc',
    completion: { type: 'view' },
    copy: copy(
      'BYOC',
      'Bring Your Own Credentials trennt persönliche Modellzugänge von der normalen App-Nutzung.',
      'Sieh dir die BYOC-Möglichkeit an.',
      'BYOC',
      'Bring Your Own Credentials separates personal model access from normal app use.',
      'Review the BYOC option.'
    ),
  }),
  checkpoint({
    id: 'open-messages',
    chapter: 10,
    route: '/user/:userId/settings',
    anchor: 'primary-messages',
    completion: { type: 'click' },
    copy: copy(
      'Nachrichten',
      'Nachrichten bündeln direkte Kommunikation mit Freunden, Gleichgesinnten, Kollegen sowie Assistent Aria & Kai. So bleiben individuelle Nachrichten und Gruppenchats an einem Ort.',
      'Öffne Nachrichten.',
      'Messages',
      'Messages collect direct communication with friends, like-minded people, colleagues, and Assistent Aria & Kai. Individual messages and group chats stay together in one place.',
      'Open Messages.'
    ),
  }),
  checkpoint({
    id: 'open-tutorial-assistant',
    chapter: 10,
    route: '/messages',
    anchor: 'tutorial-assistant-conversation',
    completion: { type: 'click' },
    copy: copy(
      'Assistent Aria & Kai',
      'Diese run-spezifische Conversation gehört zur Sandbox. Dein freier Chat mit Assistent Aria & Kai bleibt unabhängig und wird niemals bereinigt.',
      'Öffne die Tutorial-Conversation.',
      'Assistent Aria & Kai',
      'This run-specific conversation belongs to the sandbox. Your regular chat with Assistent Aria & Kai stays independent and is never cleaned up.',
      'Open the tutorial conversation.'
    ),
  }),
  checkpoint({
    id: 'ask-assistant-for-todo',
    chapter: 11,
    route: '/messages',
    anchor: 'message-composer',
    completion: { type: 'input', expectedInputKey: 'assistantTodo' },
    effect: 'assistant-todo-fallback',
    copyText: APP_TUTORIAL_EXPECTED_INPUTS.assistantTodo,
    copy: copy(
      'Aufgabe mit AI erstellen',
      'Die echte AI nutzt einen gepinnten Tutorial-Skill und das Todo-Tool. Falls Modell oder Tool ausfällt, erzeugt eine idempotente Serveraktion dasselbe Ergebnis.',
      `Sende exakt: „${APP_TUTORIAL_EXPECTED_INPUTS.assistantTodo}“`,
      'Create a task with AI',
      'The real AI uses a pinned tutorial skill and the Todo tool. If the model or tool fails, an idempotent server action creates the same result.',
      `Send exactly: “${APP_TUTORIAL_EXPECTED_INPUTS.assistantTodo}”`
    ),
  }),
  checkpoint({
    id: 'open-todos',
    chapter: 12,
    route: '/messages',
    anchor: 'tutorial-assistant-todo-output',
    completion: { type: 'click' },
    copy: copy(
      'Aufgaben',
      'Todos halten persönliche und gemeinsame Arbeit mit Status und Zuständigkeit fest.',
      'Öffne Aufgaben.',
      'Tasks',
      'Todos track personal and shared work with status and responsibility.',
      'Open Tasks.'
    ),
  }),
  checkpoint({
    id: 'open-assistant-todo',
    chapter: 12,
    route: '/todos',
    anchor: 'tutorial-assistant-todo',
    completion: { type: 'view' },
    copy: copy(
      'Neue Aufgabe',
      'Assistent Aria & Kai hat das Todo über dasselbe Werkzeug erstellt, das auch normale App-Aktionen nutzt.',
      'Sieh dir die neue Aufgabe an und wähle dann „Weiter“.',
      'New task',
      'Assistent Aria & Kai created the todo through the same tool used by normal app actions.',
      'Review the new task, then select Continue.'
    ),
  }),
  checkpoint({
    id: 'start-assistant-todo',
    chapter: 12,
    route: '/todos',
    anchor: 'tutorial-assistant-todo-board',
    completion: { type: 'mutation', event: 'todo.in-progress' },
    copy: copy(
      'Aufgabe beginnen',
      'Die Spalte „In Arbeit“ macht im Kanban-Board sichtbar, woran du gerade arbeitest.',
      'Ziehe die neue Aufgabe in die Spalte „In Arbeit“.',
      'Start the task',
      'The In progress column on the kanban board makes your current work visible.',
      'Drag the new task into the In progress column.'
    ),
  }),
  checkpoint({
    id: 'permanent-help',
    chapter: 12,
    route: '/todos',
    anchor: 'tutorial-help-links',
    completion: { type: 'acknowledge' },
    copy: copy(
      'Dauerhafte Hilfe',
      'Assistent Aria & Kai, ein Tutorial-Neustart in den Einstellungen und die Docs bleiben dir nach diesem Durchlauf erhalten.',
      'Bestätige die dauerhaften Hilfen.',
      'Permanent help',
      'Assistent Aria & Kai, tutorial restart in Settings, and Docs remain available after this run.',
      'Confirm the permanent help options.'
    ),
  }),
  checkpoint({
    id: 'tutorial-complete',
    chapter: 13,
    route: '/todos',
    anchor: 'tutorial-help-links',
    completion: { type: 'acknowledge' },
    effect: 'complete-and-cleanup',
    copy: copy(
      'Jetzt bist du dran',
      'Polity hat noch viel mehr Features. Erkunde sie. Mach die Welt mit uns und deinen Gleichgesinnten zu einem besseren Ort – ob lokal, national oder transnational. Vernetze dich in Polity mit Menschen und verändere die Welt!',
      'Schließe das Tutorial ab.',
      'Now it is your turn',
      'Polity has many more features. Explore them. Make the world a better place with us and like-minded people – locally, nationally, or transnationally. Connect with people in Polity and change the world!',
      'Complete the tutorial.'
    ),
  }),
] as const satisfies readonly AppTutorialCheckpoint[];

export type AppTutorialCheckpointId = (typeof APP_TUTORIAL_CHECKPOINTS)[number]['id'];

export const APP_TUTORIAL_CHECKPOINT_IDS = APP_TUTORIAL_CHECKPOINTS.map(
  item => item.id
) as readonly AppTutorialCheckpointId[];

export function getAppTutorialCheckpoint(id: string): (typeof APP_TUTORIAL_CHECKPOINTS)[number] {
  const checkpointValue = APP_TUTORIAL_CHECKPOINTS.find(item => item.id === id);
  if (!checkpointValue) throw new Error(`Unknown app tutorial checkpoint: ${id}`);
  return checkpointValue;
}

export function getNextAppTutorialCheckpoint(
  id: AppTutorialCheckpointId
): (typeof APP_TUTORIAL_CHECKPOINTS)[number] | null {
  const index = APP_TUTORIAL_CHECKPOINT_IDS.indexOf(id);
  return APP_TUTORIAL_CHECKPOINTS[index + 1] ?? null;
}

export function normalizeTutorialInput(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[„“”]/g, '"')
    .replace(/[‚‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('de-DE');
}

export function matchesTutorialInput(actual: string, expected: string): boolean {
  return normalizeTutorialInput(actual) === normalizeTutorialInput(expected);
}

export function resolveAppTutorialRoute(
  route: string,
  entities: Partial<Record<AppTutorialRouteAlias, string>>
): string {
  return route.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_, alias: string) => {
    const value = entities[alias as AppTutorialRouteAlias];
    if (!value) throw new Error(`Missing tutorial entity alias: ${alias}`);
    return encodeURIComponent(value);
  });
}
