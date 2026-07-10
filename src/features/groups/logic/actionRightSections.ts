import { GROUP_ACTION_RIGHTS } from '@/zero/rbac/constants';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export interface ActionRightDefinition {
  resource: string;
  action: string;
  label: string;
}

export interface ActionRightSection {
  id: string;
  title: string;
  description: string;
  rights: readonly ActionRightDefinition[];
}

const ACTION_RIGHT_SECTION_DEFINITIONS = [
  {
    id: 'operations',
    title: translateText('generated.inline.0137_operations_a1fdaa6b'),
    description: translateText('generated.inline.0138_documents_links_payments_and_todos_29ac0bfa'),
    resources: ['groupDatasets', 'groupDocuments', 'groupLinks', 'groupPayments', 'groupTodos'],
  },
  {
    id: 'group-management',
    title: translateText('generated.inline.0139_group_management_0c4c01a0'),
    description: translateText(
      'generated.inline.0140_members_roles_relationships_messages_notifica_749cf2d7'
    ),
    resources: [
      'groupMemberships',
      'groupNotifications',
      'groupRoles',
      'groupRelationships',
      'groupAccessRoles',
      'groups',
      'messages',
    ],
  },
  {
    id: 'event-agenda',
    title: translateText('generated.inline.0141_event_agenda_527e2d32'),
    description: translateText(
      'generated.inline.0142_events_elections_speakers_voting_and_agenda_i_3438ebec'
    ),
    resources: ['agendaItems', 'events', 'elections'],
  },
  {
    id: 'content-moderation',
    title: translateText('generated.inline.0143_content_moderation_a3ccd2c9'),
    description: translateText(
      'generated.inline.0144_amendments_blogs_and_comment_moderation_8ffddcf4'
    ),
    resources: ['amendments', 'blogs', 'comments'],
  },
] as const;

export function getActionRightSections(
  actionRights: readonly ActionRightDefinition[] = GROUP_ACTION_RIGHTS
): ActionRightSection[] {
  const categorizedResources = new Set<string>(
    ACTION_RIGHT_SECTION_DEFINITIONS.flatMap(section => section.resources)
  );

  const sections: ActionRightSection[] = ACTION_RIGHT_SECTION_DEFINITIONS.map(section => {
    const sectionResources = new Set<string>(section.resources);

    return {
      id: section.id,
      title: section.title,
      description: section.description,
      rights: actionRights.filter(right => sectionResources.has(right.resource)),
    };
  }).filter(section => section.rights.length > 0);

  const otherRights = actionRights.filter(right => !categorizedResources.has(right.resource));

  if (otherRights.length > 0) {
    sections.push({
      id: 'other',
      title: translateText('generated.inline.0145_other_6e6a6f20'),
      description: translateText(
        'generated.inline.0146_additional_action_rights_that_are_not_yet_gro_5ab2beb4'
      ),
      rights: otherRights,
    });
  }

  return sections;
}
