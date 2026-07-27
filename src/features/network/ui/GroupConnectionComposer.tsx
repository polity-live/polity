'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  applyGroupConnectionPreset,
  GROUP_CONNECTION_PRESET_OPTIONS,
  getPresetMembershipDirection,
  getRelationshipTypeForPreset,
  getSelectedMembershipDirection,
} from '../logic/groupConnectionComposer';
import type {
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
import { resolveAppTutorialFixtureText } from '@/features/app-tutorial/fixture-copy';

interface SelectableGroup {
  id: string;
  name: string | null;
  description?: unknown;
  tutorial_run_id?: string | null;
}

interface SelectableRole {
  id: string;
  name: string | null;
  description?: string | null;
}
const PRESET_OPTIONS = [...GROUP_CONNECTION_PRESET_OPTIONS];
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
  disabledPresets?: Partial<Record<GroupConnectionPreset, string>>;
  disabledPresetFallback?: GroupConnectionPreset;
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
  disabledPresets = {},
  disabledPresetFallback,
  disableGroupSelection = false,
  groupSelectorLabel = 'Partnergruppe',
}: GroupConnectionComposerProps) {
  const { t, language } = useTranslation();

  const selectedGroup = availableGroups.find(group => group.id === value.selectedGroupId);
  const selectedGroupName =
    resolveAppTutorialFixtureText(selectedGroup?.name, {
      tutorialRunId: selectedGroup?.tutorial_run_id,
      language,
    }) ?? '';
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
    Boolean(disabledPresets[preset]) ||
    Boolean(disabledRelationshipOptions?.[getRelationshipTypeForPreset(preset)]);
  const getPresetDisabledReason = (preset: GroupConnectionPreset) => disabledPresets[preset];
  const currentRoleMembershipDisabled = Boolean(disabledPresets.role_members_to_partner);

  useEffect(() => {
    if (!presetDisabled(value.preset)) {
      return;
    }

    const fallbackPreset =
      disabledPresetFallback && !presetDisabled(disabledPresetFallback)
        ? disabledPresetFallback
        : (PRESET_OPTIONS.find(option => !presetDisabled(option.value))?.value ?? 'parent');

    onValueChange({
      ...value,
      ...applyGroupConnectionPreset(fallbackPreset, value),
    });
  }, [disabledPresetFallback, disabledPresets, disabledRelationshipOptions, onValueChange, value]);

  useEffect(() => {
    if (
      !currentRoleMembershipDisabled ||
      value.membershipDirection !== 'current_members_to_partner' ||
      value.membershipRule.membershipMode !== 'role_members'
    ) {
      return;
    }

    onValueChange({
      ...value,
      membershipRule: {
        ...value.membershipRule,
        membershipMode: 'none',
        roleId: '',
        sourceGroupIds: [],
      },
    });
  }, [currentRoleMembershipDisabled, onValueChange, value]);
  const [membershipDirection, setMembershipDirection] = useState<RelativeMembershipDirection>(
    hydratedMembershipDirection
  );
  const activeMembershipRule = value.membershipRule;
  const selectableRoles = selectableRolesByDirection[membershipDirection] ?? [];

  useEffect(() => {
    setMembershipDirection(hydratedMembershipDirection);
  }, [hydratedMembershipDirection]);

  const updateMembershipRule = (
    direction: RelativeMembershipDirection,
    patch: Partial<GroupConnectionComposerMembershipRuleValue>
  ) => {
    if (
      direction === 'current_members_to_partner' &&
      patch.membershipMode === 'role_members' &&
      currentRoleMembershipDisabled
    ) {
      return;
    }

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
    const membershipRule =
      direction === 'current_members_to_partner' &&
      value.membershipRule.membershipMode === 'role_members' &&
      currentRoleMembershipDisabled
        ? {
            ...value.membershipRule,
            membershipMode: 'none' as const,
            roleId: '',
            sourceGroupIds: [],
          }
        : value.membershipRule;

    onValueChange({
      ...value,
      membershipDirection: direction,
      membershipRule,
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
      language={language}
      selectedGroupName={selectedGroupName}
      directionOptions={directionOptions}
      selectedRights={selectedRights}
      selectedPreset={selectedPreset}
      selectedPresetMembershipDirection={selectedPresetMembershipDirection}
      presetMembershipRule={presetMembershipRule}
      presetDisabled={presetDisabled}
      getPresetDisabledReason={getPresetDisabledReason}
      membershipDirection={membershipDirection}
      activeMembershipRule={activeMembershipRule}
      selectableRoles={selectableRoles}
      updateMembershipRule={updateMembershipRule}
      setActiveMembershipDirection={setActiveMembershipDirection}
      updateRightDirection={updateRightDirection}
    />
  );
}
