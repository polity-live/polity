import { studioTranslations } from './features/studio';
import type { DeepReplace } from '@/i18n/i18n.types.ts';

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

const baseEnTranslation = {
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
      publish: 'Publish draft',
      verifiedRead: 'Last verified version: revision {{revision}}. Editing is blocked.',
      repair: 'Restore verified version',
      proposalTitle: 'Change request',
      submitted: 'Submitted',
      accept: 'Accept',
      reject: 'Reject',
      previewChanged:
        'The preview shows the submitted version. The main document has changed since submission.',
      conflictNotice: 'Application conflict: {{reason}}. The decision remains unchanged.',
      retryDecision: 'Retry applying the decision',
      newProposal: 'Draft a new change request',
      waiting: 'Waiting for server confirmation …',
      compareLocal: 'Compare local draft {{number}}',
      resumeTitle: 'Resume as a new private draft',
      original: 'Original version',
      local: 'Local draft',
      server: 'Current server version',
      resume: 'Resume as a new draft',
      close: 'Close',
      rebase: 'Rebase draft onto the current main document',
      history: 'Saved versions',
      loadHistory: 'Load versions',
      revision: 'Revision {{revision}} · {{reason}}',
      restore: 'Restore as a new generation',
      applicationConflict:
        'Decision recorded. Applying it to the text remains blocked by a conflict.',
      workspace: 'Workspace',
      main: 'Main document',
      draft: 'Draft',
      share: 'Share with eligible collaborators',
      unshare: 'Make draft private',
      recover: 'Download earlier local draft',
      submit: 'Submit change request',
      createDraft: 'Create a separate follow-up draft',
      reconnect: 'Reconnect; keep local draft',
      status: {
        loading: 'Connecting document …',
        syncing: 'Saving changes …',
        saved: 'Confirmed saved',
        offline: 'Offline — changes are only saved locally',
        maintenance: 'Migration in progress. Editing and voting are paused.',
        recovery: 'Access or the document generation changed. Your local draft has been retained.',
        error: 'Could not establish a connection.',
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
const enTranslation = mergeTranslations(generatedTranslations, baseEnTranslation);

export default enTranslation;

export type I18nLocale = DeepReplace<typeof enTranslation, [string, string]>;
