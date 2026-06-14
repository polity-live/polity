import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Badge } from '@/features/shared/ui/ui/badge';
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
    <Card>
      <CardHeader>
        <CardTitle>{t('features.groups.editPage.groupType.title')}</CardTitle>
        <CardDescription>{t('features.groups.editPage.groupType.description')}</CardDescription>
      </CardHeader>
      <CardContent>
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
          <Badge variant={isSibling || isHierarchical ? 'default' : 'secondary'}>
            {isSibling
              ? translateText('generated.inline.0080_geschwistergruppe_1053d99c')
              : isHierarchical
                ? t('components.badges.hierarchicalGroup')
                : t('components.badges.baseGroup')}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
