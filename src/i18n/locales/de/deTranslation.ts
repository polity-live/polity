import { studioTranslations } from './features/studio';
import type { I18nLocale } from '../en/enTranslation';

import { mergeTranslations } from '@/i18n/merge-translations.ts';

import { commonTranslations } from './common';
import { navigationTranslations } from './navigation';
import { agendasTranslations } from './features/agendas';
import { appTutorialTranslations } from './features/app-tutorial';
import { authTranslations } from './features/auth';
import { amendmentsTranslations } from './features/amendments';
import { blogsTranslations } from './features/blogs';
import { calendarTranslations } from './features/calendar';
import { changeRequestsTranslations } from './features/change-requests';
import { createTranslations } from './features/create';
import { decisionTerminalTranslations } from './features/decision-terminal';
import { delegatesTranslations } from './features/delegates';
import { discussionsTranslations } from './features/discussions';
import { documentsTranslations } from './features/documents';
import { editor as editorTranslations } from './features/editor';
import { electionsTranslations } from './features/elections';
import { eventsTranslations } from './features/events';
import { groupsTranslations } from './features/groups';
import { meetTranslations } from './features/meet';
import { messagesTranslations } from './features/messages';
import { networkTranslations } from './features/network';
import { notificationsTranslations } from './features/notifications';
import { paymentsTranslations } from './features/payments';
import { rolesTranslations } from './features/roles';
import { searchTranslations } from './features/search';
import { statementsTranslations } from './features/statements';
import { timelineTranslations } from './features/timeline';
import { todosTranslations } from './features/todos';
import { userTranslations } from './features/users';
import { votesTranslations } from './features/votes';
import { wikiTranslations } from './features/wiki';
import { landingSectionTranslations } from './pages/home/landing';
import { componentsTranslations } from './components';
import { generatedTranslations } from './generated';
import { plateJsTranslations } from './plateJs';
import { pagesTranslations } from './pages';

// Using I18nLocale type to ensure compatibility with English translations
const baseDeTranslation = {
  // Common/shared translations
  common: commonTranslations,
  loading: commonTranslations.loading,
  errors: commonTranslations.errors,

  // Navigation
  navigation: navigationTranslations,
  navigationDemo: navigationTranslations.demo,
  commandDialog: navigationTranslations.commandDialog,

  // Authentication
  auth: authTranslations,
  onboarding: authTranslations.onboarding,

  // Landing pages
  landing: {
    ...landingSectionTranslations,
    solutions: pagesTranslations.solutions,
    pricing: pagesTranslations.pricing,
  },

  // Shared components
  components: componentsTranslations,
  media: componentsTranslations.media,
  mediaUpload: componentsTranslations.mediaUpload,
  dateElement: componentsTranslations.dateElement,
  columnElement: componentsTranslations.columnElement,

  // PlateJS editor
  plateJs: plateJsTranslations,

  // Page-specific translations
  pages: pagesTranslations,

  // Feature-specific translations
  features: {
    collaboration: {
      publish: 'Entwurf veröffentlichen',
      verifiedRead: 'Letzte geprüfte Fassung: Revision {{revision}}. Bearbeitung gesperrt.',
      repair: 'Geprüfte Fassung wiederherstellen',
      proposalTitle: 'Änderungsantrag',
      submitted: 'Eingereicht',
      accept: 'Annehmen',
      reject: 'Ablehnen',
      previewChanged:
        'Die Vorschau zeigt die eingereichte Fassung. Der Haupttext hat sich inzwischen verändert.',
      conflictNotice: 'Anwendungskonflikt: {{reason}}. Die Entscheidung bleibt erhalten.',
      retryDecision: 'Anwendung erneut prüfen',
      newProposal: 'Neuen Änderungsantrag entwerfen',
      waiting: 'Serverbestätigung wird abgewartet …',
      compareLocal: 'Lokalen Entwurf {{number}} vergleichen',
      resumeTitle: 'Wiederaufnahme als neuer privater Entwurf',
      original: 'Ausgangsstand',
      local: 'Lokaler Entwurf',
      server: 'Aktueller Serverstand',
      resume: 'Als neuen Entwurf wiederaufnehmen',
      close: 'Schließen',
      rebase: 'Entwurf auf aktuellen Haupttext beziehen',
      history: 'Gespeicherte Fassungen',
      loadHistory: 'Fassungen laden',
      revision: 'Revision {{revision}} · {{reason}}',
      restore: 'Als neue Generation wiederherstellen',
      applicationConflict:
        'Entscheidung gespeichert. Die Anwendung auf den Text ist wegen eines Konflikts noch offen.',
      workspace: 'Arbeitsbereich',
      main: 'Hauptdokument',
      draft: 'Entwurf',
      share: 'Für berechtigte Mitwirkende freigeben',
      unshare: 'Entwurf privat machen',
      recover: 'Früheren lokalen Entwurf herunterladen',
      submit: 'Änderungsantrag verbindlich einreichen',
      createDraft: 'Separaten Folgeentwurf erstellen',
      reconnect: 'Neu verbinden; lokalen Entwurf behalten',
      status: {
        loading: 'Dokument wird verbunden …',
        syncing: 'Änderungen werden gespeichert …',
        saved: 'Verbindlich gespeichert',
        offline: 'Offline – Änderungen sind nur lokal gespeichert',
        maintenance: 'Umstellung läuft. Bearbeitung und Abstimmung sind pausiert.',
        recovery:
          'Zugriff oder Dokumentstand hat sich geändert. Dein lokaler Entwurf bleibt erhalten.',
        error: 'Verbindung konnte nicht hergestellt werden.',
      },
    },
    studio: studioTranslations,
    agendas: agendasTranslations,
    appTutorial: appTutorialTranslations,
    auth: authTranslations,
    amendments: amendmentsTranslations,
    blogs: blogsTranslations,
    calendar: calendarTranslations,
    changeRequests: changeRequestsTranslations,
    create: createTranslations,
    decisionTerminal: decisionTerminalTranslations,
    delegates: delegatesTranslations,
    discussions: discussionsTranslations,
    documents: documentsTranslations,
    editor: editorTranslations,
    elections: electionsTranslations,
    events: eventsTranslations,
    groups: groupsTranslations,
    meet: meetTranslations,
    messages: messagesTranslations,
    network: networkTranslations,
    notifications: notificationsTranslations,
    payments: paymentsTranslations,
    roles: rolesTranslations,
    search: searchTranslations,
    statements: statementsTranslations,
    timeline: timelineTranslations,
    todos: todosTranslations,
    user: userTranslations,
    votes: votesTranslations,
    wiki: wikiTranslations,
  },
} as const;

// Semantic locale modules are the maintained source of truth. The legacy
// generated catalog only fills gaps and must never overwrite reviewed copy.
const deTranslation: I18nLocale = mergeTranslations(generatedTranslations, baseDeTranslation);

export default deTranslation;
