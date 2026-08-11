'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import {
  FormControlLabel,
  FormControlRadioGroup,
  FormControlRadioGroupItem,
} from '@/features/shared/ui/form';
import { ScrollableTabsList } from '@/features/shared/ui/navigation';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { GroupConflictDialog, GroupConflictPanel } from '@/features/groups/ui/GroupConflictPanel';
import {
  applyGroupConnectionPreset,
  GROUP_CONNECTION_PRESET_OPTIONS,
  getPresetMembershipDirection,
  SELECTABLE_MEMBERSHIP_MODES,
} from '../logic/groupConnectionComposer';
import {
  getCanonicalMembershipModeLabel,
  getSiblingMembershipKind,
} from '../logic/groupConnectionDerived';
import type {
  CanonicalMembershipMode,
  GroupConnectionComposerTab,
  GroupConnectionPreset,
  RelativeMembershipDirection,
} from '../types/network.types';
import {
  GroupRelationshipMembershipModeDescription,
  GroupRelationshipNameTag,
  GroupRelationshipRightsSelector,
  GroupRelationshipTypeSelect,
} from './GroupRelationshipFields';
import {
  APP_TUTORIAL_EXPECTED_INPUTS,
  APP_TUTORIAL_NETWORK_RIGHT_DIRECTIONS,
} from '@/features/app-tutorial/catalog';
import { reportAppTutorialAction } from '@/features/app-tutorial/events';
import {
  collectAppTutorialFixtureTextAliases,
  getAppTutorialFixtureTextVariants,
  resolveAppTutorialFixtureText,
  resolveAppTutorialFixtureValue,
} from '@/features/app-tutorial/fixture-copy';
import type { AppTutorialLanguage } from '@/features/app-tutorial/catalog';

const MEMBERSHIP_MODE_OPTIONS = [...SELECTABLE_MEMBERSHIP_MODES];
const PRESET_OPTIONS = [...GROUP_CONNECTION_PRESET_OPTIONS];

function getMembershipDirectionLabel(
  direction: RelativeMembershipDirection,
  t: ReturnType<typeof useTranslation>['t']
) {
  return direction === 'partner_members_to_current'
    ? t('common.network.membershipDirectionReceivesLabel')
    : t('common.network.membershipDirectionSendsLabel');
}

function getMembershipDirectionDescription(
  direction: RelativeMembershipDirection,
  t: ReturnType<typeof useTranslation>['t']
) {
  return direction === 'partner_members_to_current'
    ? t('common.network.membershipDirectionReceivesDescription')
    : t('common.network.membershipDirectionSendsDescription');
}

function getSafeGroupDisplayName(name: string | null | undefined, fallback: string) {
  const trimmedName = name?.trim();
  return trimmedName ? trimmedName : fallback;
}

function getPresetLabel(preset: GroupConnectionPreset, t: ReturnType<typeof useTranslation>['t']) {
  if (preset === 'parent') {
    return t('common.network.presetChildLabel');
  }

  if (preset === 'child') {
    return t('common.network.presetParentLabel');
  }

  if (preset === 'role_members_to_partner') {
    return t('common.network.presetSendsRoleMembersLabel');
  }

  return t('common.network.presetReceivesRoleMembersLabel');
}

function getRoleSelectorLabel(
  direction: RelativeMembershipDirection,
  t: ReturnType<typeof useTranslation>['t']
) {
  return direction === 'partner_members_to_current'
    ? t('common.network.roleInSelectedGroup')
    : t('common.network.roleInThisGroup');
}

function RequiredRoleSelectorLabel({ label }: { label: string }) {
  return (
    <>
      {label}{' '}
      <span className="text-destructive" aria-hidden="true">
        *
      </span>
    </>
  );
}

function PresetDescription({
  preset,
  currentGroupId,
  selectedGroupId,
  selectedGroupName,
}: {
  preset: GroupConnectionPreset;
  currentGroupId: string;
  selectedGroupId: string;
  selectedGroupName: string;
}) {
  const { t } = useTranslation();
  const safeSelectedGroupName = getSafeGroupDisplayName(
    selectedGroupName,
    t('common.network.selectedPartnerGroup', 'Gewählte Partnergruppe')
  );

  const currentTag = (
    <GroupRelationshipNameTag
      name=""
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
        {currentTag}
        <span>{t('common.network.isChildGroupOf')}</span>
        {selectedTag}
      </div>
    );
  }

  if (preset === 'child') {
    return (
      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
        {currentTag}
        <span>{t('common.network.isParentGroupOf')}</span>
        {selectedTag}
      </div>
    );
  }

  if (preset === 'role_members_to_partner') {
    return (
      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
        {currentTag}
        <span>{t('common.network.sendsRoleMembersTo')}</span>
        {selectedTag}
      </div>
    );
  }

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
      {currentTag}
      <span>{t('common.network.receivesRoleMembersFrom')}</span>
      {selectedTag}
    </div>
  );
}
export interface GroupConnectionComposerViewProps {
  activeTab: any;
  onActiveTabChange: any;
  value: any;
  onValueChange: any;
  currentGroupId: any;
  currentGroupName: any;
  availableGroups: any;
  selectableRolesByDirection: any;
  existingRightStatuses: any;
  preflight: any;
  disabledRelationshipOptions: any;
  disableGroupSelection: any;
  groupSelectorLabel: any;
  t: any;
  language: AppTutorialLanguage;
  selectedGroupName: any;
  directionOptions: any;
  selectedRights: any;
  selectedPreset: any;
  selectedPresetMembershipDirection: any;
  presetMembershipRule: any;
  presetDisabled: any;
  getPresetDisabledReason: any;
  membershipDirection: any;
  activeMembershipRule: any;
  selectableRoles: any;
  updateMembershipRule: any;
  setActiveMembershipDirection: any;
  updateRightDirection: any;
}

function toLocalizedGroupTypeaheadItems(
  groups: any[],
  language: AppTutorialLanguage
): TypeaheadItem[] {
  return toTypeaheadItems(
    groups,
    'group',
    (group: any) =>
      resolveAppTutorialFixtureText(group.name, {
        tutorialRunId: group.tutorial_run_id,
        language,
      }) || 'Group',
    (group: any) => {
      const description = richTextToPlainText(
        resolveAppTutorialFixtureValue(group.description, {
          tutorialRunId: group.tutorial_run_id,
          language,
        })
      );
      return description ? description.substring(0, 60) : undefined;
    },
    undefined,
    (group: any) => `/group/${group.id}`
  ).map((item, index) => ({
    ...item,
    keywords: [
      ...(item.keywords ?? []),
      ...getAppTutorialFixtureTextVariants(groups[index]?.name, {
        tutorialRunId: groups[index]?.tutorial_run_id,
      }),
      ...(groups[index]?.tutorial_run_id
        ? collectAppTutorialFixtureTextAliases(richTextToPlainText(groups[index]?.description))
        : []),
    ],
  }));
}

export function GroupConnectionComposerView({
  activeTab,
  onActiveTabChange,
  value,
  onValueChange,
  currentGroupId,
  currentGroupName,
  availableGroups,
  selectableRolesByDirection,
  existingRightStatuses,
  preflight,
  disabledRelationshipOptions,
  disableGroupSelection,
  groupSelectorLabel,
  t,
  language,
  selectedGroupName,
  directionOptions,
  selectedRights,
  selectedPreset,
  selectedPresetMembershipDirection,
  presetMembershipRule,
  presetDisabled,
  getPresetDisabledReason,
  membershipDirection,
  activeMembershipRule,
  selectableRoles,
  updateMembershipRule,
  setActiveMembershipDirection,
  updateRightDirection,
}: GroupConnectionComposerViewProps) {
  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={nextValue => onActiveTabChange(nextValue as GroupConnectionComposerTab)}
        className="space-y-4"
      >
        <ScrollableTabsList>
          <TabsTrigger
            value="preset"
            className="min-w-max flex-1"
            data-action-id="network.connection-composer.mode.preset"
          >
            {translateText('generated.inline.0777_vorkonfiguriert_895eea86')}
          </TabsTrigger>
          <TabsTrigger
            value="advanced"
            className="min-w-max flex-1"
            data-action-id="network.connection-composer.mode.advanced"
          >
            {translateText('generated.inline.0778_link_selbst_konfigurieren_7eab7242')}
          </TabsTrigger>
        </ScrollableTabsList>

        <div className="grid gap-2" data-tutorial-anchor="network-group-search">
          <FormControlLabel htmlFor="group-connection-composer-group">
            {groupSelectorLabel}
          </FormControlLabel>
          {disableGroupSelection ? (
            <div className="bg-muted/30 rounded-md border px-3 py-2 text-sm font-medium">
              {selectedGroupName || currentGroupName}
            </div>
          ) : (
            <TypeaheadSearch
              items={toLocalizedGroupTypeaheadItems(availableGroups, language)}
              value={value.selectedGroupId}
              onChange={(item: TypeaheadItem | null) => {
                onValueChange({
                  ...value,
                  selectedGroupId: item?.id ?? '',
                });
                const selectedGroup = availableGroups.find((group: any) => group.id === item?.id);
                if (item && selectedGroup?.tutorial_run_id) {
                  reportAppTutorialAction({
                    type: 'entity-selection',
                    entityId: item.id,
                  });
                }
              }}
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
                  onValueChange={nextValue => {
                    if (presetDisabled(nextValue as GroupConnectionPreset)) {
                      return;
                    }
                    onValueChange(
                      applyGroupConnectionPreset(nextValue as GroupConnectionPreset, value)
                    );
                  }}
                >
                  <div className="grid gap-2 md:grid-cols-2">
                    {PRESET_OPTIONS.map((option: any) => {
                      const disabled = presetDisabled(option.value);
                      const disabledReason = getPresetDisabledReason?.(option.value);
                      const isSelected = selectedPreset.value === option.value;
                      return (
                        <FormControlLabel
                          key={option.value}
                          htmlFor={`preset-${option.value}`}
                          data-tutorial-anchor={
                            option.value === 'parent' ? 'network-child-preset' : undefined
                          }
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          <FormControlRadioGroupItem
                            id={`preset-${option.value}`}
                            value={option.value}
                            disabled={disabled}
                            data-action-id="network.connection-composer.preset.select"
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="text-sm font-medium">
                              {getPresetLabel(option.value, t)}
                            </div>
                            {disabledReason ? (
                              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                {disabledReason}
                              </div>
                            ) : null}
                            <div className="bg-muted/30 rounded-md px-3 py-2">
                              <div className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase">
                                {t('common.network.relationship')}
                              </div>
                              <PresetDescription
                                preset={option.value}
                                currentGroupId={currentGroupId}
                                selectedGroupId={value.selectedGroupId}
                                selectedGroupName={selectedGroupName}
                              />
                            </div>
                            <div
                              className={cn(
                                'rounded-md px-3 py-2',
                                featureThemeClassName('networkGroupConnectionComposerThemedText')
                              )}
                            >
                              <div className="mb-1 text-[11px] font-semibold uppercase">
                                {t('common.network.membershipLabel', 'Membership')}
                              </div>
                              <GroupRelationshipMembershipModeDescription
                                membershipMode={option.membershipMode}
                                direction={getPresetMembershipDirection(option.value)}
                                currentGroupId={currentGroupId}
                                currentGroupName=""
                                selectedGroupId={value.selectedGroupId}
                                selectedGroupName={selectedGroupName}
                                linkGroups={false}
                              />
                            </div>
                          </div>
                        </FormControlLabel>
                      );
                    })}
                  </div>
                </FormControlRadioGroup>
              </div>

              {selectedPreset.value === 'elected' ||
              selectedPreset.value === 'role_members_to_partner' ? (
                <div className="grid gap-2">
                  <FormControlLabel>
                    <RequiredRoleSelectorLabel
                      label={getRoleSelectorLabel(selectedPresetMembershipDirection, t)}
                    />
                  </FormControlLabel>
                  <TypeaheadSearch
                    items={toTypeaheadItems(
                      selectableRolesByDirection[selectedPresetMembershipDirection] ?? [],
                      'role',
                      (role: any) => role.name || 'Role',
                      (role: any) => role.description || undefined
                    )}
                    value={presetMembershipRule.roleId}
                    onChange={(item: TypeaheadItem | null) =>
                      updateMembershipRule(selectedPresetMembershipDirection, {
                        membershipMode: 'role_members',
                        roleId: item?.id ?? '',
                        sourceGroupIds: [],
                      })
                    }
                    placeholder={getRoleSelectorLabel(selectedPresetMembershipDirection, t)}
                    ariaRequired
                    disablePortal
                    showAllOnFocus
                  />
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
                      ).map((direction: any) => (
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
                            data-action-id="network.connection-composer.membership-direction.select"
                          />
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {getMembershipDirectionLabel(direction, t)}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {getMembershipDirectionDescription(direction, t)}
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
                          sourceGroupIds: [],
                        })
                      }
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        {MEMBERSHIP_MODE_OPTIONS.map((option: any) => {
                          const disabled =
                            option === 'role_members' &&
                            membershipDirection === 'current_members_to_partner' &&
                            Boolean(getPresetDisabledReason?.('role_members_to_partner'));
                          const disabledReason = disabled
                            ? getPresetDisabledReason?.('role_members_to_partner')
                            : null;

                          return (
                            <FormControlLabel
                              key={`${membershipDirection}-${option}`}
                              htmlFor={`advanced-membership-mode-${membershipDirection}-${option}`}
                              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                activeMembershipRule.membershipMode === option
                                  ? 'border-primary bg-primary/5'
                                  : 'hover:bg-muted/50'
                              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              <FormControlRadioGroupItem
                                id={`advanced-membership-mode-${membershipDirection}-${option}`}
                                value={option}
                                disabled={disabled}
                                data-action-id="network.connection-composer.membership-mode.select"
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
                                {disabledReason ? (
                                  <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                    {disabledReason}
                                  </div>
                                ) : null}
                              </div>
                            </FormControlLabel>
                          );
                        })}
                      </div>
                    </FormControlRadioGroup>
                  </div>

                  {activeMembershipRule.membershipMode === 'role_members' ? (
                    <div className="grid gap-2">
                      <FormControlLabel>
                        <RequiredRoleSelectorLabel
                          label={getRoleSelectorLabel(membershipDirection, t)}
                        />
                      </FormControlLabel>
                      <TypeaheadSearch
                        items={toTypeaheadItems(
                          selectableRoles,
                          'role',
                          (role: any) => role.name || 'Role',
                          (role: any) => role.description || undefined
                        )}
                        value={activeMembershipRule.roleId}
                        onChange={(item: TypeaheadItem | null) =>
                          updateMembershipRule(membershipDirection, {
                            roleId: item?.id ?? '',
                          })
                        }
                        placeholder={getRoleSelectorLabel(membershipDirection, t)}
                        ariaRequired
                        disablePortal
                        showAllOnFocus
                      />
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
          tutorialAnchor="network-rights-selector"
          tutorialInputValues={[
            ...(value.rightDirections.informationRight !== 'none' &&
            value.rightDirections.amendmentRight !== 'none'
              ? [APP_TUTORIAL_EXPECTED_INPUTS.networkRightsSelected]
              : []),
            ...(value.rightDirections.informationRight ===
              APP_TUTORIAL_NETWORK_RIGHT_DIRECTIONS.outgoing &&
            value.rightDirections.amendmentRight === APP_TUTORIAL_NETWORK_RIGHT_DIRECTIONS.outgoing
              ? [APP_TUTORIAL_EXPECTED_INPUTS.networkRightsOutgoing]
              : []),
            ...(value.rightDirections.informationRight ===
              APP_TUTORIAL_NETWORK_RIGHT_DIRECTIONS.incoming &&
            value.rightDirections.amendmentRight === APP_TUTORIAL_NETWORK_RIGHT_DIRECTIONS.incoming
              ? [APP_TUTORIAL_EXPECTED_INPUTS.networkRightsIncoming]
              : []),
          ]}
          label={translateText('generated.inline.0787_rechte_11cf94d4')}
          helperText={t('common.network.existingRightsStatusHint')}
          selectedRights={selectedRights}
          onToggleRight={right => {
            const direction =
              value.rightDirections[right] === 'none' ? 'current_grants_right_to_partner' : 'none';
            const nextDirections = {
              ...value.rightDirections,
              [right]: direction,
            };
            updateRightDirection(right, direction);
            if (
              nextDirections.informationRight !== 'none' &&
              nextDirections.amendmentRight !== 'none'
            ) {
              reportAppTutorialAction({
                type: 'input',
                value: APP_TUTORIAL_EXPECTED_INPUTS.networkRightsSelected,
              });
            }
          }}
          existingRightStatuses={existingRightStatuses}
          rightDirections={value.rightDirections}
          onDirectionChange={(right, direction) => {
            const nextDirections = {
              ...value.rightDirections,
              [right]: direction,
            };
            updateRightDirection(right, direction);
            if (
              nextDirections.informationRight === APP_TUTORIAL_NETWORK_RIGHT_DIRECTIONS.incoming &&
              nextDirections.amendmentRight === APP_TUTORIAL_NETWORK_RIGHT_DIRECTIONS.incoming
            ) {
              reportAppTutorialAction({
                type: 'input',
                value: APP_TUTORIAL_EXPECTED_INPUTS.networkRightsIncoming,
              });
            }
          }}
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
