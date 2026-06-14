import {
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from '@/features/shared/ui/layout';
import { EntityBadge } from '@/features/shared/ui/status';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import type { GroupType } from '../hooks/useGroupUpdate';

interface GroupTypeSectionProps {
  groupType: GroupType;
}

export function GroupTypeSection({ groupType }: GroupTypeSectionProps) {
  const { t } = useTranslation();
  const isHierarchical = groupType === 'hierarchical';
  const isSibling = groupType === 'sibling';

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{t('features.groups.editPage.groupType.title')}</PanelTitle>
        <PanelDescription>{t('features.groups.editPage.groupType.description')}</PanelDescription>
      </PanelHeader>
      <PanelContent>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('features.groups.editPage.groupType.label')}</p>
            <p className="text-muted-foreground text-sm">
              {isSibling
                ? translateText(
                    'generated.inline.0098_diese_gruppe_ist_als_geschwistergruppe_mit_ei_1101075e'
                  )
                : isHierarchical
                  ? t('features.groups.editPage.groupType.hierarchicalDescription')
                  : t('features.groups.editPage.groupType.baseDescription')}
            </p>
          </div>
          <EntityBadge tone={isSibling || isHierarchical ? 'accent' : 'neutral'}>
            {isSibling
              ? translateText('generated.inline.0080_geschwistergruppe_1053d99c')
              : isHierarchical
                ? t('components.badges.hierarchicalGroup')
                : t('components.badges.baseGroup')}
          </EntityBadge>
        </div>
      </PanelContent>
    </Panel>
  );
}
