import { docsPageTranslations as deDocsContent } from '../content/legacy/de';
import { docsPageTranslations as enDocsContent } from '../content/legacy/en';
import { gettingStartedContent } from '../content/gettingStarted';
import { docsTopicDefinitions } from './docsTopics';
import type {
  DocsCategory,
  DocsGettingStartedSlug,
  DocsGuideSlug,
  DocsLanguage,
  DocsNavigationGroup,
  DocsPage,
  DocsPageSlug,
  DocsSection,
  DocsTopicSlug,
} from '../types/docs.types';

const docsLanguages: DocsLanguage[] = ['de', 'en'];
const categoryOrder: DocsCategory[] = [
  'people',
  'collaboration',
  'governance',
  'coordination',
  'systems',
];
const gettingStartedOrder: DocsGettingStartedSlug[] = [
  'welcome',
  'account-and-profile',
  'navigation-and-orientation',
  'collaborate-in-a-group',
  'organize-group-and-event',
  'follow-a-decision',
];

const topicLocations: Record<DocsTopicSlug, string[]> = {
  'auth-and-onboarding': ['/auth', '/auth/sign-in', '/auth/sign-up'],
  users: ['/user/:id', '/user/:id/settings', '/user/:id/memberships'],
  groups: ['/group/:id'],
  events: ['/event/:id'],
  agendas: ['/event/:id/agenda', '/event/:id/agenda/:agendaItemId'],
  amendments: ['/amendment/:id', '/amendment/:id/text'],
  'documents-and-editor': ['/group/:id/editor', '/group/:id/editor/:docId'],
  'change-requests-and-discussions': [
    '/amendment/:id/change-requests',
    '/amendment/:id/discussions',
  ],
  blogs: ['/group/:id/blogs-and-statements', '/user/:id/blog'],
  statements: ['/statement/:id', '/group/:id/blogs-and-statements'],
  elections: ['/event/:id/agenda/:agendaItemId'],
  votes: ['/event/:id/agenda/:agendaItemId'],
  'decision-terminal': ['/home'],
  timeline: ['/home'],
  search: ['/search'],
  messages: ['/messages'],
  notifications: ['/notifications'],
  'pwa-and-notifications': ['/home'],
  calendar: ['/calendar'],
  todos: ['/todos', '/todos/:id'],
  'create-workflows': ['/create'],
  'subscriptions-and-payments': ['/user/:id/subscriptions', '/create/payment'],
  'ai-assistant': ['/messages'],
  'pql-and-filters': ['/search', '/todos', '/user/:id/subscriptions'],
  meetings: ['/user/:id/meet'],
  'roles-and-rights': ['/event/:id/roles', '/group/:id/settings'],
  'networks-and-forwarding': ['/group/:id/network', '/event/:id/network'],
};

const starterRelated: Record<DocsGettingStartedSlug, DocsPageSlug[]> = {
  welcome: ['account-and-profile', 'navigation-and-orientation'],
  'account-and-profile': ['auth-and-onboarding', 'users'],
  'navigation-and-orientation': ['navigation-and-page-structure', 'search'],
  'collaborate-in-a-group': ['groups', 'documents-and-editor', 'messages'],
  'organize-group-and-event': ['create-workflows', 'groups', 'events', 'agendas'],
  'follow-a-decision': ['amendments', 'change-requests-and-discussions', 'votes'],
};

const navigationGuideSections: Record<DocsLanguage, DocsSection[]> = {
  de: [
    {
      id: 'navigationsebenen',
      title: 'Die Navigationsebenen',
      markdown:
        'Polity trennt globale Arbeitsbereiche, den Kontext eines Raums und den Inhalt einer Seite. So bleibt erkennbar, ob eine Aktion die gesamte App, eine Gruppe beziehungsweise Veranstaltung oder nur den aktuellen Artikel betrifft.',
      keywords: ['primär', 'sekundär', 'Seitenleiste'],
    },
    {
      id: 'oeffentlicher-bereich',
      title: 'Navigation ohne Anmeldung',
      markdown:
        'Die öffentliche Hauptnavigation enthält **Start**, **Docs**, **Preise**, **Support** und **Anmelden**. Auf freigegebenen Gruppen, Veranstaltungen, Blogs, Profilen und Amendments kann eine zweite Navigation die öffentlich lesbaren Unterseiten des aktuellen Raums zeigen.',
    },
    {
      id: 'angemeldeter-bereich',
      title: 'Navigation nach der Anmeldung',
      markdown:
        'Die App-Hauptnavigation führt zu **Startseite**, **Nachrichten**, **Suche**, **Erstellen**, **Kalender**, **Aufgaben** und **Benachrichtigungen**. Das Avatar-Menü öffnet Profil, Einstellungen, eigene Räume sowie **Dokumentation & Hilfe**.',
    },
    {
      id: 'entity-kontexte',
      title: 'Gruppen-, Event- und Amendment-Kontexte',
      markdown:
        'Sekundäre Einträge gehören immer zum aktuellen Raum. Eine Gruppe kann etwa Veranstaltungen, Amendments, Veröffentlichungen, Netzwerk und Dokumente enthalten. Eine Veranstaltung besitzt Agenda, Teilnehmende und Einstellungen. Ein Amendment verbindet Überblick, Volltext, Change Requests, Diskussionen und Prozess.',
    },
    {
      id: 'aktive-seite',
      title: 'Aktive Seite und Breadcrumbs',
      markdown:
        'Der markierte Navigationseintrag, Seitentitel und Breadcrumb zeigen gemeinsam den aktuellen Ort. Prüfe diese drei Signale vor Änderungen – besonders wenn du in mehreren Gruppen ähnliche Inhalte geöffnet hast.',
    },
    {
      id: 'darstellungen',
      title: 'Darstellungen und mobile Navigation',
      markdown:
        'Je nach Einstellung erscheint Navigation als einzelner Button, Icon-Liste oder beschriftete Liste. Auf Mobilgeräten liegen globale und kontextbezogene Navigation an den Bildschirmrändern. Inhalt und Rechte bleiben in allen Darstellungen gleich.',
    },
    {
      id: 'docs-navigation',
      title: 'Navigation in den Docs',
      markdown:
        'Die Docs verwenden eine eigene linke Seitenleiste. Rechts zeigt das Inhaltsverzeichnis die Abschnitte der aktuellen Seite. Die zentrale Suche durchsucht alle Spracheninhalte der gewählten Sprache und öffnet Treffer direkt am passenden Abschnitt.',
    },
  ],
  en: [
    {
      id: 'navigationsebenen',
      title: 'Navigation levels',
      markdown:
        'Polity separates global work areas, the context of a space, and the content of a page. This makes it clear whether an action affects the whole app, a group or event, or only the current article.',
      keywords: ['primary', 'secondary', 'sidebar'],
    },
    {
      id: 'oeffentlicher-bereich',
      title: 'Navigation without signing in',
      markdown:
        'The public main navigation contains **Home**, **Docs**, **Pricing**, **Support**, and **Sign in**. Shared groups, events, blogs, profiles, and amendments may show a second navigation for publicly readable pages of the current space.',
    },
    {
      id: 'angemeldeter-bereich',
      title: 'Navigation after signing in',
      markdown:
        'The app main navigation leads to **Home**, **Messages**, **Search**, **Create**, **Calendar**, **Tasks**, and **Notifications**. The avatar menu opens profile, settings, your spaces, and **Documentation & help**.',
    },
    {
      id: 'entity-kontexte',
      title: 'Group, event, and amendment contexts',
      markdown:
        'Secondary items always belong to the current space. A group can contain events, amendments, publications, network, and documents. An event has agenda, participants, and settings. An amendment connects overview, full text, change requests, discussions, and process.',
    },
    {
      id: 'aktive-seite',
      title: 'Active page and breadcrumbs',
      markdown:
        'The highlighted navigation item, page title, and breadcrumb identify the current location together. Check all three before making changes, especially when similar content is open in several groups.',
    },
    {
      id: 'darstellungen',
      title: 'Views and mobile navigation',
      markdown:
        'Depending on preferences, navigation appears as a single button, icon list, or labeled list. On mobile, global and contextual navigation sit at the screen edges. Content and rights stay the same in every view.',
    },
    {
      id: 'docs-navigation',
      title: 'Navigation in the docs',
      markdown:
        'The docs use their own left sidebar. On the right, the table of contents lists sections of the current page. Central search covers all documentation in the selected language and opens a result at the matching section.',
    },
  ],
};

type LegacyContent = typeof enDocsContent;
type LegacyTopic = LegacyContent['topics'][DocsTopicSlug];

const contentByLanguage: Record<DocsLanguage, LegacyContent> = {
  de: deDocsContent as unknown as LegacyContent,
  en: enDocsContent,
};

const uiText = {
  de: {
    audience: 'Für wen',
    entry: 'Bester Einstieg',
    outcome: 'Ergebnis',
    overview: 'Überblick',
    find: 'Wo du das findest',
    findIntro: 'Diese Funktion ist typischerweise über folgende Bereiche erreichbar:',
    workflow: 'Typischer Ablauf',
    actions: 'Was du tun kannst',
    concepts: 'Konzepte, Rollen und Rechte',
    states: 'Zustände und Signale',
    trouble: 'Häufige Probleme und Hinweise',
  },
  en: {
    audience: 'For whom',
    entry: 'Best entry',
    outcome: 'Outcome',
    overview: 'Overview',
    find: 'Where to find it',
    findIntro: 'This feature is typically available through these areas:',
    workflow: 'Typical workflow',
    actions: 'What you can do',
    concepts: 'Concepts, roles, and rights',
    states: 'States and signals',
    trouble: 'Common issues and guidance',
  },
} as const;

function bulletList(items: readonly string[]): string {
  return items.map(item => `- ${item}`).join('\n');
}

function orderedList(items: readonly string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function buildWorkflow(topic: LegacyTopic): string {
  const steps = topic.diagram.steps as Record<string, { description: string; title: string }>;
  return orderedList(Object.values(steps).map(step => `**${step.title}:** ${step.description}`));
}

function buildTopicSections(
  language: DocsLanguage,
  slug: DocsTopicSlug,
  topic: LegacyTopic
): DocsSection[] {
  const labels = uiText[language];
  return [
    {
      id: 'overview',
      title: labels.overview,
      markdown: `${topic.summary}\n\n**${labels.audience}:** ${topic.audience}\n\n**${labels.entry}:** ${topic.entry}\n\n${topic.perspective}`,
    },
    {
      id: 'find-it',
      title: labels.find,
      markdown: `${labels.findIntro}\n\n${bulletList(topicLocations[slug].map(path => `\`${path}\``))}`,
      keywords: topicLocations[slug],
    },
    {
      id: 'workflow',
      title: labels.workflow,
      markdown: `${topic.diagram.description}\n\n${buildWorkflow(topic)}`,
    },
    {
      id: 'actions',
      title: labels.actions,
      markdown: bulletList(topic.actions),
    },
    {
      id: 'concepts-and-rights',
      title: labels.concepts,
      markdown: bulletList(topic.concepts),
    },
    {
      id: 'states',
      title: labels.states,
      markdown: bulletList(topic.states),
    },
    {
      id: 'troubleshooting',
      title: labels.trouble,
      markdown: `${bulletList(topic.watchFor)}\n\n**${labels.outcome}:** ${topic.outcome}`,
    },
  ];
}

export function getDocsPageRoute(kind: 'getting-started' | 'guide', slug: DocsPageSlug): string {
  return kind === 'getting-started' ? `/docs/getting-started/${slug}` : `/docs/guides/${slug}`;
}

function buildPages(language: DocsLanguage): DocsPage[] {
  const localized = contentByLanguage[language];
  const starterPages: DocsPage[] = gettingStartedOrder.map((slug, index) => {
    const content = gettingStartedContent[language][slug];
    return {
      ...content,
      slug,
      kind: 'getting-started',
      category: 'getting-started',
      icon: index === 0 ? 'Sparkles' : index === 1 ? 'UserCheck' : index === 2 ? 'Map' : 'BookOpen',
      featured: true,
      order: index,
      related: starterRelated[slug],
      route: getDocsPageRoute('getting-started', slug),
    };
  });

  const guidePages: DocsPage[] = docsTopicDefinitions.map((definition, index) => {
    const topic = localized.topics[definition.slug] as LegacyTopic;
    return {
      slug: definition.slug,
      kind: 'guide',
      category: definition.category,
      icon: definition.icon,
      featured: definition.featured,
      order: index,
      related: definition.related,
      route: getDocsPageRoute('guide', definition.slug),
      title: topic.title,
      description: topic.summary,
      audience: topic.audience,
      keywords: [
        topic.navLabel,
        definition.slug,
        ...topic.concepts.slice(0, 3),
        ...topicLocations[definition.slug],
      ],
      sections: buildTopicSections(language, definition.slug, topic),
    };
  });

  const navigationGuide: DocsPage = {
    slug: 'navigation-and-page-structure',
    kind: 'guide',
    category: 'systems',
    icon: 'Map',
    featured: true,
    order: guidePages.length,
    related: ['navigation-and-orientation', 'search', 'roles-and-rights'],
    route: getDocsPageRoute('guide', 'navigation-and-page-structure'),
    title: language === 'de' ? 'Navigation und Seitenaufbau' : 'Navigation and page structure',
    description:
      language === 'de'
        ? 'Referenz für öffentliche Navigation, App-Bereiche, Entity-Kontexte und mobile Darstellungen.'
        : 'Reference for public navigation, app areas, entity contexts, and mobile views.',
    audience:
      language === 'de'
        ? 'Alle Nutzer und Organisatoren, die Seitenwege oder Navigationszustände nachvollziehen möchten.'
        : 'Users and organizers who need to understand page paths or navigation states.',
    keywords:
      language === 'de'
        ? ['Navigation', 'Hauptnavigation', 'Sekundärnavigation', 'Breadcrumb', 'Tabs', 'mobil']
        : ['navigation', 'main navigation', 'secondary navigation', 'breadcrumb', 'tabs', 'mobile'],
    sections: navigationGuideSections[language],
  };

  return [...starterPages, ...guidePages, navigationGuide];
}

const registryByLanguage: Record<DocsLanguage, DocsPage[]> = {
  de: buildPages('de'),
  en: buildPages('en'),
};

export const DOCS_PAGE_SLUGS = registryByLanguage.de.map(page => page.slug) as [
  DocsPageSlug,
  ...DocsPageSlug[],
];
export const DOCS_LANGUAGES = docsLanguages as [DocsLanguage, ...DocsLanguage[]];

export function getDocsPages(language: DocsLanguage = 'de'): DocsPage[] {
  return registryByLanguage[language];
}

export function getDocsPage(
  slug: string,
  language: DocsLanguage = 'de',
  kind?: 'getting-started' | 'guide'
): DocsPage | null {
  return (
    registryByLanguage[language].find(
      page => page.slug === slug && (kind === undefined || page.kind === kind)
    ) ?? null
  );
}

export function isDocsPageSlug(value: string): value is DocsPageSlug {
  return registryByLanguage.de.some(page => page.slug === value);
}

export function getDocsNavigation(language: DocsLanguage = 'de'): DocsNavigationGroup[] {
  const pages = getDocsPages(language);
  const localized = contentByLanguage[language];
  const starterDescription =
    language === 'de'
      ? 'Schritt für Schritt in Polity ankommen.'
      : 'Arrive in Polity step by step.';

  return [
    {
      id: 'getting-started',
      title: language === 'de' ? 'Erste Schritte' : 'Getting started',
      description: starterDescription,
      pages: pages.filter(page => page.kind === 'getting-started'),
    },
    ...categoryOrder.map(category => ({
      id: category,
      title: localized.categories[category].title,
      description: localized.categories[category].description,
      pages: pages.filter(page => page.kind === 'guide' && page.category === category),
    })),
  ];
}

export function getRelatedDocsPages(page: DocsPage, language: DocsLanguage): DocsPage[] {
  return page.related
    .map(slug => getDocsPage(slug, language))
    .filter((related): related is DocsPage => related !== null);
}

export function getLegacyTopicCanonicalRoute(slug: string): string | null {
  const page = getDocsPage(slug, 'de', 'guide');
  return page?.route ?? null;
}

export type { DocsGuideSlug };
