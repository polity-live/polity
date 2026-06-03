/**
 * Group Edit Form Component
 *
 * Complete form for editing group information including basic info,
 * location, social media, and image upload.
 */

import { Button } from '@/features/shared/ui/ui/button';
import { Loader2 } from 'lucide-react';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/ui/hashtag-editor';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { BasicInfoSection } from './BasicInfoSection';
import { GroupTypeSection } from './GroupTypeSection';
import { LocationInfoSection } from './LocationInfoSection';
import { SocialMediaSection } from './SocialMediaSection';
import { useGroupUpdate } from '../hooks/useGroupUpdate';
import type { GroupFormData, GroupType } from '../hooks/useGroupUpdate';
import { useState, useRef } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { CreateReviewCard, SummaryField } from '@/features/shared/ui/ui/create-review-card';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import { useAllGroups, useGroupState } from '@/zero/groups/useGroupState';
import { useNetworkLinkState } from '@/zero/network';
import { getGroupRelationshipRightLabel } from '@/features/network/ui/GroupRelationshipFields';
import { RIGHT_TYPES, type RightType } from '@/features/network/ui/RightFilters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import { Label } from '@/features/shared/ui/ui/label';
import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import { useGroupConflictPreflight } from '../hooks/useGroupConflictPreflight';
import { GroupConflictDialog, GroupConflictPanel } from './GroupConflictPanel';
import { getCanonicalMembershipModeLabel } from '@/features/network/logic/networkLinkDerived';

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
  const { groupLinks } = useNetworkLinkState({ groupId });
  const selectableConnectedGroups = availableGroups.filter(group => group.id !== groupId);
  const selectableConnectedRoles = (connectedGroupRoles ?? []).filter(
    role => role.scope === 'group' && role.assignee_kind !== 'guest'
  );
  const relationshipDirectionOptions: {
    value: GroupFormData['connected_relationship_directions'][RightType];
    label: string;
  }[] = [
    { value: 'none', label: 'Keine' },
    { value: 'outgoing', label: 'Aktuelle Gruppe -> andere' },
    { value: 'incoming', label: 'Andere -> aktuelle Gruppe' },
    { value: 'bidirectional', label: 'Beidseitig' },
  ];
  const existingSiblingLink =
    formData.connected_group_id == null
      ? null
      : (groupLinks.find(
          link =>
            link.structural_relation === 'sibling' &&
            ((link.source_group_id === groupId &&
              link.target_group_id === formData.connected_group_id) ||
              (link.source_group_id === formData.connected_group_id &&
                link.target_group_id === groupId))
        ) ?? null);
  const siblingRights = RIGHT_TYPES.flatMap(right => {
    const direction = formData.connected_relationship_directions[right];
    if (direction === 'none') {
      return [];
    }

    return [
      {
        id: existingSiblingLink?.rights?.find(existingRight => existingRight.right_key === right)
          ?.id,
        right_key: right,
        direction:
          direction === 'bidirectional'
            ? ('bidirectional' as const)
            : direction === 'outgoing'
              ? ('forward' as const)
              : ('backward' as const),
        status:
          (existingSiblingLink?.rights?.find(existingRight => existingRight.right_key === right)
            ?.status as 'active' | 'requested' | 'pending' | 'rejected' | undefined) ?? 'requested',
        initiator_group_id:
          existingSiblingLink?.rights?.find(existingRight => existingRight.right_key === right)
            ?.initiator_group_id ?? groupId,
      },
    ];
  });
  const backwardMembershipRule = {
    membership_mode: formData.sibling_membership_mode ?? 'none',
    role_id:
      formData.sibling_membership_mode === 'role_members'
        ? (formData.sibling_role_id ?? null)
        : null,
    source_group_ids:
      formData.sibling_membership_mode === 'selected_source_groups'
        ? (formData.parliament_source_group_ids ?? [])
        : null,
  };
  const forwardMembershipRule = {
    membership_mode:
      existingSiblingLink == null
        ? 'none'
        : existingSiblingLink.source_group_id === groupId
          ? (existingSiblingLink.membership_rule?.forward_membership_mode ?? 'none')
          : (existingSiblingLink.membership_rule?.backward_membership_mode ??
            existingSiblingLink.membership_rule?.membership_mode ??
            'none'),
    role_id:
      existingSiblingLink == null
        ? null
        : existingSiblingLink.source_group_id === groupId
          ? (existingSiblingLink.membership_rule?.forward_role_id ?? null)
          : (existingSiblingLink.membership_rule?.backward_role_id ??
            existingSiblingLink.membership_rule?.role_id ??
            null),
    source_group_ids:
      existingSiblingLink == null
        ? null
        : existingSiblingLink.source_group_id === groupId
          ? (existingSiblingLink.membership_rule?.forward_source_group_ids ?? null)
          : (existingSiblingLink.membership_rule?.backward_source_group_ids ??
            existingSiblingLink.membership_rule?.source_group_ids ??
            null),
  };
  const siblingConfigurationPreflight = useGroupConflictPreflight(
    groupType === 'sibling' && formData.connected_group_id && siblingRights.length > 0
      ? {
          kind: 'network_link_upsert',
          link_id: existingSiblingLink?.id,
          source_group_id: groupId,
          target_group_id: formData.connected_group_id,
          structural_relation: 'sibling',
          rights: siblingRights,
          membership_rules: {
            forward: forwardMembershipRule,
            backward: backwardMembershipRule,
          },
          membership_rule: {
            membership_mode: backwardMembershipRule.membership_mode,
            role_id: backwardMembershipRule.role_id,
            source_group_ids: backwardMembershipRule.source_group_ids,
          },
        }
      : null,
    {
      enabled:
        groupType === 'sibling' && Boolean(formData.connected_group_id) && siblingRights.length > 0,
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
        label="Group Image"
        description="Upload a group image or provide a URL"
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
            <Label>Verbundene Gruppe</Label>
            <Select
              value={formData.connected_group_id ?? ''}
              onValueChange={value => updateField('connected_group_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Gruppe waehlen" />
              </SelectTrigger>
              <SelectContent>
                {selectableConnectedGroups.map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name || 'Group'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mitgliedschaftsmodus</Label>
            <Select
              value={formData.sibling_membership_mode ?? 'none'}
              onValueChange={value =>
                updateField(
                  'sibling_membership_mode',
                  value as GroupFormData['sibling_membership_mode']
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['none', 'all_members', 'role_members', 'selected_source_groups'] as const).map(
                  mode => (
                    <SelectItem key={mode} value={mode}>
                      {getCanonicalMembershipModeLabel(mode)}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {formData.sibling_membership_mode === 'role_members' ? (
            <div className="space-y-2">
              <Label>Verbundene Rolle</Label>
              <Select
                value={formData.sibling_role_id ?? ''}
                onValueChange={value => updateField('sibling_role_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rolle waehlen" />
                </SelectTrigger>
                <SelectContent>
                  {selectableConnectedRoles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name || 'Role'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {formData.sibling_membership_mode === 'selected_source_groups' ? (
            <div className="space-y-2">
              <Label>Source groups</Label>
              <div className="grid gap-2 rounded-lg border p-3">
                {availableGroups
                  .filter(group => group.id !== groupId)
                  .map(group => {
                    const checked =
                      formData.parliament_source_group_ids?.includes(group.id) ?? false;
                    return (
                      <Label
                        key={group.id}
                        className="flex items-center gap-3 rounded-md border px-3 py-2"
                      >
                        <Checkbox
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
                        <span className="text-sm">{group.name || 'Group'}</span>
                      </Label>
                    );
                  })}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Rechterichtung</Label>
              <p className="text-muted-foreground text-xs">
                Lege pro Recht fest, in welche Richtung die Verbindung zur verbundenen Gruppe wirkt.
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
                  <Select
                    value={formData.connected_relationship_directions[right]}
                    onValueChange={value =>
                      updateField('connected_relationship_directions', {
                        ...formData.connected_relationship_directions,
                        [right]:
                          value as GroupFormData['connected_relationship_directions'][RightType],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {relationshipDirectionOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      'Diese Konfiguration ist aktuell blockiert.'}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Bitte bereinige die Konflikte, bevor du speicherst.
                  </div>
                </div>
                <GroupConflictDialog
                  response={siblingConfigurationPreflight.response}
                  triggerLabel="Details"
                  title="Warum ist diese Konfiguration blockiert?"
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
        <label className="text-sm font-medium">Hashtags</label>
        <HashtagEditor
          value={formData.hashtags}
          onChange={tags => setFormData({ ...formData, hashtags: tags })}
          label="Hashtags"
          showLabel={false}
          placeholder="Add hashtags..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
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
              {isCreating ? t('pages.create.common.creating') : 'Saving...'}
            </>
          ) : isCreating ? (
            t('pages.create.next')
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
}
