import { translate as translateText } from '@/features/shared/hooks/use-translation';
export const DEFAULT_AI_TOOL_NAMES = [
  'find_my_todos',
  'find_my_calendar',
  'find_my_groups',
  'find_my_amendments',
  'find_my_role_events',
  'find_my_blogs',
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
    label: translateText('generated.inline.0576_eigene_todos_a77c745f'),
    kind: 'search',
    description: translateText(
      'generated.inline.0577_findet_eigene_erstellte_und_zugewiesene_todos_4e2037c4'
    ),
  },
  {
    name: 'find_my_calendar',
    label: translateText('generated.inline.0578_eigener_kalender_3c8cb3ec'),
    kind: 'search',
    description: translateText(
      'generated.inline.0579_findet_die_eigenen_kalender_events_und_teilna_5ea07ee2'
    ),
  },
  {
    name: 'find_my_groups',
    label: translateText('generated.inline.0580_eigene_gruppen_8738cf63'),
    kind: 'search',
    description: translateText(
      'generated.inline.0581_findet_gruppen_in_denen_man_eine_rolle_hat_1c27e3ff'
    ),
  },
  {
    name: 'find_my_amendments',
    label: translateText('generated.inline.0582_eigene_antr_ge_453beece'),
    kind: 'search',
    description: translateText(
      'generated.inline.0583_findet_nderungsantr_ge_in_denen_man_eine_roll_9788bb7b'
    ),
  },
  {
    name: 'find_my_role_events',
    label: translateText('generated.inline.0584_eigene_rollen_events_16f59d1a'),
    kind: 'search',
    description: translateText(
      'generated.inline.0585_findet_events_in_denen_man_eine_rolle_hat_67f90892'
    ),
  },
  {
    name: 'find_my_blogs',
    label: translateText('generated.inline.0586_eigene_blogs_c07eb2a7'),
    kind: 'search',
    description: translateText(
      'generated.inline.0587_findet_blogs_in_denen_man_eine_rolle_hat_50d084f5'
    ),
  },
  {
    name: 'search_polity_entities',
    label: translateText('generated.inline.0588_polity_suche_d07186f0'),
    kind: 'search',
    description: translateText(
      'generated.inline.0589_durchsucht_zentrale_polity_entit_ten_wie_nutz_b4e241bf'
    ),
  },
  {
    name: 'find_group_resources',
    label: translateText('generated.inline.0590_gruppen_ressourcen_ad86387f'),
    kind: 'search',
    description: translateText(
      'generated.inline.0591_l_dt_gruppen_ressourcen_wie_zahlungen_todos_l_f2085405'
    ),
  },
  {
    name: 'find_event_resources',
    label: translateText('generated.inline.0592_event_ressourcen_403c0180'),
    kind: 'search',
    description: translateText(
      'generated.inline.0593_l_dt_event_ressourcen_wie_agenda_punkte_amend_cdc38e9e'
    ),
  },
  {
    name: 'open_create_flow',
    label: translateText('generated.inline.0594_create_flow_ffnen_47ca1d88'),
    kind: 'create',
    description: translateText(
      'generated.inline.0595_ffnet_den_passenden_polity_create_flow_statt__36adeb26'
    ),
  },
  {
    name: 'create_group',
    label: translateText('generated.inline.0596_gruppe_erstellen_0b899239'),
    kind: 'create',
    description: translateText(
      'generated.inline.0597_erstellt_eine_echte_gruppe_in_polity_93d6832c'
    ),
  },
  {
    name: 'create_event',
    label: translateText('generated.inline.0598_event_erstellen_de6406f8'),
    kind: 'create',
    description: translateText(
      'generated.inline.0599_erstellt_ein_echtes_event_in_polity_cde26288'
    ),
  },
  {
    name: 'create_amendment',
    label: translateText('generated.inline.0600_amendment_erstellen_254d50c1'),
    kind: 'create',
    description: translateText(
      'generated.inline.0601_erstellt_einen_echten_nderungsantrag_in_polit_45e34eae'
    ),
  },
  {
    name: 'create_blog_entry',
    label: translateText('generated.inline.0602_blogeintrag_erstellen_68a9822b'),
    kind: 'create',
    description: translateText(
      'generated.inline.0603_erstellt_einen_echten_blogeintrag_in_polity_f7bacd6d'
    ),
  },
  {
    name: 'create_todo',
    label: translateText('generated.inline.0604_todo_erstellen_867691bd'),
    kind: 'create',
    description: translateText('generated.inline.0605_erstellt_ein_echtes_todo_in_polity_eca5616c'),
  },
  {
    name: 'create_statement',
    label: translateText('generated.inline.0606_statement_erstellen_6bbac81c'),
    kind: 'create',
    description: translateText(
      'generated.inline.0607_erstellt_ein_echtes_statement_in_polity_b999d720'
    ),
  },
  {
    name: 'create_payment',
    label: translateText('generated.inline.0608_zahlung_erstellen_a1fed91d'),
    kind: 'create',
    description: translateText(
      'generated.inline.0609_erstellt_eine_echte_zahlung_in_polity_05bc7d79'
    ),
  },
  {
    name: 'create_agenda_item',
    label: translateText('generated.inline.0610_agenda_punkt_erstellen_108bf657'),
    kind: 'create',
    description: translateText(
      'generated.inline.0611_erstellt_einen_echten_agenda_punkt_in_polity_112c448c'
    ),
  },
  {
    name: 'create_election_candidate',
    label: translateText('generated.inline.0612_kandidatur_erstellen_ee2830d6'),
    kind: 'create',
    description: translateText(
      'generated.inline.0613_erstellt_eine_echte_kandidatur_in_polity_c1068d95'
    ),
  },
] as const;

export const DEFAULT_AI_TOOLS_BY_NAME = Object.fromEntries(
  DEFAULT_AI_TOOLS.map(tool => [tool.name, tool])
) as Record<AiToolName, DefaultAiToolDefinition>;
