import type { DocsGettingStartedSlug, DocsLanguage, DocsSection } from '../types/docs.types';

export interface LocalizedGettingStartedPage {
  audience: string;
  description: string;
  keywords: string[];
  sections: DocsSection[];
  title: string;
}

type GettingStartedContent = Record<DocsGettingStartedSlug, LocalizedGettingStartedPage>;

const de: GettingStartedContent = {
  welcome: {
    title: 'Polity kennenlernen',
    description:
      'Ein Überblick darüber, wie Menschen in Polity zusammenarbeiten, Entscheidungen vorbereiten und Ergebnisse verfolgen.',
    audience: 'Neue Nutzer und Organisatoren, die Polity in wenigen Minuten einordnen möchten.',
    keywords: ['Überblick', 'Start', 'Plattform', 'Zusammenarbeit', 'Governance'],
    sections: [
      {
        id: 'was-ist-polity',
        title: 'Was ist Polity?',
        markdown:
          'Polity verbindet **Menschen, Gruppen, Veranstaltungen, Dokumente und Entscheidungen** in einem gemeinsamen Arbeitsraum. Öffentliche Seiten geben Orientierung. Nach der Anmeldung kommen persönliche Arbeitsbereiche, Mitgliedschaften und berechtigte Aktionen hinzu.',
      },
      {
        id: 'grundmodell',
        title: 'Das Grundmodell',
        markdown:
          '1. Menschen organisieren sich in **Gruppen**.\n2. Gruppen planen Arbeit und **Veranstaltungen**.\n3. Tagesordnungen, Dokumente und Amendments schaffen gemeinsamen Kontext.\n4. Diskussionen, Change Requests, Abstimmungen und Wahlen führen zu sichtbaren Ergebnissen.\n5. Suche, Timeline und Benachrichtigungen halten alle Beteiligten auf dem Laufenden.',
      },
      {
        id: 'oeffentlich-und-angemeldet',
        title: 'Öffentlich und angemeldet',
        markdown:
          'Ohne Konto kannst du Produktinformationen, Preise, Support, Dokumentation und freigegebene Inhalte öffnen. Angemeldet siehst du zusätzlich deine Gruppen, Nachrichten, Aufgaben, Kalenderdaten und Benachrichtigungen. Welche Aktionen verfügbar sind, hängt vom jeweiligen Raum und deinen Rollen ab.',
      },
      {
        id: 'naechste-schritte',
        title: 'Deine nächsten Schritte',
        markdown:
          '- Richte unter **Konto, Profil und Einstieg** deinen Zugang ein.\n- Lerne unter **Navigation und Orientierung**, wie du dich sicher bewegst.\n- Öffne anschließend den passenden Lernpfad für Gruppenarbeit, Organisation oder Entscheidungen.',
      },
    ],
  },
  'account-and-profile': {
    title: 'Konto, Profil und Einstieg',
    description:
      'Konto erstellen, Zugang bestätigen, Profil vervollständigen und den persönlichen Arbeitsbereich vorbereiten.',
    audience: 'Neue Nutzer, eingeladene Mitglieder und Personen mit Zugangsproblemen.',
    keywords: ['Registrierung', 'Login', 'Profil', 'Verifizierung', 'Passwort', 'Onboarding'],
    sections: [
      {
        id: 'zugang-waehlen',
        title: 'Den passenden Zugang wählen',
        markdown:
          'Öffne **Anmelden**, wenn bereits ein Konto besteht, oder **Registrieren**, um ein neues Konto anzulegen. Folge bei einer Einladung dem enthaltenen Link. Mit **Passwort vergessen** startest du einen geschützten Wiederherstellungsprozess.',
      },
      {
        id: 'konto-bestaetigen',
        title: 'Konto bestätigen',
        markdown:
          'Prüfe nach der Registrierung dein E-Mail-Postfach und schließe die Verifizierung im selben Browser ab. Abgelaufene Links lassen sich durch einen neuen Code ersetzen. Nach erfolgreicher Bestätigung führt Polity in den geschützten Arbeitsbereich.',
      },
      {
        id: 'profil-einrichten',
        title: 'Profil einrichten',
        markdown:
          'Ergänze Namen und Profilbild und prüfe Sprache sowie Theme. Ein vollständiges Profil hilft anderen, deine Beiträge in Gruppen, Diskussionen und Entscheidungen einzuordnen.',
      },
      {
        id: 'erster-arbeitsbereich',
        title: 'Im Arbeitsbereich ankommen',
        markdown:
          'Öffne zuerst **Startseite**, **Gruppen** beziehungsweise dein Profil und prüfe vorhandene Mitgliedschaften. Nachrichten, Kalender, Aufgaben und Benachrichtigungen werden relevanter, sobald du aktiven Räumen angehörst.',
      },
      {
        id: 'abbildung',
        title: 'Der öffentliche Einstieg',
        markdown:
          '![Die öffentliche Anmeldung zeigt die Wege zum Einloggen, Registrieren und Wiederherstellen eines Zugangs.](/docs/images/account-entry.png)\n\n*Alle Zugangswege starten öffentlich. Persönliche Daten und geschützte Aktionen werden erst nach einer gültigen Sitzung geladen.*',
      },
      {
        id: 'probleme',
        title: 'Wenn der Einstieg nicht gelingt',
        markdown:
          '- Prüfe, ob Konto und E-Mail-Adresse bestätigt sind.\n- Fordere bei einem abgelaufenen Link einen neuen an.\n- Öffne den Link nicht parallel in mehreren Browsern.\n- Melde dich ab und erneut an, wenn alte Sitzungsdaten angezeigt werden.',
      },
    ],
  },
  'navigation-and-orientation': {
    title: 'Navigation und Orientierung',
    description:
      'Öffentliche und angemeldete Navigation verstehen und auf jeder Seite den aktuellen Kontext erkennen.',
    audience:
      'Alle Nutzer, die Polity zum ersten Mal öffnen oder zwischen mehreren Räumen wechseln.',
    keywords: ['Navigation', 'Menü', 'Tabs', 'mobil', 'Kontext', 'Befehlspalette'],
    sections: [
      {
        id: 'oeffentliche-navigation',
        title: 'Öffentliche Navigation',
        markdown:
          'Ohne Anmeldung führt die Hauptnavigation zu **Start**, **Docs**, **Preise**, **Support** und **Anmelden**. Freigegebene Gruppen-, Veranstaltungs- und Amendment-Seiten können zusätzlich eine kontextbezogene Navigation anzeigen.',
      },
      {
        id: 'app-navigation',
        title: 'Navigation nach der Anmeldung',
        markdown:
          'Die App-Hauptnavigation öffnet Startseite, Nachrichten, Suche, Erstellen, Kalender, Aufgaben und Benachrichtigungen. Profil, Einstellungen, deine Räume sowie **Dokumentation & Feedback** findest du im Nutzermenü am Avatar.',
      },
      {
        id: 'primaer-und-sekundaer',
        title: 'Primär, sekundär und seitenintern',
        markdown:
          '**Primärnavigation** wechselt den globalen Arbeitsbereich. **Sekundärnavigation** wechselt zwischen Tabs einer Gruppe, Veranstaltung oder eines Amendments. Eine seiteninterne Navigation – wie in diesen Docs – gliedert den Inhalt der aktuellen Seite.',
      },
      {
        id: 'seitenkontext',
        title: 'Den Seitenkontext lesen',
        markdown:
          'Breadcrumbs und Seitentitel zeigen, in welchem Raum du arbeitest. Markierte Navigationseinträge zeigen den aktiven Bereich. Rechte Seitenleisten oder Inhaltsverzeichnisse erklären verwandte Inhalte, ohne den aktuellen Raum zu wechseln.',
      },
      {
        id: 'abbildungen',
        title: 'Öffentlich und angemeldet im Vergleich',
        markdown:
          '![Die öffentliche Navigation enthält Produktseiten, Dokumentation und Anmeldung.](/docs/images/public-navigation.png)\n\n*Öffentliche Navigation dient der Orientierung und dem Zugang zu freigegebenen Inhalten.*\n\n![Die App-Navigation enthält persönliche Arbeitsbereiche; Dokumentation und Feedback liegen im Nutzermenü.](/docs/images/app-navigation.png)\n\n*Nach der Anmeldung stehen persönliche Bereiche und kontextbezogene Tabs im Vordergrund.*',
      },
      {
        id: 'mobil-und-tastatur',
        title: 'Mobil und mit Tastatur navigieren',
        markdown:
          'Auf kleinen Bildschirmen werden globale und kontextbezogene Navigation kompakter dargestellt. In den Docs öffnet **/** die Suche. Pfeiltasten wählen Treffer, **Enter** öffnet eine Seite und **Escape** schließt die Suche oder mobile Navigation.',
      },
    ],
  },
  'collaborate-in-a-group': {
    title: 'In einer Gruppe mitarbeiten',
    description:
      'Eine Gruppe öffnen, den Arbeitskontext verstehen und an laufender Arbeit teilnehmen.',
    audience: 'Mitglieder, eingeladene Personen und interessierte Nutzer öffentlicher Gruppen.',
    keywords: ['Gruppe', 'Mitgliedschaft', 'Dokumente', 'Events', 'Zusammenarbeit'],
    sections: [
      {
        id: 'gruppe-finden',
        title: 'Eine Gruppe finden',
        markdown:
          'Nutze die globale Suche oder öffne eine Gruppe aus deinem Nutzermenü. Öffentliche Gruppen können auch über einen direkten Link erreichbar sein. Der Gruppenüberblick erklärt Zweck, Beziehungen und aktuelle Arbeit.',
      },
      {
        id: 'tabs-verstehen',
        title: 'Die Gruppenseiten verstehen',
        markdown:
          'Je nach Mitgliedschaft und Rechten erscheinen **Überblick**, **Betrieb**, **Veranstaltungen**, **Amendments**, **Blogs & Stellungnahmen**, **Netzwerk**, **Dokumente**, **Mitglieder**, **Benachrichtigungen** und **Einstellungen**.',
      },
      {
        id: 'mitarbeiten',
        title: 'An Arbeit teilnehmen',
        markdown:
          'Öffne zuerst den relevanten Inhalt und prüfe Status sowie Verantwortliche. Nutze Diskussionen für Kontext, Dokumente für gemeinsames Schreiben, Aufgaben für Nachverfolgung und Veranstaltungen für zeitgebundene Zusammenarbeit.',
      },
      {
        id: 'abbildung',
        title: 'Beispiel eines Gruppenraums',
        markdown:
          '![Ein Gruppenraum verbindet Überblick, Veranstaltungen, Amendments, Veröffentlichungen und Netzwerk.](/docs/images/group-workspace.png)\n\n*Welche Tabs und Aktionen sichtbar sind, wird aus Mitgliedschaft, Rolle und den Rechten im aktuellen Gruppenraum abgeleitet.*',
      },
      {
        id: 'sicher-arbeiten',
        title: 'Sicher im richtigen Kontext arbeiten',
        markdown:
          'Prüfe vor dem Erstellen oder Bearbeiten immer Gruppenname, Breadcrumb und aktiven Tab. Dieselbe Person kann in verschiedenen Gruppen unterschiedliche Rollen besitzen.',
      },
    ],
  },
  'organize-group-and-event': {
    title: 'Gruppe und Veranstaltung organisieren',
    description:
      'Einen Arbeitsraum vorbereiten, Rollen vergeben und eine Veranstaltung mit Agenda veröffentlichen.',
    audience: 'Organisatoren und Nutzer mit Erstellungs- oder Verwaltungsrechten.',
    keywords: ['organisieren', 'Gruppe erstellen', 'Event erstellen', 'Agenda', 'Rollen'],
    sections: [
      {
        id: 'voraussetzungen',
        title: 'Voraussetzungen prüfen',
        markdown:
          'Du benötigst eine gültige Sitzung und die passenden Erstellungs- oder Verwaltungsrechte. Entscheide vorab, welcher Gruppe die Veranstaltung gehört und welche Sichtbarkeit benötigt wird.',
      },
      {
        id: 'gruppe-vorbereiten',
        title: 'Gruppe vorbereiten',
        markdown:
          'Lege Name, Beschreibung und Sichtbarkeit fest. Ergänze Rollen und Rechte so sparsam wie möglich und lade anschließend Mitglieder ein. Prüfe im Netzwerk-Tab, wie die Gruppe mit anderen Räumen verbunden ist.',
      },
      {
        id: 'veranstaltung-erstellen',
        title: 'Veranstaltung erstellen',
        markdown:
          'Öffne **Erstellen → Veranstaltung**, wähle den Gruppenbezug und ergänze Titel, Zeit, Ort beziehungsweise Online-Link sowie Sichtbarkeit. Nach dem Veröffentlichen kannst du Teilnehmende, Rollen und Agenda verwalten.',
      },
      {
        id: 'agenda-vorbereiten',
        title: 'Agenda vorbereiten',
        markdown:
          'Ordne Tagesordnungspunkte in der geplanten Reihenfolge an. Kennzeichne, ob ein Punkt Diskussion, Rede, Abstimmung, Wahl oder Akkreditierung ist. Verknüpfe Amendments und Dokumente, damit Teilnehmende den Kontext vorab prüfen können.',
      },
      {
        id: 'vor-veroeffentlichung',
        title: 'Vor der Veröffentlichung',
        markdown:
          '- Sichtbarkeit und Zielgruppe prüfen.\n- Zeit, Zeitzone und Ort kontrollieren.\n- Rollen sowie Verantwortliche testen.\n- Agenda und verknüpfte Inhalte aus Sicht eines normalen Mitglieds öffnen.',
      },
    ],
  },
  'follow-a-decision': {
    title: 'Einen Entscheidungsprozess begleiten',
    description:
      'Vom Vorschlag über Beratung und Abstimmung bis zum veröffentlichten Ergebnis navigieren.',
    audience: 'Mitglieder, Antragstellende, Moderatoren und Organisatoren.',
    keywords: ['Entscheidung', 'Amendment', 'Abstimmung', 'Wahl', 'Ergebnis'],
    sections: [
      {
        id: 'kontext-oeffnen',
        title: 'Den Entscheidungskontext öffnen',
        markdown:
          'Beginne bei Veranstaltung und Agenda. Öffne den relevanten Tagesordnungspunkt und prüfe verknüpfte Amendments, Dokumente, Diskussionen und den aktuellen Status.',
      },
      {
        id: 'vorschlag-pruefen',
        title: 'Vorschlag und Änderungen prüfen',
        markdown:
          'Lies Zusammenfassung und Volltext. Change Requests zeigen konkrete Änderungsvorschläge, Diskussionen sammeln Begründungen und Rückfragen. Rollen bestimmen, wer Änderungen einreichen, moderieren oder zur Entscheidung stellen darf.',
      },
      {
        id: 'entscheidung-verfolgen',
        title: 'Abstimmung oder Wahl verfolgen',
        markdown:
          'Prüfe Frage, Optionen, Frist und Teilnahmeberechtigung. Während einer laufenden Entscheidung zeigt das Decision Terminal aktive Punkte. Nach dem Abschluss ist das veröffentlichte Ergebnis maßgeblich.',
      },
      {
        id: 'abbildung',
        title: 'Vom Agenda-Punkt zum Ergebnis',
        markdown:
          '![Eine Veranstaltungsagenda führt von Beratung und Amendment zur Abstimmung und zum sichtbaren Ergebnis.](/docs/images/decision-workflow.png)\n\n*Polity hält Vorschlag, Beratung, formale Entscheidung und Ergebnis als verbundenen Verlauf nachvollziehbar.*',
      },
      {
        id: 'nachbereitung',
        title: 'Nach der Entscheidung',
        markdown:
          'Prüfe, ob das Ergebnis am Amendment und Agenda-Punkt sichtbar ist. Folge dem Raum oder aktiviere Benachrichtigungen, wenn Umsetzung und Folgeaufgaben weiter beobachtet werden sollen.',
      },
    ],
  },
};

const en: GettingStartedContent = {
  welcome: {
    title: 'Get to know Polity',
    description:
      'An overview of how people collaborate, prepare decisions, and follow outcomes in Polity.',
    audience: 'New users and organizers who want to understand Polity in a few minutes.',
    keywords: ['overview', 'start', 'platform', 'collaboration', 'governance'],
    sections: [
      {
        id: 'was-ist-polity',
        title: 'What is Polity?',
        markdown:
          'Polity connects **people, groups, events, documents, and decisions** in one workspace. Public pages provide orientation. After signing in, personal work areas, memberships, and authorized actions become available.',
      },
      {
        id: 'grundmodell',
        title: 'The core model',
        markdown:
          '1. People organize in **groups**.\n2. Groups plan work and **events**.\n3. Agendas, documents, and amendments create shared context.\n4. Discussions, change requests, votes, and elections lead to visible outcomes.\n5. Search, timeline, and notifications keep participants informed.',
      },
      {
        id: 'oeffentlich-und-angemeldet',
        title: 'Public and signed in',
        markdown:
          'Without an account, you can open product information, pricing, support, docs, and shared content. Signed in, you also see your groups, messages, tasks, calendar, and notifications. Available actions depend on the current space and your roles.',
      },
      {
        id: 'naechste-schritte',
        title: 'Your next steps',
        markdown:
          '- Prepare your access under **Account, profile, and entry**.\n- Learn how to move safely under **Navigation and orientation**.\n- Continue with the learning path for group work, organizing, or decisions.',
      },
    ],
  },
  'account-and-profile': {
    title: 'Account, profile, and entry',
    description:
      'Create an account, confirm access, complete your profile, and prepare your personal workspace.',
    audience: 'New users, invited members, and anyone resolving access issues.',
    keywords: ['sign up', 'login', 'profile', 'verification', 'password', 'onboarding'],
    sections: [
      {
        id: 'zugang-waehlen',
        title: 'Choose the right entry',
        markdown:
          'Open **Sign in** if you already have an account or **Sign up** to create one. Follow the provided link when invited. **Forgot password** starts a protected recovery flow.',
      },
      {
        id: 'konto-bestaetigen',
        title: 'Confirm the account',
        markdown:
          'Check your inbox after signing up and complete verification in the same browser. Expired links can be replaced with a new code. After confirmation, Polity opens the protected workspace.',
      },
      {
        id: 'profil-einrichten',
        title: 'Set up the profile',
        markdown:
          'Add your name and profile image, then review language and theme. A complete profile helps others understand your contributions in groups, discussions, and decisions.',
      },
      {
        id: 'erster-arbeitsbereich',
        title: 'Arrive in the workspace',
        markdown:
          'Start with **Home**, **Groups**, or your profile and review existing memberships. Messages, calendar, tasks, and notifications become more useful once you belong to active spaces.',
      },
      {
        id: 'abbildung',
        title: 'The public entry',
        markdown:
          '![The public authentication page shows paths for signing in, signing up, and recovering access.](/docs/images/account-entry.png)\n\n*All entry flows begin publicly. Personal data and protected actions load only after a valid session exists.*',
      },
      {
        id: 'probleme',
        title: 'When entry does not work',
        markdown:
          '- Check whether the account and email address are confirmed.\n- Request a new link if the previous one expired.\n- Do not open the same link in several browsers.\n- Sign out and in again when stale session data appears.',
      },
    ],
  },
  'navigation-and-orientation': {
    title: 'Navigation and orientation',
    description:
      'Understand public and authenticated navigation and recognize the current context on every page.',
    audience: 'Anyone opening Polity for the first time or moving between several spaces.',
    keywords: ['navigation', 'menu', 'tabs', 'mobile', 'context', 'command palette'],
    sections: [
      {
        id: 'oeffentliche-navigation',
        title: 'Public navigation',
        markdown:
          'Without signing in, the main navigation leads to **Home**, **Docs**, **Pricing**, **Support**, and **Sign in**. Shared group, event, and amendment pages may additionally show contextual navigation.',
      },
      {
        id: 'app-navigation',
        title: 'Navigation after signing in',
        markdown:
          'The app main navigation opens Home, Messages, Search, Create, Calendar, Tasks, and Notifications. Your profile, settings, spaces, and **Documentation & Feedback** are available from the avatar user menu.',
      },
      {
        id: 'primaer-und-sekundaer',
        title: 'Primary, secondary, and in-page',
        markdown:
          '**Primary navigation** switches the global work area. **Secondary navigation** switches between tabs of a group, event, or amendment. In-page navigation—like the one in these docs—organizes the current page.',
      },
      {
        id: 'seitenkontext',
        title: 'Read the page context',
        markdown:
          'Breadcrumbs and page titles show which space you are working in. Highlighted navigation items identify the active area. Sidebars and tables of contents explain related content without changing the current space.',
      },
      {
        id: 'abbildungen',
        title: 'Public and signed-in comparison',
        markdown:
          '![Public navigation contains product pages, documentation, and authentication.](/docs/images/public-navigation.png)\n\n*Public navigation focuses on orientation and access to shared information.*\n\n![App navigation contains personal work areas; documentation and feedback are in the user menu.](/docs/images/app-navigation.png)\n\n*After signing in, personal areas and contextual tabs take priority.*',
      },
      {
        id: 'mobil-und-tastatur',
        title: 'Navigate on mobile and by keyboard',
        markdown:
          'On smaller screens, global and contextual navigation become more compact. In the docs, **/** opens search. Arrow keys select a result, **Enter** opens it, and **Escape** closes search or mobile navigation.',
      },
    ],
  },
  'collaborate-in-a-group': {
    title: 'Collaborate in a group',
    description: 'Open a group, understand its context, and participate in ongoing work.',
    audience: 'Members, invited people, and visitors to public groups.',
    keywords: ['group', 'membership', 'documents', 'events', 'collaboration'],
    sections: [
      {
        id: 'gruppe-finden',
        title: 'Find a group',
        markdown:
          'Use global search or open a group from your user menu. Public groups may also be available through a direct link. The group overview explains its purpose, relationships, and current work.',
      },
      {
        id: 'tabs-verstehen',
        title: 'Understand group pages',
        markdown:
          'Depending on membership and rights, you may see **Overview**, **Operations**, **Events**, **Amendments**, **Blogs & statements**, **Network**, **Documents**, **Members**, **Notifications**, and **Settings**.',
      },
      {
        id: 'mitarbeiten',
        title: 'Participate in work',
        markdown:
          'Open the relevant item first and review its status and owners. Use discussions for context, documents for collaborative writing, tasks for follow-through, and events for time-bound collaboration.',
      },
      {
        id: 'abbildung',
        title: 'Example group workspace',
        markdown:
          '![A group workspace connects overview, events, amendments, publications, and network.](/docs/images/group-workspace.png)\n\n*Visible tabs and actions are derived from membership, role, and rights in the current group space.*',
      },
      {
        id: 'sicher-arbeiten',
        title: 'Work safely in the right context',
        markdown:
          'Before creating or editing, check the group name, breadcrumb, and active tab. The same person can have different roles in different groups.',
      },
    ],
  },
  'organize-group-and-event': {
    title: 'Organize a group and event',
    description: 'Prepare a workspace, assign roles, and publish an event with an agenda.',
    audience: 'Organizers and users with creation or management rights.',
    keywords: ['organize', 'create group', 'create event', 'agenda', 'roles'],
    sections: [
      {
        id: 'voraussetzungen',
        title: 'Check prerequisites',
        markdown:
          'You need a valid session and the appropriate creation or management rights. Decide which group owns the event and which visibility level is required.',
      },
      {
        id: 'gruppe-vorbereiten',
        title: 'Prepare the group',
        markdown:
          'Set name, description, and visibility. Add roles and rights as sparingly as possible, then invite members. Review the Network tab to understand how the group connects to other spaces.',
      },
      {
        id: 'veranstaltung-erstellen',
        title: 'Create an event',
        markdown:
          'Open **Create → Event**, choose the group context, and add title, time, location or online link, and visibility. After publishing, you can manage participants, roles, and agenda.',
      },
      {
        id: 'agenda-vorbereiten',
        title: 'Prepare the agenda',
        markdown:
          'Order agenda items as planned. Identify whether an item is a discussion, speech, vote, election, or accreditation. Link amendments and documents so participants can review context in advance.',
      },
      {
        id: 'vor-veroeffentlichung',
        title: 'Before publishing',
        markdown:
          '- Review visibility and audience.\n- Check time, time zone, and location.\n- Test roles and owners.\n- Open the agenda and linked content as a regular member.',
      },
    ],
  },
  'follow-a-decision': {
    title: 'Follow a decision process',
    description:
      'Navigate from a proposal through deliberation and voting to the published outcome.',
    audience: 'Members, proposers, moderators, and organizers.',
    keywords: ['decision', 'amendment', 'vote', 'election', 'outcome'],
    sections: [
      {
        id: 'kontext-oeffnen',
        title: 'Open the decision context',
        markdown:
          'Start with the event and agenda. Open the relevant agenda item and review linked amendments, documents, discussions, and current status.',
      },
      {
        id: 'vorschlag-pruefen',
        title: 'Review the proposal and changes',
        markdown:
          'Read the summary and full text. Change requests show concrete edits while discussions collect reasoning and questions. Roles determine who may submit, moderate, or move changes to a decision.',
      },
      {
        id: 'entscheidung-verfolgen',
        title: 'Follow a vote or election',
        markdown:
          'Review the question, options, deadline, and eligibility. During an active decision, the Decision Terminal surfaces live items. After closure, the published outcome is authoritative.',
      },
      {
        id: 'abbildung',
        title: 'From agenda item to outcome',
        markdown:
          '![An event agenda leads from deliberation and amendment to voting and a visible outcome.](/docs/images/decision-workflow.png)\n\n*Polity preserves proposal, deliberation, formal decision, and outcome as a connected history.*',
      },
      {
        id: 'nachbereitung',
        title: 'After the decision',
        markdown:
          'Check that the outcome is visible on the amendment and agenda item. Follow the space or enable notifications when implementation and follow-up work should remain visible.',
      },
    ],
  },
};

export const gettingStartedContent: Record<DocsLanguage, GettingStartedContent> = { de, en };
