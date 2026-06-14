'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import {
  getPresetMembershipDirection,
  getRelationshipTypeForPreset,
  getSelectedMembershipDirection,
} from '../logic/groupConnectionComposer';
import type {
  CanonicalMembershipMode,
  GroupRelationshipDirection,
  GroupRelationshipType,
  GroupConnectionComposerMembershipRuleValue,
  GroupConnectionComposerTab,
  GroupConnectionComposerValue,
  GroupConnectionPreset,
  RelativeMembershipDirection,
} from '../types/network.types';
import {
  getGroupRelationshipDirectionOptions,
  type GroupRelationshipRight,
} from './GroupRelationshipFields';
import type { GroupRelationshipRightDisplayStatus } from '../logic/networkRelationshipHelpers';

interface SelectableGroup {
  id: string;
  name: string | null;
  description?: unknown;
}

interface SelectableRole {
  id: string;
  name: string | null;
  description?: string | null;
}
const PRESET_OPTIONS: {
  value: GroupConnectionPreset;
  label: string;
  relationshipType: GroupRelationshipType;
  membershipMode: CanonicalMembershipMode;
}[] = [
  {
    value: 'parent',
    label: translateText('generated.inline.0196_parentgroup_6feee3ae'),
    relationshipType: 'child',
    membershipMode: 'all_members',
  },
  {
    value: 'child',
    label: translateText('generated.inline.0197_childgroup_9644e4dc'),
    relationshipType: 'parent',
    membershipMode: 'all_members',
  },
  {
    value: 'parliament',
    label: translateText('generated.inline.0198_parlamentgruppe_e4c4ebd8'),
    relationshipType: 'sibling',
    membershipMode: 'selected_source_groups',
  },
  {
    value: 'elected',
    label: translateText('generated.inline.0199_gew_hlte_gruppe_0b4e1e5c'),
    relationshipType: 'sibling',
    membershipMode: 'role_members',
  },
];
interface GroupConnectionComposerProps {
  activeTab: GroupConnectionComposerTab;
  onActiveTabChange: (tab: GroupConnectionComposerTab) => void;
  value: GroupConnectionComposerValue;
  onValueChange: (value: GroupConnectionComposerValue) => void;
  currentGroupId: string;
  currentGroupName: string;
  availableGroups: SelectableGroup[];
  selectableRolesByDirection: Record<RelativeMembershipDirection, SelectableRole[]>;
  existingRightStatuses?: ReadonlyMap<string, GroupRelationshipRightDisplayStatus>;
  preflight: {
    blocking: boolean;
    isLoading: boolean;
    response: {
      blocking: boolean;
      summary?: string | null;
    } & Record<string, unknown>;
  };
  disabledRelationshipOptions?: Partial<Record<GroupRelationshipType, boolean>>;
  disableGroupSelection?: boolean;
  groupSelectorLabel?: string;
}
import { GroupConnectionComposerView } from './GroupConnectionComposerView';
export function GroupConnectionComposer({
  activeTab,
  onActiveTabChange,
  value,
  onValueChange,
  currentGroupId,
  currentGroupName,
  availableGroups,
  selectableRolesByDirection,
  existingRightStatuses = new Map<string, GroupRelationshipRightDisplayStatus>(),
  preflight,
  disabledRelationshipOptions,
  disableGroupSelection = false,
  groupSelectorLabel = 'Partnergruppe',
}: GroupConnectionComposerProps) {
  const { t } = useTranslation();

  const selectedGroupName =
    availableGroups.find(group => group.id === value.selectedGroupId)?.name ?? '';
  const directionOptions = useMemo(() => getGroupRelationshipDirectionOptions(t), [t]);
  const selectedRights = useMemo(
    () =>
      new Set(
        (
          Object.entries(value.rightDirections) as [
            GroupRelationshipRight,
            GroupRelationshipDirection,
          ][]
        )
          .filter(([, direction]) => direction !== 'none')
          .map(([right]) => right)
      ),
    [value.rightDirections]
  );

  const selectedPreset =
    PRESET_OPTIONS.find(option => option.value === value.preset) ?? PRESET_OPTIONS[1];
  const selectedPresetMembershipDirection = getPresetMembershipDirection(selectedPreset.value);
  const presetMembershipRule = value.membershipRule;
  const hydratedMembershipDirection =
    getSelectedMembershipDirection({
      membershipDirection: value.membershipDirection,
      membershipRule: value.membershipRule,
    }) ?? getPresetMembershipDirection(value.preset);
  const presetDisabled = (preset: GroupConnectionPreset) =>
    Boolean(disabledRelationshipOptions?.[getRelationshipTypeForPreset(preset)]);
  const [membershipDirection, setMembershipDirection] = useState<RelativeMembershipDirection>(
    hydratedMembershipDirection
  );
  const activeMembershipRule = value.membershipRule;
  const selectableRoles = selectableRolesByDirection[membershipDirection] ?? [];
  const presetMembershipSourceGroupId =
    selectedPresetMembershipDirection === 'partner_members_to_current'
      ? value.selectedGroupId
      : currentGroupId;
  const activeMembershipSourceGroupId =
    membershipDirection === 'partner_members_to_current' ? value.selectedGroupId : currentGroupId;

  useEffect(() => {
    setMembershipDirection(hydratedMembershipDirection);
  }, [hydratedMembershipDirection]);

  const updateMembershipRule = (
    direction: RelativeMembershipDirection,
    patch: Partial<GroupConnectionComposerMembershipRuleValue>
  ) => {
    const nextMembershipRule = {
      ...value.membershipRule,
      ...patch,
    };

    onValueChange({
      ...value,
      membershipDirection: direction,
      membershipRule: nextMembershipRule,
    });
    setMembershipDirection(direction);
  };

  const setActiveMembershipDirection = (direction: RelativeMembershipDirection) => {
    onValueChange({
      ...value,
      membershipDirection: direction,
    });
    setMembershipDirection(direction);
  };

  const updateRightDirection = (
    right: GroupRelationshipRight,
    direction: GroupRelationshipDirection
  ) => {
    onValueChange({
      ...value,
      rightDirections: {
        ...value.rightDirections,
        [right]: direction,
      },
    });
  };
  return (
    <GroupConnectionComposerView
      activeTab={activeTab}
      onActiveTabChange={onActiveTabChange}
      value={value}
      onValueChange={onValueChange}
      currentGroupId={currentGroupId}
      currentGroupName={currentGroupName}
      availableGroups={availableGroups}
      selectableRolesByDirection={selectableRolesByDirection}
      existingRightStatuses={existingRightStatuses}
      preflight={preflight}
      disabledRelationshipOptions={disabledRelationshipOptions}
      disableGroupSelection={disableGroupSelection}
      groupSelectorLabel={groupSelectorLabel}
      t={t}
      selectedGroupName={selectedGroupName}
      directionOptions={directionOptions}
      selectedRights={selectedRights}
      selectedPreset={selectedPreset}
      selectedPresetMembershipDirection={selectedPresetMembershipDirection}
      presetMembershipRule={presetMembershipRule}
      hydratedMembershipDirection={hydratedMembershipDirection}
      presetDisabled={presetDisabled}
      membershipDirection={membershipDirection}
      setMembershipDirection={setMembershipDirection}
      activeMembershipRule={activeMembershipRule}
      selectableRoles={selectableRoles}
      presetMembershipSourceGroupId={presetMembershipSourceGroupId}
      activeMembershipSourceGroupId={activeMembershipSourceGroupId}
      updateMembershipRule={updateMembershipRule}
      setActiveMembershipDirection={setActiveMembershipDirection}
      updateRightDirection={updateRightDirection}
    />
  );
}
