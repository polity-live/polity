import { ACTION_RIGHTS } from '@/zero/rbac/constants';

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
    title: 'Operations',
    description: 'Documents, links, payments, and todos.',
    resources: ['groupDocuments', 'groupLinks', 'groupPayments', 'groupTodos'],
  },
  {
    id: 'group-management',
    title: 'Group Management',
    description: 'Members, roles, relationships, messages, notifications, and settings.',
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
    title: 'Event & Agenda',
    description: 'Events, elections, speakers, voting, and agenda items.',
    resources: ['agendaItems', 'events', 'elections'],
  },
  {
    id: 'content-moderation',
    title: 'Content & Moderation',
    description: 'Amendments, blogs, and comment moderation.',
    resources: ['amendments', 'blogs', 'comments'],
  },
] as const;

export function getActionRightSections(
  actionRights: readonly ActionRightDefinition[] = ACTION_RIGHTS
): ActionRightSection[] {
  const categorizedResources = new Set<string>(
    ACTION_RIGHT_SECTION_DEFINITIONS.flatMap(section => section.resources)
  );

  const sections = ACTION_RIGHT_SECTION_DEFINITIONS.map(section => ({
    id: section.id,
    title: section.title,
    description: section.description,
    rights: actionRights.filter(right => section.resources.includes(right.resource)),
  })).filter(section => section.rights.length > 0);

  const otherRights = actionRights.filter(right => !categorizedResources.has(right.resource));

  if (otherRights.length > 0) {
    sections.push({
      id: 'other',
      title: 'Other',
      description: 'Additional action rights that are not yet grouped into a dedicated section.',
      rights: otherRights,
    });
  }

  return sections;
}
