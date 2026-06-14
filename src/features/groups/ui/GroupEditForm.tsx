import {
  FormControlLabel,
  FormControlSelect,
  FormControlCheckbox,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
/**
 * Group Edit Form Component
 *
 * Complete form for editing group information including basic info,
 * location, social media, and image upload.
 */

import { Button } from '@/features/shared/ui/ui/button';
import { Loader2 } from 'lucide-react';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { BasicInfoSection } from './BasicInfoSection';
import { GroupTypeSection } from './GroupTypeSection';
import { LocationInfoSection } from './LocationInfoSection';
import { SocialMediaSection } from './SocialMediaSection';
import { useGroupUpdate } from '../hooks/useGroupUpdate';
import type { GroupFormData, GroupType } from '../hooks/useGroupUpdate';
import { useState, useRef } from 'react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { CreateReviewCard, SummaryField } from '@/features/shared/ui/form';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import { useAllGroups, useGroupState } from '@/zero/groups/useGroupState';
import { useGroupConnectionState } from '@/zero/network';
import { getGroupRelationshipRightLabel } from '@/features/network/ui/GroupRelationshipFields';
import { RIGHT_TYPES, type RightType } from '@/features/network/ui/RightFilters';
import { useGroupConflictPreflight } from '../hooks/useGroupConflictPreflight';
import { GroupConflictDialog, GroupConflictPanel } from './GroupConflictPanel';
import { getCanonicalMembershipModeLabel } from '@/features/network/logic/groupConnectionDerived';
import {
  canonicalGroupPair,
  getExpandedRightDirections,
  getRightGrantEndpoints,
} from '@/features/network/logic/groupConnectionComposer';

interface GroupEditFormProps {
  groupId: string;
  initialData?: Partial<GroupFormData>;
  onCancel?: () => void;
  actorId?: string;
  visibility?: 'public' | 'private' | 'authenticated';
  groupType?: GroupType;
}

export function GroupEditForm({
  groupId,
  initialData,
  onCancel,
  actorId,
  visibility,
  groupType,
}: GroupEditFormProps) {
  const { t } = useTranslation();
  const isCreating = !initialData;
  const [showReview, setShowReview] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const {
    formData,
    setFormData,
    updateDescriptionContent,
    updateField,
    removeImage,
    handleSubmit,
    isSubmitting,
  } = useGroupUpdate(groupId, initialData, { actorId, visibility, groupType });
  const { groups: allGroups } = useAllGroups();
  const availableGroups = allGroups.filter(
    (group): group is NonNullable<(typeof allGroups)[number]> => Boolean(group?.id)
  );
  const { roles: connectedGroupRoles } = useGroupState({
    groupId: formData.connected_group_id ?? undefined,
  });
  const { groupConnections } = useGroupConnectionState({ groupId });
  const selectableConnectedGroups = availableGroups.filter(group => group.id !== groupId);
  const selectableConnectedRoles = (connectedGroupRoles ?? []).filter(
    role => role.scope === 'group' && role.assignee_kind !== 'guest'
  );
  const relationshipDirectionOptions: {
    value: GroupFormData['connectedRelationshipDirections'][RightType];
    label: string;
  }[] = [
    { value: 'none', label: translateText('generated.inline.0159_keine_3ce60e74') },
    {
      value: 'current_has_right_in_partner',
      label: translateText(
        'generated.inline.0160_aktuelle_gruppe_hat_recht_in_partnergruppe_ca1db0de'
      ),
    },
    {
      value: 'partner_has_right_in_current',
      label: translateText(
        'generated.inline.0161_partnergruppe_hat_recht_in_aktueller_gruppe_8b85ec2f'
      ),
    },
    {
      value: 'mutual',
      label: translateText('generated.inline.0162_beide_haben_das_recht_gegenseitig_a982cb49'),
    },
  ];
  const membershipDirectionOptions: {
    value: NonNullable<GroupFormData['siblingMembershipDirection']>;
    label: string;
    description: string;
  }[] = [
    {
      value: 'partner_members_to_current',
      label: translateText('generated.inline.0163_partnergruppe_aktuelle_gruppe_d9e667ae'),
      description: translateText(
        'generated.inline.0164_mitglieder_fliessen_aus_der_partnergruppe_in__034d78c0'
      ),
    },
    {
      value: 'current_members_to_partner',
      label: translateText('generated.inline.0165_aktuelle_gruppe_partnergruppe_e947dfc0'),
      description: translateText(
        'generated.inline.0166_mitglieder_fliessen_aus_der_aktuellen_gruppe__57884822'
      ),
    },
  ];
  const existingSiblingLink =
    formData.connected_group_id == null
      ? null
      : (groupConnections.find(
          connection =>
            connection.connection_type === 'peer' &&
            ((connection.group_a_id === groupId &&
              connection.group_b_id === formData.connected_group_id) ||
              (connection.group_a_id === formData.connected_group_id &&
                connection.group_b_id === groupId))
        ) ?? null);
  const siblingGrants = RIGHT_TYPES.flatMap(right => {
    const direction = formData.connectedRelationshipDirections[right];
    return getExpandedRightDirections(direction).map(selectedDirection => {
      const endpoints = getRightGrantEndpoints(
        selectedDirection,
        groupId,
        formData.connected_group_id ?? ''
      );
      return {
        id: existingSiblingLink?.grants?.find(
          existingGrant =>
            existingGrant.right_key === right &&
            existingGrant.holder_group_id === endpoints.holder_group_id &&
            existingGrant.scope_group_id === endpoints.scope_group_id
        )?.id,
        right_key: right,
        ...endpoints,
        status: 'active' as const,
        initiator_group_id: groupId,
      };
    });
  });
  const siblingMembershipRule = {
    membership_mode: formData.sibling_membership_mode ?? 'none',
    required_source_role_id:
      formData.sibling_membership_mode === 'role_members'
        ? (formData.sibling_role_id ?? null)
        : null,
    eligible_origin_group_ids:
      formData.sibling_membership_mode === 'selected_source_groups'
        ? (formData.parliament_source_group_ids ?? [])
        : [],
  };
  const pair = formData.connected_group_id
    ? canonicalGroupPair(groupId, formData.connected_group_id)
    : null;
  const hasSiblingMembership =
    formData.sibling_membership_mode != null &&
    formData.sibling_membership_mode !== 'none' &&
    formData.siblingMembershipDirection != null;
  const siblingConfigurationPreflight = useGroupConflictPreflight(
    groupType === 'sibling' &&
      formData.connected_group_id &&
      pair &&
      (siblingGrants.length > 0 || hasSiblingMembership)
      ? {
          kind: 'group_connection_upsert',
          connection_id: existingSiblingLink?.id,
          ...pair,
          connection_type: 'peer',
          parent_group_id: null,
          child_group_id: null,
          grants: siblingGrants,
          membership_rule: hasSiblingMembership
            ? {
                member_source_group_id:
                  formData.siblingMembershipDirection === 'current_members_to_partner'
                    ? groupId
                    : formData.connected_group_id,
                member_target_group_id:
                  formData.siblingMembershipDirection === 'current_members_to_partner'
                    ? formData.connected_group_id
                    : groupId,
                membership_mode: siblingMembershipRule.membership_mode as
                  | 'all_members'
                  | 'role_members'
                  | 'selected_source_groups',
                required_source_role_id: siblingMembershipRule.required_source_role_id,
                eligible_origin_group_ids: siblingMembershipRule.eligible_origin_group_ids,
              }
            : null,
        }
      : null,
    {
      enabled:
        groupType === 'sibling' &&
        Boolean(formData.connected_group_id) &&
        (siblingGrants.length > 0 || hasSiblingMembership),
    }
  );

  const onFormSubmit = (e: React.FormEvent) => {
    if (siblingConfigurationPreflight.blocking) {
      e.preventDefault();
      return;
    }

    if (isCreating && !showReview) {
      e.preventDefault();
      if (!formData.name.trim()) return;
      setShowReview(true);
      return;
    }
    handleSubmit(e);
  };

  const confirmCreate = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  if (isCreating && showReview) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{t('pages.create.common.review')}</h1>
        </div>
        <div className="max-w-2xl">
          <CreateReviewCard
            entityType="group"
            badge={t('pages.create.group.reviewBadge')}
            title={formData.name || 'Untitled Group'}
            subtitle={formData.description || undefined}
            hashtags={formData.hashtags}
            media={
              formData.imageURL
                ? { imageUrl: formData.imageURL, imageAlt: formData.name || 'Group image' }
                : undefined
            }
          >
            {formatLocation(formData) && (
              <SummaryField
                label={t('features.groups.location.title')}
                value={formatLocation(formData)}
              />
            )}
          </CreateReviewCard>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setShowReview(false)}>
              {t('pages.create.previous')}
            </Button>
            <Button
              onClick={confirmCreate}
              disabled={isSubmitting || siblingConfigurationPreflight.blocking}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('pages.create.common.creating')}
                </>
              ) : (
                t('pages.create.group.createButton')
              )}
            </Button>
          </div>
        </div>
        {/* Hidden form to allow real submission */}
        <form ref={formRef} onSubmit={onFormSubmit} className="hidden" />
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onFormSubmit} className="space-y-6">
      {/* Group Image Section */}
      <ImageUpload
        currentImage={formData.imageURL}
        onImageChange={(url: string) => updateField('imageURL', url)}
        onImageRemove={isCreating ? undefined : removeImage}
        cleanupOnRemove
        entityType="groups"
        entityId={groupId}
        label={translateText('generated.inline.0671_group_image_70e21c64')}
        description={translateText(
          'generated.inline.0672_upload_a_group_image_or_provide_a_url_7f743f85'
        )}
      />

      {/* Basic Information */}
      <BasicInfoSection
        formData={formData}
        onNameChange={value => updateField('name', value)}
        onDescriptionContentChange={updateDescriptionContent}
      />

      {/* Visibility */}
      <VisibilityInput value={formData.visibility} onChange={v => updateField('visibility', v)} />

      {/* Group Type */}
      {groupType && <GroupTypeSection groupType={groupType} />}

      {groupType === 'sibling' ? (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <FormControlLabel>
              {translateText('generated.inline.0547_verbundene_gruppe_2d1da077')}
            </FormControlLabel>
            <FormControlSelect
              value={formData.connected_group_id ?? ''}
              onValueChange={value => updateField('connected_group_id', value)}
            >
              <FormControlSelectTrigger>
                <FormControlSelectValue
                  placeholder={translateText('generated.inline.0673_gruppe_waehlen_ef267c5c')}
                />
              </FormControlSelectTrigger>
              <FormControlSelectContent>
                {selectableConnectedGroups.map(group => (
                  <FormControlSelectItem key={group.id} value={group.id}>
                    {group.name || translateText('generated.inline.0094_group_171a0606')}
                  </FormControlSelectItem>
                ))}
              </FormControlSelectContent>
            </FormControlSelect>
          </div>

          <div className="space-y-2">
            <FormControlLabel>
              {translateText('generated.inline.0674_membership_richtung_3a1dbdaf')}
            </FormControlLabel>
            <FormControlSelect
              value={formData.siblingMembershipDirection ?? ''}
              onValueChange={value =>
                updateField(
                  'siblingMembershipDirection',
                  value as GroupFormData['siblingMembershipDirection']
                )
              }
            >
              <FormControlSelectTrigger>
                <FormControlSelectValue
                  placeholder={translateText('generated.inline.0675_richtung_waehlen_2c1eefdb')}
                />
              </FormControlSelectTrigger>
              <FormControlSelectContent>
                {membershipDirectionOptions.map(option => (
                  <FormControlSelectItem key={option.value} value={option.value}>
                    <div className="space-y-1">
                      <div>{option.label}</div>
                      <div className="text-muted-foreground text-xs">{option.description}</div>
                    </div>
                  </FormControlSelectItem>
                ))}
              </FormControlSelectContent>
            </FormControlSelect>
          </div>

          <div className="space-y-2">
            <FormControlLabel>
              {translateText('generated.inline.0676_mitgliedschaftsmodus_cb90aa67')}
            </FormControlLabel>
            <FormControlSelect
              value={formData.sibling_membership_mode ?? 'none'}
              onValueChange={value =>
                updateField(
                  'sibling_membership_mode',
                  value as GroupFormData['sibling_membership_mode']
                )
              }
            >
              <FormControlSelectTrigger>
                <FormControlSelectValue />
              </FormControlSelectTrigger>
              <FormControlSelectContent>
                {(['none', 'all_members', 'role_members', 'selected_source_groups'] as const).map(
                  mode => (
                    <FormControlSelectItem key={mode} value={mode}>
                      {getCanonicalMembershipModeLabel(mode)}
                    </FormControlSelectItem>
                  )
                )}
              </FormControlSelectContent>
            </FormControlSelect>
          </div>

          {formData.sibling_membership_mode === 'role_members' ? (
            <div className="space-y-2">
              <FormControlLabel>
                {translateText('generated.inline.0677_verbundene_rolle_6c578cbb')}
              </FormControlLabel>
              <FormControlSelect
                value={formData.sibling_role_id ?? ''}
                onValueChange={value => updateField('sibling_role_id', value)}
              >
                <FormControlSelectTrigger>
                  <FormControlSelectValue
                    placeholder={translateText('generated.inline.0678_rolle_waehlen_51cf1595')}
                  />
                </FormControlSelectTrigger>
                <FormControlSelectContent>
                  {selectableConnectedRoles.map(role => (
                    <FormControlSelectItem key={role.id} value={role.id}>
                      {role.name || translateText('generated.inline.0092_role_c3f104d1')}
                    </FormControlSelectItem>
                  ))}
                </FormControlSelectContent>
              </FormControlSelect>
            </div>
          ) : null}

          {formData.sibling_membership_mode === 'selected_source_groups' ? (
            <div className="space-y-2">
              <FormControlLabel>
                {translateText('generated.inline.0679_source_groups_ad11f792')}
              </FormControlLabel>
              <div className="grid gap-2 rounded-lg border p-3">
                {availableGroups
                  .filter(group => group.id !== groupId)
                  .map(group => {
                    const checked =
                      formData.parliament_source_group_ids?.includes(group.id) ?? false;
                    return (
                      <FormControlLabel
                        key={group.id}
                        className="flex items-center gap-3 rounded-md border px-3 py-2"
                      >
                        <FormControlCheckbox
                          checked={checked}
                          onCheckedChange={(nextChecked: boolean | 'indeterminate') =>
                            updateField(
                              'parliament_source_group_ids',
                              nextChecked === true
                                ? [
                                    ...new Set([
                                      ...(formData.parliament_source_group_ids ?? []),
                                      group.id,
                                    ]),
                                  ]
                                : (formData.parliament_source_group_ids ?? []).filter(
                                    currentId => currentId !== group.id
                                  )
                            )
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

          <div className="space-y-3">
            <div className="space-y-1">
              <FormControlLabel>
                {translateText('generated.inline.0680_rechterichtung_75533cc6')}
              </FormControlLabel>
              <p className="text-muted-foreground text-xs">
                {translateText(
                  'generated.inline.0681_lege_pro_recht_fest_in_welche_richtung_die_ve_27eaae4c'
                )}
              </p>
            </div>
            <div className="grid gap-3">
              {RIGHT_TYPES.map(right => (
                <div
                  key={right}
                  className="grid gap-2 rounded-lg border p-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-center"
                >
                  <div className="text-sm font-medium">
                    {getGroupRelationshipRightLabel(right, t)}
                  </div>
                  <FormControlSelect
                    value={formData.connectedRelationshipDirections[right]}
                    onValueChange={value =>
                      updateField('connectedRelationshipDirections', {
                        ...formData.connectedRelationshipDirections,
                        [right]:
                          value as GroupFormData['connectedRelationshipDirections'][RightType],
                      })
                    }
                  >
                    <FormControlSelectTrigger>
                      <FormControlSelectValue />
                    </FormControlSelectTrigger>
                    <FormControlSelectContent>
                      {relationshipDirectionOptions.map(option => (
                        <FormControlSelectItem key={option.value} value={option.value}>
                          {option.label}
                        </FormControlSelectItem>
                      ))}
                    </FormControlSelectContent>
                  </FormControlSelect>
                </div>
              ))}
            </div>
          </div>

          {siblingConfigurationPreflight.blocking ? (
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {siblingConfigurationPreflight.response.summary ??
                      translateText(
                        'generated.inline.0095_diese_konfiguration_ist_aktuell_blockiert_42554ab1'
                      )}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {translateText(
                      'generated.inline.0682_bitte_bereinige_die_konflikte_bevor_du_speich_ec2bc1a4'
                    )}
                  </div>
                </div>
                <GroupConflictDialog
                  response={siblingConfigurationPreflight.response}
                  triggerLabel={translateText('generated.inline.0683_details_dc3decbb')}
                  title={translateText(
                    'generated.inline.0684_warum_ist_diese_konfiguration_blockiert_bef0cbe3'
                  )}
                />
              </div>
              <GroupConflictPanel response={siblingConfigurationPreflight.response} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Location Information */}
      <LocationInfoSection formData={formData} onChange={updateField} />

      {/* Social Media Links */}
      <SocialMediaSection formData={formData} onChange={updateField} />

      {/* Hashtags */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {translateText('generated.inline.0685_hashtags_338da6e1')}
        </label>
        <HashtagEditor
          value={formData.hashtags}
          onChange={tags => setFormData({ ...formData, hashtags: tags })}
          label={translateText('generated.inline.0685_hashtags_338da6e1')}
          showLabel={false}
          placeholder={translateText('generated.inline.0686_add_hashtags_258ebb1b')}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {translateText('generated.inline.0065_cancel_77dfd213')}
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || siblingConfigurationPreflight.blocking}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isCreating
                ? t('pages.create.common.creating')
                : translateText('generated.inline.0096_saving_ae7e8875')}
            </>
          ) : isCreating ? (
            t('pages.create.next')
          ) : (
            translateText('generated.inline.0097_save_changes_fa2984b3')
          )}
        </Button>
      </div>
    </form>
  );
}
