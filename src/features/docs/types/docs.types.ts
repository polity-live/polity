import type { IconName } from '@/features/navigation/nav-items/icon-map.tsx';

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

export type DocsCategory = 'people' | 'collaboration' | 'governance' | 'coordination' | 'systems';

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
