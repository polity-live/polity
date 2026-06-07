'use client';

import { useEffect, useMemo, useState } from 'react';
import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import { Label } from '@/features/shared/ui/ui/label';
import { RadioGroup, RadioGroupItem } from '@/features/shared/ui/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { GroupConflictDialog, GroupConflictPanel } from '@/features/groups/ui/GroupConflictPanel';
import {
  applyNetworkLinkPreset,
  getPresetMembershipDirection,
  getRelationshipTypeForPreset,
  getSelectedMembershipDirection,
} from '../logic/networkLinkComposer';
import {
  getCanonicalMembershipModeLabel,
  getLegacySiblingMembershipMode,
} from '../logic/networkLinkDerived';
import type {
  CanonicalMembershipMode,
  GroupRelationshipDirection,
  GroupRelationshipType,
  NetworkLinkComposerMembershipRuleValue,
  NetworkLinkComposerTab,
  NetworkLinkComposerValue,
  NetworkLinkPreset,
  RelativeMembershipDirection,
} from '../types/network.types';
import {
  getGroupRelationshipDirectionOptions,
  GroupRelationshipMembershipModeDescription,
  GroupRelationshipNameTag,
  GroupRelationshipRightsSelector,
  GroupRelationshipTypeSelect,
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

const MEMBERSHIP_MODE_OPTIONS: CanonicalMembershipMode[] = [
  'none',
  'all_members',
  'role_members',
  'selected_source_groups',
];

const PRESET_OPTIONS: {
  value: NetworkLinkPreset;
  label: string;
  relationshipType: GroupRelationshipType;
  membershipMode: CanonicalMembershipMode;
}[] = [
  {
    value: 'parent',
    label: 'Parentgroup',
    relationshipType: 'child',
    membershipMode: 'all_members',
  },
  {
    value: 'child',
    label: 'Childgroup',
    relationshipType: 'parent',
    membershipMode: 'all_members',
  },
  {
    value: 'parliament',
    label: 'Parlamentgruppe',
    relationshipType: 'sibling',
    membershipMode: 'selected_source_groups',
  },
  {
    value: 'elected',
    label: 'Gewählte Gruppe',
    relationshipType: 'sibling',
    membershipMode: 'role_members',
  },
];

function getMembershipDirectionLabel(direction: RelativeMembershipDirection) {
  return direction === 'incoming'
    ? 'Partnergruppe -> aktuelle Gruppe'
    : 'Aktuelle Gruppe -> Partnergruppe';
}

function getMembershipDirectionDescription(direction: RelativeMembershipDirection) {
  return direction === 'incoming'
    ? 'Mitglieder fliessen aus der Partnergruppe in die aktuelle Gruppe.'
    : 'Mitglieder fliessen aus der aktuellen Gruppe in die Partnergruppe.';
}

function getSafeGroupDisplayName(name: string | null | undefined, fallback: string) {
  const trimmedName = name?.trim();
  return trimmedName ? trimmedName : fallback;
}

function PresetDescription({
  preset,
  currentGroupId,
  currentGroupName,
  selectedGroupId,
  selectedGroupName,
}: {
  preset: NetworkLinkPreset;
  currentGroupId: string;
  currentGroupName: string;
  selectedGroupId: string;
  selectedGroupName: string;
}) {
  const safeCurrentGroupName = getSafeGroupDisplayName(currentGroupName, 'diese Gruppe');
  const safeSelectedGroupName = getSafeGroupDisplayName(selectedGroupName, 'Partnergruppe');

  const currentTag = (
    <GroupRelationshipNameTag
      name={safeCurrentGroupName}
      kind="current"
      caseStyle="embedded"
      groupId={currentGroupId}
      displayMode="name-only"
      linkGroups={false}
    />
  );
  const selectedTag = (
    <GroupRelationshipNameTag
      name={safeSelectedGroupName}
      kind="selected"
      caseStyle="embedded"
      groupId={selectedGroupId}
      displayMode="name-only"
      linkGroups={false}
    />
  );

  if (preset === 'parent') {
    return (
      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
        <span>Diese gewählte Partnergruppe</span>
        {selectedTag}
        <span>ist übergeordnet, die aktuelle Gruppe</span>
        {currentTag}
        <span>ist untergeordnet.</span>
      </div>
    );
  }

  if (preset === 'child') {
    return (
      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
        <span>Die aktuelle Gruppe</span>
        {currentTag}
        <span>ist übergeordnet, die gewählte Partnergruppe</span>
        {selectedTag}
        <span>ist untergeordnet.</span>
      </div>
    );
  }

  if (preset === 'parliament') {
    return (
      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
        <span>Die aktuelle Gruppe</span>
        {currentTag}
        <span>und die gewählte Partnergruppe</span>
        {selectedTag}
        <span>werden als Parlamentgruppe miteinander verbunden.</span>
      </div>
    );
  }

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
      <span>Die aktuelle Gruppe</span>
      {currentTag}
      <span>und die gewählte Partnergruppe</span>
      {selectedTag}
      <span>werden als gewählte Gruppe miteinander verbunden.</span>
    </div>
  );
}

interface NetworkLinkComposerProps {
  activeTab: NetworkLinkComposerTab;
  onActiveTabChange: (tab: NetworkLinkComposerTab) => void;
  value: NetworkLinkComposerValue;
  onValueChange: (value: NetworkLinkComposerValue) => void;
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

export function NetworkLinkComposer({
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
}: NetworkLinkComposerProps) {
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
  const presetDisabled = (preset: NetworkLinkPreset) =>
    Boolean(disabledRelationshipOptions?.[getRelationshipTypeForPreset(preset)]);
  const [membershipDirection, setMembershipDirection] = useState<RelativeMembershipDirection>(
    hydratedMembershipDirection
  );
  const activeMembershipRule = value.membershipRule;
  const selectableRoles = selectableRolesByDirection[membershipDirection] ?? [];
  const presetMembershipSourceGroupId =
    selectedPresetMembershipDirection === 'incoming' ? value.selectedGroupId : currentGroupId;
  const activeMembershipSourceGroupId =
    membershipDirection === 'incoming' ? value.selectedGroupId : currentGroupId;

  useEffect(() => {
    setMembershipDirection(hydratedMembershipDirection);
  }, [hydratedMembershipDirection]);

  const updateMembershipRule = (
    direction: RelativeMembershipDirection,
    patch: Partial<NetworkLinkComposerMembershipRuleValue>
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
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={nextValue => onActiveTabChange(nextValue as NetworkLinkComposerTab)}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preset">Vorkonfiguriert</TabsTrigger>
          <TabsTrigger value="advanced">Link selbst konfigurieren</TabsTrigger>
        </TabsList>

        <div className="grid gap-2">
          <Label htmlFor="network-link-composer-group">{groupSelectorLabel}</Label>
          {disableGroupSelection ? (
            <div className="bg-muted/30 rounded-md border px-3 py-2 text-sm font-medium">
              {selectedGroupName || currentGroupName}
            </div>
          ) : (
            <TypeaheadSearch
              items={toTypeaheadItems(
                availableGroups,
                'group',
                group => group.name || 'Group',
                group => {
                  const description =
                    typeof group.description === 'string' ? group.description : null;
                  return description
                    ? richTextToPlainText(description).substring(0, 60)
                    : undefined;
                },
                undefined,
                group => `/group/${group.id}`
              )}
              value={value.selectedGroupId}
              onChange={(item: TypeaheadItem | null) =>
                onValueChange({
                  ...value,
                  selectedGroupId: item?.id ?? '',
                })
              }
              placeholder="Gruppe auswählen"
              disablePortal
              showAllOnFocus
            />
          )}
        </div>

        <TabsContent value="preset" className="space-y-4">
          {value.selectedGroupId ? (
            <>
              <div className="grid gap-2">
                <Label>Variante</Label>
                <RadioGroup
                  value={value.preset}
                  onValueChange={nextValue =>
                    onValueChange(applyNetworkLinkPreset(nextValue as NetworkLinkPreset, value))
                  }
                >
                  <div className="grid gap-2 md:grid-cols-2">
                    {PRESET_OPTIONS.map(option => {
                      const disabled = presetDisabled(option.value);
                      const isSelected = selectedPreset.value === option.value;
                      return (
                        <Label
                          key={option.value}
                          htmlFor={`preset-${option.value}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          <RadioGroupItem
                            id={`preset-${option.value}`}
                            value={option.value}
                            disabled={disabled}
                            className="mt-0.5"
                          />
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{option.label}</div>
                            <PresetDescription
                              preset={option.value}
                              currentGroupId={currentGroupId}
                              currentGroupName={currentGroupName}
                              selectedGroupId={value.selectedGroupId}
                              selectedGroupName={selectedGroupName}
                            />
                            <div className="text-muted-foreground text-[11px]">
                              {`Membership: ${getCanonicalMembershipModeLabel(option.membershipMode)}`}
                            </div>
                          </div>
                        </Label>
                      );
                    })}
                  </div>
                </RadioGroup>
              </div>

              {selectedPreset.value === 'elected' ? (
                <div className="grid gap-2">
                  <Label>Rolle der verbundenen Gruppe</Label>
                  <TypeaheadSearch
                    items={toTypeaheadItems(
                      selectableRolesByDirection[selectedPresetMembershipDirection] ?? [],
                      'role',
                      role => role.name || 'Role',
                      role => role.description || undefined
                    )}
                    value={presetMembershipRule.roleId}
                    onChange={(item: TypeaheadItem | null) =>
                      updateMembershipRule(selectedPresetMembershipDirection, {
                        roleId: item?.id ?? '',
                      })
                    }
                    placeholder="Mitgliedsrolle der verbundenen Gruppe wählen"
                    disablePortal
                    showAllOnFocus
                  />
                </div>
              ) : null}

              {selectedPreset.value === 'parliament' ? (
                <div className="grid gap-2">
                  <Label>Source groups</Label>
                  <div className="grid gap-2 rounded-lg border p-3">
                    {availableGroups
                      .filter(group => group.id !== presetMembershipSourceGroupId)
                      .map(group => {
                        const checked = presetMembershipRule.sourceGroupIds.includes(group.id);
                        return (
                          <Label
                            key={group.id}
                            className="flex items-center gap-3 rounded-md border px-3 py-2"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={nextChecked =>
                                updateMembershipRule(selectedPresetMembershipDirection, {
                                  sourceGroupIds:
                                    nextChecked === true
                                      ? [
                                          ...new Set([
                                            ...presetMembershipRule.sourceGroupIds,
                                            group.id,
                                          ]),
                                        ]
                                      : presetMembershipRule.sourceGroupIds.filter(
                                          id => id !== group.id
                                        ),
                                })
                              }
                            />
                            <span className="text-sm">{group.name || 'Group'}</span>
                          </Label>
                        );
                      })}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          {value.selectedGroupId ? (
            <>
              <GroupRelationshipTypeSelect
                label="Beziehungsart"
                value={value.relationshipType}
                currentGroupName={currentGroupName}
                selectedGroupName={selectedGroupName}
                currentGroupId={currentGroupId}
                selectedGroupId={value.selectedGroupId}
                siblingMembershipMode={
                  value.relationshipType === 'sibling'
                    ? (getLegacySiblingMembershipMode(activeMembershipRule.membershipMode) ??
                      undefined)
                    : undefined
                }
                onValueChange={nextRelationshipType =>
                  onValueChange({
                    ...value,
                    relationshipType: nextRelationshipType,
                  })
                }
                disabledOptions={disabledRelationshipOptions}
              />

              <div className="grid gap-4 rounded-lg border p-4">
                <div className="grid gap-2">
                  <Label>Membership-Richtung</Label>
                  <RadioGroup
                    value={membershipDirection}
                    onValueChange={nextValue =>
                      setActiveMembershipDirection(nextValue as RelativeMembershipDirection)
                    }
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(['incoming', 'outgoing'] as RelativeMembershipDirection[]).map(
                        direction => (
                          <Label
                            key={`membership-direction-${direction}`}
                            htmlFor={`membership-direction-${direction}`}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                              membershipDirection === direction
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <RadioGroupItem
                              id={`membership-direction-${direction}`}
                              value={direction}
                              className="mt-0.5"
                            />
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {getMembershipDirectionLabel(direction)}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {getMembershipDirectionDescription(direction)}
                              </div>
                            </div>
                          </Label>
                        )
                      )}
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid gap-4 rounded-lg border p-4">
                  <div className="grid gap-2">
                    <Label>Membership mode</Label>
                    <RadioGroup
                      value={activeMembershipRule.membershipMode}
                      onValueChange={nextValue =>
                        updateMembershipRule(membershipDirection, {
                          membershipMode: nextValue as CanonicalMembershipMode,
                          roleId: nextValue === 'role_members' ? activeMembershipRule.roleId : '',
                          sourceGroupIds:
                            nextValue === 'selected_source_groups'
                              ? activeMembershipRule.sourceGroupIds
                              : [],
                        })
                      }
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        {MEMBERSHIP_MODE_OPTIONS.map(option => (
                          <Label
                            key={`${membershipDirection}-${option}`}
                            htmlFor={`advanced-membership-mode-${membershipDirection}-${option}`}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                              activeMembershipRule.membershipMode === option
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <RadioGroupItem
                              id={`advanced-membership-mode-${membershipDirection}-${option}`}
                              value={option}
                              className="mt-0.5"
                            />
                            <div>
                              <div className="text-sm font-medium">
                                {getCanonicalMembershipModeLabel(option)}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                <GroupRelationshipMembershipModeDescription
                                  membershipMode={option}
                                  direction={membershipDirection}
                                  currentGroupId={currentGroupId}
                                  currentGroupName={currentGroupName}
                                  selectedGroupId={value.selectedGroupId}
                                  selectedGroupName={selectedGroupName}
                                  linkGroups={false}
                                />
                              </div>
                            </div>
                          </Label>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>

                  {activeMembershipRule.membershipMode === 'role_members' ? (
                    <div className="grid gap-2">
                      <Label>Rolle der Quellgruppe</Label>
                      <TypeaheadSearch
                        items={toTypeaheadItems(
                          selectableRoles,
                          'role',
                          role => role.name || 'Role',
                          role => role.description || undefined
                        )}
                        value={activeMembershipRule.roleId}
                        onChange={(item: TypeaheadItem | null) =>
                          updateMembershipRule(membershipDirection, {
                            roleId: item?.id ?? '',
                          })
                        }
                        placeholder="Mitgliedsrolle wählen"
                        disablePortal
                        showAllOnFocus
                      />
                    </div>
                  ) : null}

                  {activeMembershipRule.membershipMode === 'selected_source_groups' ? (
                    <div className="grid gap-2">
                      <Label>Source groups</Label>
                      <div className="grid gap-2 rounded-lg border p-3">
                        {availableGroups
                          .filter(group => group.id !== activeMembershipSourceGroupId)
                          .map(group => {
                            const checked = activeMembershipRule.sourceGroupIds.includes(group.id);
                            return (
                              <Label
                                key={`${membershipDirection}-${group.id}`}
                                className="flex items-center gap-3 rounded-md border px-3 py-2"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={nextChecked =>
                                    updateMembershipRule(membershipDirection, {
                                      sourceGroupIds:
                                        nextChecked === true
                                          ? [
                                              ...new Set([
                                                ...activeMembershipRule.sourceGroupIds,
                                                group.id,
                                              ]),
                                            ]
                                          : activeMembershipRule.sourceGroupIds.filter(
                                              id => id !== group.id
                                            ),
                                    })
                                  }
                                />
                                <span className="text-sm">{group.name || 'Group'}</span>
                              </Label>
                            );
                          })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </TabsContent>
      </Tabs>

      {value.selectedGroupId ? (
        <GroupRelationshipRightsSelector
          label="Rechte"
          helperText={t('common.network.existingRightsStatusHint')}
          selectedRights={selectedRights}
          onToggleRight={right =>
            updateRightDirection(
              right,
              value.rightDirections[right] === 'none' ? 'outgoing' : 'none'
            )
          }
          existingRightStatuses={existingRightStatuses}
          rightDirections={value.rightDirections}
          onDirectionChange={updateRightDirection}
          directionOptions={directionOptions}
          currentGroupName={currentGroupName}
          selectedGroupName={selectedGroupName}
          currentGroupId={currentGroupId}
          selectedGroupId={value.selectedGroupId}
        />
      ) : null}

      {preflight.blocking ? (
        <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                {preflight.response.summary ??
                  t('features.groups.conflicts.dialog.blockedSummaryFallback')}
              </div>
              <div className="text-muted-foreground text-sm">
                {t('features.groups.conflicts.dialog.blockedDescription')}
              </div>
            </div>
            <GroupConflictDialog
              response={preflight.response as never}
              triggerLabel={t('features.groups.conflicts.dialog.triggerLabel')}
              title={t('features.groups.conflicts.dialog.blockedReasonTitle')}
            />
          </div>
          <GroupConflictPanel response={preflight.response as never} />
        </div>
      ) : null}
    </div>
  );
}
