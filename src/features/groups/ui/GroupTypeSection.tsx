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
import { getGroupTypeFlags } from '@/features/groups/logic/groupTypeFlags';
import type { GroupType } from '../hooks/useGroupUpdate';

interface GroupTypeSectionProps {
  groupType: GroupType;
  hasHierarchyChildren?: boolean | null;
  hasSiblingConnections?: boolean | null;
}

export function GroupTypeSection({
  groupType,
  hasHierarchyChildren,
  hasSiblingConnections,
}: GroupTypeSectionProps) {
  const { t } = useTranslation();
  const { isBase, isHierarchical, isSibling, isMixed } = getGroupTypeFlags({
    group_type: groupType,
    has_hierarchy_children: hasHierarchyChildren,
    has_sibling_connections: hasSiblingConnections,
  });

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
              {isMixed
                ? translateText('features.groups.editPage.groupType.mixedDescription')
                : isSibling
                  ? translateText(
                      'generated.inline.0098_diese_gruppe_ist_als_geschwistergruppe_mit_ei_1101075e'
                    )
                  : isHierarchical
                    ? t('features.groups.editPage.groupType.hierarchicalDescription')
                    : t('features.groups.editPage.groupType.baseDescription')}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {isHierarchical ? (
              <EntityBadge tone="accent">{t('components.badges.hierarchicalGroup')}</EntityBadge>
            ) : null}
            {isSibling ? (
              <EntityBadge tone="accent">
                {translateText('generated.inline.0080_geschwistergruppe_1053d99c')}
              </EntityBadge>
            ) : null}
            {isBase ? (
              <EntityBadge tone="neutral">{t('components.badges.baseGroup')}</EntityBadge>
            ) : null}
          </div>
        </div>
      </PanelContent>
    </Panel>
  );
}
