'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import {
  FormControlLabel,
  FormControlCheckbox,
  FormControlRadioGroup,
  FormControlRadioGroupItem,
} from '@/features/shared/ui/form';
import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { GroupConflictDialog, GroupConflictPanel } from '@/features/groups/ui/GroupConflictPanel';
import {
  applyGroupConnectionPreset,
  getPresetMembershipDirection,
  getRelationshipTypeForPreset,
  getSelectedMembershipDirection,
} from '../logic/groupConnectionComposer';
import {
  getCanonicalMembershipModeLabel,
  getSiblingMembershipKind,
} from '../logic/groupConnectionDerived';
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

function getMembershipDirectionLabel(direction: RelativeMembershipDirection) {
  return direction === 'partner_members_to_current'
    ? 'Partnergruppe -> aktuelle Gruppe'
    : 'Aktuelle Gruppe -> Partnergruppe';
}

function getMembershipDirectionDescription(direction: RelativeMembershipDirection) {
  return direction === 'partner_members_to_current'
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
  preset: GroupConnectionPreset;
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
        <span>{translateText('generated.inline.0769_diese_gew_hlte_partnergruppe_5fc97466')}</span>
        {selectedTag}
        <span>
          {translateText('generated.inline.0770_ist_bergeordnet_die_aktuelle_gruppe_36b12d80')}
        </span>
        {currentTag}
        <span>{translateText('generated.inline.0771_ist_untergeordnet_9610f87b')}</span>
      </div>
    );
  }

  if (preset === 'child') {
    return (
      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
        <span>{translateText('generated.inline.0772_die_aktuelle_gruppe_d7fbaf59')}</span>
        {currentTag}
        <span>
          {translateText(
            'generated.inline.0773_ist_bergeordnet_die_gew_hlte_partnergruppe_4d9d2a93'
          )}
        </span>
        {selectedTag}
        <span>{translateText('generated.inline.0771_ist_untergeordnet_9610f87b')}</span>
      </div>
    );
  }

  if (preset === 'parliament') {
    return (
      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
        <span>{translateText('generated.inline.0772_die_aktuelle_gruppe_d7fbaf59')}</span>
        {currentTag}
        <span>
          {translateText('generated.inline.0774_und_die_gew_hlte_partnergruppe_a51207fb')}
        </span>
        {selectedTag}
        <span>
          {translateText(
            'generated.inline.0775_werden_als_parlamentgruppe_miteinander_verbun_ccaad49c'
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
      <span>{translateText('generated.inline.0772_die_aktuelle_gruppe_d7fbaf59')}</span>
      {currentTag}
      <span>{translateText('generated.inline.0774_und_die_gew_hlte_partnergruppe_a51207fb')}</span>
      {selectedTag}
      <span>
        {translateText(
          'generated.inline.0776_werden_als_gew_hlte_gruppe_miteinander_verbun_333f88b7'
        )}
      </span>
    </div>
  );
}

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
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={nextValue => onActiveTabChange(nextValue as GroupConnectionComposerTab)}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preset">
            {translateText('generated.inline.0777_vorkonfiguriert_895eea86')}
          </TabsTrigger>
          <TabsTrigger value="advanced">
            {translateText('generated.inline.0778_link_selbst_konfigurieren_7eab7242')}
          </TabsTrigger>
        </TabsList>

        <div className="grid gap-2">
          <FormControlLabel htmlFor="group-connection-composer-group">
            {groupSelectorLabel}
          </FormControlLabel>
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
                    typeof group.description ===
                    translateText('generated.inline.0056_string_ecb25204')
                      ? group.description
                      : null;
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
              placeholder={translateText('generated.inline.0779_gruppe_ausw_hlen_e7c82c9a')}
              disablePortal
              showAllOnFocus
            />
          )}
        </div>

        <TabsContent value="preset" className="space-y-4">
          {value.selectedGroupId ? (
            <>
              <div className="grid gap-2">
                <FormControlLabel>
                  {translateText('generated.inline.0780_variante_f51a07e2')}
                </FormControlLabel>
                <FormControlRadioGroup
                  value={value.preset}
                  onValueChange={nextValue =>
                    onValueChange(
                      applyGroupConnectionPreset(nextValue as GroupConnectionPreset, value)
                    )
                  }
                >
                  <div className="grid gap-2 md:grid-cols-2">
                    {PRESET_OPTIONS.map(option => {
                      const disabled = presetDisabled(option.value);
                      const isSelected = selectedPreset.value === option.value;
                      return (
                        <FormControlLabel
                          key={option.value}
                          htmlFor={`preset-${option.value}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          <FormControlRadioGroupItem
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
                            <div
                              className={featureThemeClassName(
                                'networkGroupConnectionComposerThemedText'
                              )}
                            >
                              {`Membership: ${getCanonicalMembershipModeLabel(option.membershipMode)}`}
                            </div>
                          </div>
                        </FormControlLabel>
                      );
                    })}
                  </div>
                </FormControlRadioGroup>
              </div>

              {selectedPreset.value === 'elected' ? (
                <div className="grid gap-2">
                  <FormControlLabel>
                    {translateText('generated.inline.0781_rolle_der_verbundenen_gruppe_b0e1caee')}
                  </FormControlLabel>
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
                    placeholder={translateText(
                      'generated.inline.0782_mitgliedsrolle_der_verbundenen_gruppe_w_hlen_61c518a8'
                    )}
                    disablePortal
                    showAllOnFocus
                  />
                </div>
              ) : null}

              {selectedPreset.value === 'parliament' ? (
                <div className="grid gap-2">
                  <FormControlLabel>
                    {translateText('generated.inline.0679_source_groups_ad11f792')}
                  </FormControlLabel>
                  <div className="grid gap-2 rounded-lg border p-3">
                    {availableGroups
                      .filter(group => group.id !== presetMembershipSourceGroupId)
                      .map(group => {
                        const checked = presetMembershipRule.sourceGroupIds.includes(group.id);
                        return (
                          <FormControlLabel
                            key={group.id}
                            className="flex items-center gap-3 rounded-md border px-3 py-2"
                          >
                            <FormControlCheckbox
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
                            <span className="text-sm">
                              {group.name || translateText('generated.inline.0094_group_171a0606')}
                            </span>
                          </FormControlLabel>
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
                label={translateText('generated.inline.0783_beziehungsart_e1412743')}
                value={value.relationshipType}
                currentGroupName={currentGroupName}
                selectedGroupName={selectedGroupName}
                currentGroupId={currentGroupId}
                selectedGroupId={value.selectedGroupId}
                siblingMembershipMode={
                  value.relationshipType === 'sibling'
                    ? (getSiblingMembershipKind(activeMembershipRule.membershipMode) ?? undefined)
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
                  <FormControlLabel>
                    {translateText('generated.inline.0674_membership_richtung_3a1dbdaf')}
                  </FormControlLabel>
                  <FormControlRadioGroup
                    value={membershipDirection}
                    onValueChange={nextValue =>
                      setActiveMembershipDirection(nextValue as RelativeMembershipDirection)
                    }
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          'partner_members_to_current',
                          'current_members_to_partner',
                        ] as RelativeMembershipDirection[]
                      ).map(direction => (
                        <FormControlLabel
                          key={`membership-direction-${direction}`}
                          htmlFor={`membership-direction-${direction}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            membershipDirection === direction
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <FormControlRadioGroupItem
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
                        </FormControlLabel>
                      ))}
                    </div>
                  </FormControlRadioGroup>
                </div>

                <div className="grid gap-4 rounded-lg border p-4">
                  <div className="grid gap-2">
                    <FormControlLabel>
                      {translateText('generated.inline.0784_membership_mode_5a0af553')}
                    </FormControlLabel>
                    <FormControlRadioGroup
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
                          <FormControlLabel
                            key={`${membershipDirection}-${option}`}
                            htmlFor={`advanced-membership-mode-${membershipDirection}-${option}`}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                              activeMembershipRule.membershipMode === option
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <FormControlRadioGroupItem
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
                          </FormControlLabel>
                        ))}
                      </div>
                    </FormControlRadioGroup>
                  </div>

                  {activeMembershipRule.membershipMode === 'role_members' ? (
                    <div className="grid gap-2">
                      <FormControlLabel>
                        {translateText('generated.inline.0785_rolle_der_quellgruppe_808d2b9d')}
                      </FormControlLabel>
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
                        placeholder={translateText(
                          'generated.inline.0786_mitgliedsrolle_w_hlen_f325f806'
                        )}
                        disablePortal
                        showAllOnFocus
                      />
                    </div>
                  ) : null}

                  {activeMembershipRule.membershipMode === 'selected_source_groups' ? (
                    <div className="grid gap-2">
                      <FormControlLabel>
                        {translateText('generated.inline.0679_source_groups_ad11f792')}
                      </FormControlLabel>
                      <div className="grid gap-2 rounded-lg border p-3">
                        {availableGroups
                          .filter(group => group.id !== activeMembershipSourceGroupId)
                          .map(group => {
                            const checked = activeMembershipRule.sourceGroupIds.includes(group.id);
                            return (
                              <FormControlLabel
                                key={`${membershipDirection}-${group.id}`}
                                className="flex items-center gap-3 rounded-md border px-3 py-2"
                              >
                                <FormControlCheckbox
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
                                <span className="text-sm">
                                  {group.name ||
                                    translateText('generated.inline.0094_group_171a0606')}
                                </span>
                              </FormControlLabel>
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
          label={translateText('generated.inline.0787_rechte_11cf94d4')}
          helperText={t('common.network.existingRightsStatusHint')}
          selectedRights={selectedRights}
          onToggleRight={right =>
            updateRightDirection(
              right,
              value.rightDirections[right] === 'none' ? 'current_has_right_in_partner' : 'none'
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
        <div className={featureThemeClassName('groupGroupConflictPanelWarningSurface')}>
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
