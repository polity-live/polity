import { translate as translateText } from '@/features/shared/hooks/use-translation';
export interface WikiIncumbentPersonCard {
  kind: 'person';
  id: string;
  userId: string;
  name: string;
  handle: string | null;
  avatar: string | null;
  roleId: string;
  roleTitle: string;
  roleDescription: string | null;
}

export interface WikiIncumbentVacancyCard {
  kind: 'vacancy';
  id: string;
  roleId: string;
  roleTitle: string;
  roleDescription: string | null;
}

export type WikiIncumbentCard = WikiIncumbentPersonCard | WikiIncumbentVacancyCard;

export interface WikiIncumbentRoleCards {
  id: string;
  title: string;
  description: string | null;
  assigneeCount: number;
  cards: readonly WikiIncumbentCard[];
}

export interface WikiIncumbentCarouselSection {
  id: string;
  title: string;
  description: string;
  cards: readonly WikiIncumbentCard[];
}

interface BuildWikiIncumbentCarouselSectionsOptions {
  featuredMinAssigneeCount?: number;
  lowCountTitle?: string;
  lowCountDescription?: string;
}

export function buildWikiIncumbentCarouselSections(
  roles: readonly WikiIncumbentRoleCards[],
  options: BuildWikiIncumbentCarouselSectionsOptions = {}
): WikiIncumbentCarouselSection[] {
  const {
    featuredMinAssigneeCount = 3,
    lowCountTitle = translateText('generated.inline.0144_more_roles_incumbents_bfe90f5e'),
    lowCountDescription = translateText(
      'generated.inline.0145_roles_with_fewer_than_featuredminassigneecoun_f21c6b17',
      { featuredMinAssigneeCount: featuredMinAssigneeCount }
    ),
  } = options;

  const featuredSections: WikiIncumbentCarouselSection[] = [];
  const lowCountCards: WikiIncumbentCard[] = [];

  roles.forEach(role => {
    if (role.assigneeCount >= featuredMinAssigneeCount) {
      featuredSections.push({
        id: role.id,
        title: role.title,
        description: formatFeaturedRoleDescription(role.assigneeCount),
        cards: role.cards,
      });
      return;
    }

    lowCountCards.push(...role.cards);
  });

  if (lowCountCards.length === 0) {
    return featuredSections;
  }

  return [
    ...featuredSections,
    {
      id: 'low-count-roles',
      title: lowCountTitle,
      description: lowCountDescription,
      cards: lowCountCards,
    },
  ];
}

function formatFeaturedRoleDescription(assigneeCount: number) {
  return `${assigneeCount} active incumbent${assigneeCount === 1 ? '' : 's'}`;
}
