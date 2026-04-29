export const DEFAULT_AI_TOOL_NAMES = [
  'find_my_todos',
  'find_my_calendar',
  'search_polity_entities',
  'find_group_resources',
  'find_event_resources',
  'open_create_flow',
  'create_group',
  'create_event',
  'create_amendment',
  'create_blog_entry',
  'create_todo',
  'create_statement',
  'create_payment',
  'create_agenda_item',
  'create_election_candidate',
  'create_position',
] as const;

export type AiToolName = (typeof DEFAULT_AI_TOOL_NAMES)[number];

export interface DefaultAiToolDefinition {
  name: AiToolName;
  label: string;
  kind: 'search' | 'create';
  description: string;
}

export const DEFAULT_AI_TOOLS: readonly DefaultAiToolDefinition[] = [
  {
    name: 'find_my_todos',
    label: 'Eigene Todos',
    kind: 'search',
    description: 'Findet eigene erstellte und zugewiesene Todos.',
  },
  {
    name: 'find_my_calendar',
    label: 'Eigener Kalender',
    kind: 'search',
    description: 'Findet die eigenen Kalender-Events und Teilnahmen.',
  },
  {
    name: 'search_polity_entities',
    label: 'Polity-Suche',
    kind: 'search',
    description:
      'Durchsucht zentrale Polity-Entitäten wie Nutzer, Gruppen, Statements, Blogs, Amendments, Events, Todos, Wahlen und Abstimmungen.',
  },
  {
    name: 'find_group_resources',
    label: 'Gruppen-Ressourcen',
    kind: 'search',
    description:
      'Lädt Gruppen-Ressourcen wie Zahlungen, Todos, Links, Amendments, Events, Blogs und Dateien.',
  },
  {
    name: 'find_event_resources',
    label: 'Event-Ressourcen',
    kind: 'search',
    description: 'Lädt Event-Ressourcen wie Agenda-Punkte, Amendments, Wahlen und Abstimmungen.',
  },
  {
    name: 'open_create_flow',
    label: 'Create-Flow öffnen',
    kind: 'create',
    description: 'Öffnet den passenden Polity-Create-Flow statt direkt eine Entität zu erstellen.',
  },
  {
    name: 'create_group',
    label: 'Gruppe erstellen',
    kind: 'create',
    description: 'Erstellt eine echte Gruppe in Polity.',
  },
  {
    name: 'create_event',
    label: 'Event erstellen',
    kind: 'create',
    description: 'Erstellt ein echtes Event in Polity.',
  },
  {
    name: 'create_amendment',
    label: 'Amendment erstellen',
    kind: 'create',
    description: 'Erstellt einen echten Änderungsantrag in Polity.',
  },
  {
    name: 'create_blog_entry',
    label: 'Blogeintrag erstellen',
    kind: 'create',
    description: 'Erstellt einen echten Blogeintrag in Polity.',
  },
  {
    name: 'create_todo',
    label: 'Todo erstellen',
    kind: 'create',
    description: 'Erstellt ein echtes Todo in Polity.',
  },
  {
    name: 'create_statement',
    label: 'Statement erstellen',
    kind: 'create',
    description: 'Erstellt ein echtes Statement in Polity.',
  },
  {
    name: 'create_payment',
    label: 'Zahlung erstellen',
    kind: 'create',
    description: 'Erstellt eine echte Zahlung in Polity.',
  },
  {
    name: 'create_agenda_item',
    label: 'Agenda-Punkt erstellen',
    kind: 'create',
    description: 'Erstellt einen echten Agenda-Punkt in Polity.',
  },
  {
    name: 'create_election_candidate',
    label: 'Kandidatur erstellen',
    kind: 'create',
    description: 'Erstellt eine echte Kandidatur in Polity.',
  },
  {
    name: 'create_position',
    label: 'Position erstellen',
    kind: 'create',
    description: 'Erstellt eine echte Position in Polity.',
  },
] as const;

export const DEFAULT_AI_TOOLS_BY_NAME = Object.fromEntries(
  DEFAULT_AI_TOOLS.map(tool => [tool.name, tool])
) as Record<AiToolName, DefaultAiToolDefinition>;
