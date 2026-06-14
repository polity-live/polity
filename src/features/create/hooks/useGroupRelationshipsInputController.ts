import { useState, useMemo } from 'react';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { useAllGroups } from '@/zero/groups/useGroupState';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import type { GroupLink } from '../ui/inputs/GroupRelationshipsInput';

type RelationshipType = 'isParent' | 'isChild';
type WithRight =
  | 'informationRight'
  | 'amendmentRight'
  | 'rightToSpeak'
  | 'activeVotingRight'
  | 'passiveVotingRight';

const RIGHT_KEYS: WithRight[] = [
  'informationRight',
  'amendmentRight',
  'rightToSpeak',
  'activeVotingRight',
  'passiveVotingRight',
];

interface UseGroupRelationshipsInputControllerProps {
  value: GroupLink[];
  onChange: (links: GroupLink[]) => void;
}

export function useGroupRelationshipsInputController({
  value,
  onChange,
}: UseGroupRelationshipsInputControllerProps) {
  const { t } = useTranslation();
  const { groups } = useAllGroups();
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('isParent');
  const [selectedRights, setSelectedRights] = useState<Set<WithRight>>(new Set());

  const availableGroups = useMemo(
    () => groups.filter(g => !value.some(link => link.groupId === g.id)),
    [groups, value]
  );

  const groupItems = useMemo(
    () =>
      toTypeaheadItems(
        availableGroups,
        'group',
        g => g.name || 'Group',
        g => (typeof g.description === 'string' ? g.description.substring(0, 60) : undefined),
        undefined,
        g => `/group/${g.id}`
      ),
    [availableGroups]
  );

  const toggleRight = (right: WithRight) => {
    const next = new Set(selectedRights);
    if (next.has(right)) next.delete(right);
    else next.add(right);
    setSelectedRights(next);
  };

  const handleGroupChange = (item: TypeaheadItem | null) => {
    setSelectedGroupId(item?.id ?? '');
  };

  const handleAdd = () => {
    if (!selectedGroupId || selectedRights.size === 0) {
      toast.error(t('pages.create.group.selectGroupAndRights'));
      return;
    }
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    const existing = value.find(link => link.groupId === selectedGroupId);
    if (existing) {
      onChange(
        value.map(link =>
          link.groupId === selectedGroupId
            ? { ...link, rights: Array.from(selectedRights), relationshipType }
            : link
        )
      );
      toast.info(t('pages.create.group.groupAlreadyLinked'));
    } else {
      onChange([
        ...value,
        {
          groupId: selectedGroupId,
          groupName: group.name || '',
          relationshipType,
          rights: Array.from(selectedRights),
        },
      ]);
    }

    setSelectedGroupId('');
    setSelectedRights(new Set());
  };

  const handleRemove = (groupId: string) => {
    onChange(value.filter(link => link.groupId !== groupId));
  };

  return {
    groupItems,
    selectedGroupId,
    relationshipType,
    selectedRights,
    rightKeys: RIGHT_KEYS,
    setRelationshipType,
    toggleRight,
    handleGroupChange,
    handleAdd,
    handleRemove,
  };
}
