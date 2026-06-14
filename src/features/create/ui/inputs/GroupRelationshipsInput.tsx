import { useGroupRelationshipsInputController } from '../../hooks/useGroupRelationshipsInputController';
import { GroupRelationshipsInputView } from './GroupRelationshipsInputView';

type RelationshipType = 'isParent' | 'isChild';

type WithRight =
  | 'informationRight'
  | 'amendmentRight'
  | 'rightToSpeak'
  | 'activeVotingRight'
  | 'passiveVotingRight';

export interface GroupLink {
  groupId: string;
  groupName: string;
  relationshipType: RelationshipType;
  rights: WithRight[];
}

interface GroupRelationshipsInputProps {
  value: GroupLink[];
  onChange: (links: GroupLink[]) => void;
}

export function GroupRelationshipsInput({ value, onChange }: GroupRelationshipsInputProps) {
  const controller = useGroupRelationshipsInputController({ value, onChange });

  return (
    <GroupRelationshipsInputView
      value={value}
      groupItems={controller.groupItems}
      selectedGroupId={controller.selectedGroupId}
      relationshipType={controller.relationshipType}
      selectedRights={controller.selectedRights}
      rightKeys={controller.rightKeys}
      onGroupChange={controller.handleGroupChange}
      onRelationshipTypeChange={controller.setRelationshipType}
      onToggleRight={controller.toggleRight}
      onAdd={controller.handleAdd}
      onRemove={controller.handleRemove}
    />
  );
}
