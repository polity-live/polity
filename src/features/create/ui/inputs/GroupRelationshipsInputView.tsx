import { BadgeControl } from '@/features/shared/ui/status';
import { FormControlLabel } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { Card } from '@/features/shared/ui/ui/card';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { X, Check, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { GroupLink } from './GroupRelationshipsInput';

type RelationshipType = 'isParent' | 'isChild';
type WithRight =
  | 'informationRight'
  | 'amendmentRight'
  | 'rightToSpeak'
  | 'activeVotingRight'
  | 'passiveVotingRight';

interface GroupRelationshipsInputViewProps {
  value: GroupLink[];
  groupItems: TypeaheadItem[];
  selectedGroupId: string;
  relationshipType: RelationshipType;
  selectedRights: Set<WithRight>;
  rightKeys: WithRight[];
  onGroupChange: (item: TypeaheadItem | null) => void;
  onRelationshipTypeChange: (value: RelationshipType) => void;
  onToggleRight: (right: WithRight) => void;
  onAdd: () => void;
  onRemove: (groupId: string) => void;
}

export function GroupRelationshipsInputView({
  value,
  groupItems,
  selectedGroupId,
  relationshipType,
  selectedRights,
  rightKeys,
  onGroupChange,
  onRelationshipTypeChange,
  onToggleRight,
  onAdd,
  onRemove,
}: GroupRelationshipsInputViewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FormControlLabel>{t('pages.create.group.linkGroupsOptional')}</FormControlLabel>
        <BadgeControl variant="secondary">
          {value.length} {t('pages.create.group.linked')}
        </BadgeControl>
      </div>
      <p className="text-muted-foreground text-sm">
        {t('pages.create.group.requestRelationships')}
      </p>

      <div className="space-y-2">
        <FormControlLabel>{t('pages.create.group.selectGroup')}</FormControlLabel>
        <TypeaheadSearch
          items={groupItems}
          value={selectedGroupId}
          onChange={onGroupChange}
          placeholder={t('pages.create.group.searchGroups')}
        />
      </div>

      {selectedGroupId ? (
        <>
          <div className="space-y-2">
            <FormControlLabel>{t('pages.create.group.relationshipType')}</FormControlLabel>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={relationshipType === 'isParent' ? 'default' : 'outline'}
                onClick={() => onRelationshipTypeChange('isParent')}
              >
                {t('pages.create.group.theyAreParent')}
              </Button>
              <Button
                type="button"
                variant={relationshipType === 'isChild' ? 'default' : 'outline'}
                onClick={() => onRelationshipTypeChange('isChild')}
              >
                {t('pages.create.group.theyAreChild')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <FormControlLabel>{t('pages.create.group.selectRights')}</FormControlLabel>
            <div className="grid grid-cols-2 gap-2">
              {rightKeys.map((right: any) => (
                <Button
                  key={right}
                  type="button"
                  variant={selectedRights.has(right) ? 'default' : 'outline'}
                  onClick={() => onToggleRight(right)}
                  className="h-auto justify-start py-3"
                >
                  {selectedRights.has(right) ? <Check className="mr-2 h-4 w-4" /> : null}
                  <span className="text-sm">{t(`pages.create.group.rights.${right}`)}</span>
                </Button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={onAdd}
            disabled={selectedRights.size === 0}
            className="w-full"
          >
            <LinkIcon className="mr-2 h-4 w-4" />
            {t('pages.create.group.addGroupLink')}
          </Button>
        </>
      ) : null}

      {value.length > 0 ? (
        <div className="mt-4 space-y-2">
          <FormControlLabel className="text-sm">
            {t('pages.create.group.linkedGroups')}
          </FormControlLabel>
          <div className="space-y-2">
            {value.map((link: any) => (
              <Card key={link.groupId} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium">{link.groupName}</span>
                      <BadgeControl variant="outline" size="xs">
                        {link.relationshipType === 'isParent'
                          ? t('pages.create.group.parent')
                          : t('pages.create.group.child')}
                      </BadgeControl>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {link.rights.map((right: any) => (
                        <BadgeControl key={right} variant="secondary" size="xs">
                          {t(`pages.create.group.rights.${right}`)}
                        </BadgeControl>
                      ))}
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => onRemove(link.groupId)}
                    variant="ghost"
                    size="icon"
                    className="hover:bg-destructive/10 hover:text-destructive h-7 w-7 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
