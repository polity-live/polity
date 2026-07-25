import type { IconName } from '@/features/navigation/nav-items/icon-map.tsx';

export type DocsLanguage = 'de' | 'en';

export type DocsPageKind = 'getting-started' | 'guide';

export type DocsTopicSlug =
  | 'auth-and-onboarding'
  | 'users'
  | 'groups'
  | 'events'
  | 'agendas'
  | 'amendments'
  | 'documents-and-editor'
  | 'change-requests-and-discussions'
  | 'blogs'
  | 'statements'
  | 'elections'
  | 'votes'
  | 'decision-terminal'
  | 'timeline'
  | 'search'
  | 'messages'
  | 'notifications'
  | 'pwa-and-notifications'
  | 'calendar'
  | 'todos'
  | 'create-workflows'
  | 'subscriptions-and-payments'
  | 'ai-assistant'
  | 'pql-and-filters'
  | 'meetings'
  | 'roles-and-rights'
  | 'networks-and-forwarding';

export type DocsGettingStartedSlug =
  | 'welcome'
  | 'account-and-profile'
  | 'navigation-and-orientation'
  | 'collaborate-in-a-group'
  | 'organize-group-and-event'
  | 'follow-a-decision';

export type DocsGuideSlug = DocsTopicSlug | 'navigation-and-page-structure';

export type DocsPageSlug = DocsGettingStartedSlug | DocsGuideSlug;

export type DocsCategory = 'people' | 'collaboration' | 'governance' | 'coordination' | 'systems';

export interface DocsSection {
  id: string;
  keywords?: string[];
  markdown: string;
  title: string;
}

export interface DocsPage {
  audience: string;
  category: DocsCategory | 'getting-started';
  description: string;
  featured: boolean;
  icon: IconName;
  keywords: string[];
  kind: DocsPageKind;
  order: number;
  related: DocsPageSlug[];
  route: string;
  sections: DocsSection[];
  slug: DocsPageSlug;
  title: string;
}

export interface DocsNavigationGroup {
  description: string;
  id: DocsCategory | 'getting-started';
  pages: DocsPage[];
  title: string;
}

export interface DocsSearchMatch {
  excerpt: string;
  page: DocsPage;
  route: string;
  score: number;
  section: DocsSection | null;
}

export type DocsSignalTone =
  'entry' | 'action' | 'collaboration' | 'attention' | 'decision' | 'result';

export interface DocsProcessStep {
  id: string;
  tone: DocsSignalTone;
  lane?: string;
}

export interface DocsProcessDefinition {
  kind: 'timeline' | 'lanes';
  steps: DocsProcessStep[];
  lanes?: string[];
}

export interface DocsTopicDefinition {
  slug: DocsTopicSlug;
  icon: IconName;
  category: DocsCategory;
  featured: boolean;
  related: DocsTopicSlug[];
  process: DocsProcessDefinition;
}
