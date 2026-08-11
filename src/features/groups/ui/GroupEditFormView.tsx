import { featureThemeClassName } from '@/features/shared/theme';
import {
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
  SettingsActionBar,
  SettingsTabs,
} from '@/features/shared/ui/form';
import { TabsContent } from '@/features/shared/ui/ui/tabs';
/**
 * Group Edit Form Component
 *
 * Complete form for editing group information including basic info,
 * location, social media, and image upload.
 */

import { Button } from '@/features/shared/ui/ui/button';
import { MediaUpload } from '@/features/file-upload/ui/MediaUpload';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { BasicInfoSection } from './BasicInfoSection';
import { GroupTypeSection } from './GroupTypeSection';
import { LocationInfoSection } from './LocationInfoSection';
import { SocialMediaSection } from './SocialMediaSection';
import type { GroupFormData } from '../hooks/useGroupUpdate';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { CreateReviewCard, SummaryField } from '@/features/shared/ui/form';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import { getGroupRelationshipRightLabel } from '@/features/network/ui/GroupRelationshipFields';
import { RIGHT_TYPES, type RightType } from '@/features/shared/ui/status';
import { GroupConflictDialog, GroupConflictPanel } from './GroupConflictPanel';
import { getCanonicalMembershipModeLabel } from '@/features/network/logic/groupConnectionDerived';
import { GROUP_EDIT_MEMBERSHIP_MODE_OPTIONS } from './groupEditMembershipModes';
import { GroupThemeSettings } from './GroupThemeSettings';
export interface GroupEditFormViewProps {
  groupId: any;
  initialData: any;
  onCancel: any;
  actorId: any;
  visibility: any;
  groupType: any;
  hasHierarchyChildren?: boolean | null;
  hasSiblingConnections?: boolean | null;
  showSiblingRelationshipEditor: boolean;
  activeTab: 'general' | 'relationships' | 'contact' | 'themes';
  onTabChange: (tab: 'general' | 'relationships' | 'contact' | 'themes') => void;
  canManageGroup?: boolean;
  t: any;
  isCreating: any;
  showReview: any;
  setShowReview: any;
  formRef: any;
  formData: any;
  setFormData: any;
  updateDescriptionContent: any;
  updateField: any;
  removeImage: any;
  handleSubmit: any;
  isSubmitting: any;
  allGroups: any[];
  connectedGroupRoles?: any[];
  groupConnections: any[];
  selectableConnectedGroups: any[];
  selectableConnectedRoles: any[];
  relationshipDirectionOptions: any[];
  membershipDirectionOptions: any[];
  existingSiblingLink: any;
  siblingGrants: any;
  siblingMembershipRule: any;
  pair: any;
  hasSiblingMembership: any;
  siblingConfigurationPreflight: any;
  onFormSubmit: any;
  confirmCreate: any;
}

export function GroupEditFormView({
  groupId,
  onCancel,
  groupType,
  hasHierarchyChildren,
  hasSiblingConnections,
  showSiblingRelationshipEditor,
  activeTab,
  onTabChange,
  t,
  isCreating,
  showReview,
  setShowReview,
  formRef,
  formData,
  setFormData,
  updateDescriptionContent,
  updateField,
  removeImage,
  isSubmitting,
  selectableConnectedGroups,
  selectableConnectedRoles,
  relationshipDirectionOptions,
  membershipDirectionOptions,
  siblingConfigurationPreflight,
  onFormSubmit,
  confirmCreate,
  canManageGroup = true,
}: GroupEditFormViewProps) {
  const siblingConfigurationChecking = Boolean(siblingConfigurationPreflight.isLoading);
  const siblingConfigurationCheckingLabel = t('common.checks.siblingConfiguration');
  const submitLoadingLabel = isSubmitting
    ? isCreating
      ? t('pages.create.common.creating')
      : translateText('generated.inline.0096_saving_ae7e8875')
    : siblingConfigurationChecking
      ? siblingConfigurationCheckingLabel
      : undefined;

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
            title={formData.name || t('pages.create.group.untitledGroup')}
            subtitle={formData.description || undefined}
            hashtags={formData.hashtags}
            media={{
              imageUrl: formData.imageURL || undefined,
              imageAlt: formData.name || t('features.groups.editPage.groupImageAlt'),
              videoUrl: formData.videoURL || undefined,
            }}
          >
            {formatLocation(formData) && (
              <SummaryField
                label={t('features.groups.location.title')}
                value={formatLocation(formData)}
              />
            )}
          </CreateReviewCard>
          <div className="mt-6 flex gap-3">
            <Button
              data-action-id="groups.edit.review.back"
              variant="outline"
              onClick={() => setShowReview(false)}
            >
              {t('pages.create.previous')}
            </Button>
            <Button
              data-action-id="groups.edit.review.confirm-create"
              onClick={confirmCreate}
              disabled={siblingConfigurationPreflight.blocking}
              loading={isSubmitting || siblingConfigurationChecking}
              loadingLabel={submitLoadingLabel}
              className="flex-1"
            >
              {t('pages.create.group.createButton')}
            </Button>
          </div>
        </div>
        {/* Hidden form to allow real submission */}
        <form
          data-action-scope="presentation"
          ref={formRef}
          onSubmit={onFormSubmit}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <form
      data-action-scope="presentation"
      ref={formRef}
      onSubmit={onFormSubmit}
      className="space-y-6"
    >
      <SettingsTabs
        value={activeTab}
        onValueChange={onTabChange}
        tabs={[
          ...(canManageGroup
            ? [{ value: 'general' as const, label: t('pages.group.settingsTabs.general') }]
            : []),
          ...(canManageGroup && showSiblingRelationshipEditor
            ? [
                {
                  value: 'relationships' as const,
                  label: t('pages.group.settingsTabs.relationships'),
                },
              ]
            : []),
          ...(canManageGroup
            ? [{ value: 'contact' as const, label: t('pages.group.settingsTabs.contact') }]
            : []),
          ...(!isCreating
            ? [{ value: 'themes' as const, label: t('pages.group.settingsTabs.themes') }]
            : []),
        ]}
      >
        <TabsContent value="general" className="space-y-6">
          {/* Group Image Section */}
          <MediaUpload
            currentImage={formData.imageURL}
            onImageChange={(url: string) => updateField('imageURL', url)}
            currentVideo={formData.videoURL}
            onVideoChange={(url: string) => updateField('videoURL', url)}
            onImageRemove={isCreating ? undefined : removeImage}
            cleanupOnRemove
            exclusiveMedia
            entityType="groups"
            entityId={groupId}
            imageLabel={translateText('generated.inline.0671_group_image_70e21c64')}
            imageDescription={translateText(
              'generated.inline.0672_upload_a_group_image_or_provide_a_url_7f743f85'
            )}
            videoLabel={t('common.actions.uploadVideo')}
            videoDescription={t('common.media.videoDescription')}
          />

          {/* Basic Information */}
          <BasicInfoSection
            formData={formData}
            onNameChange={value => updateField('name', value)}
            onDescriptionContentChange={updateDescriptionContent}
          />

          {/* Visibility */}
          <VisibilityInput
            value={formData.visibility}
            onChange={v => updateField('visibility', v)}
          />

          {/* Group Type */}
          {groupType && (
            <GroupTypeSection
              groupType={groupType}
              hasHierarchyChildren={hasHierarchyChildren}
              hasSiblingConnections={hasSiblingConnections}
            />
          )}

          <div className="space-y-2">
            <FormControlLabel>
              {translateText('generated.inline.0685_hashtags_338da6e1')}
            </FormControlLabel>
            <HashtagEditor
              value={formData.hashtags}
              onChange={tags => setFormData({ ...formData, hashtags: tags })}
              label={translateText('generated.inline.0685_hashtags_338da6e1')}
              showLabel={false}
              placeholder={translateText('generated.inline.0686_add_hashtags_258ebb1b')}
            />
          </div>
        </TabsContent>

        {showSiblingRelationshipEditor ? (
          <TabsContent value="relationships" className="space-y-6">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <FormControlLabel>
                  {translateText('generated.inline.0547_verbundene_gruppe_2d1da077')}
                </FormControlLabel>
                <FormControlSelect
                  data-action-scope="presentation"
                  value={formData.connected_group_id ?? ''}
                  onValueChange={value => updateField('connected_group_id', value)}
                >
                  <FormControlSelectTrigger data-action-id="groups.edit.relationship.connected-group.open">
                    <FormControlSelectValue
                      placeholder={translateText('generated.inline.0673_gruppe_waehlen_ef267c5c')}
                    />
                  </FormControlSelectTrigger>
                  <FormControlSelectContent>
                    {selectableConnectedGroups.map((group: any) => (
                      <FormControlSelectItem
                        data-action-id="groups.edit.relationship.connected-group.choose"
                        key={group.id}
                        value={group.id}
                      >
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
                  data-action-scope="presentation"
                  value={formData.siblingMembershipDirection ?? ''}
                  onValueChange={value =>
                    updateField(
                      'siblingMembershipDirection',
                      value as GroupFormData['siblingMembershipDirection']
                    )
                  }
                >
                  <FormControlSelectTrigger data-action-id="groups.edit.relationship.membership-direction.open">
                    <FormControlSelectValue
                      placeholder={translateText('generated.inline.0675_richtung_waehlen_2c1eefdb')}
                    />
                  </FormControlSelectTrigger>
                  <FormControlSelectContent>
                    {membershipDirectionOptions.map((option: any) => (
                      <FormControlSelectItem
                        data-action-id="groups.edit.relationship.membership-direction.choose"
                        key={option.value}
                        value={option.value}
                      >
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
                  data-action-scope="presentation"
                  value={formData.sibling_membership_mode ?? 'none'}
                  onValueChange={value =>
                    updateField(
                      'sibling_membership_mode',
                      value as GroupFormData['sibling_membership_mode']
                    )
                  }
                >
                  <FormControlSelectTrigger data-action-id="groups.edit.relationship.membership-mode.open">
                    <FormControlSelectValue />
                  </FormControlSelectTrigger>
                  <FormControlSelectContent>
                    {GROUP_EDIT_MEMBERSHIP_MODE_OPTIONS.map((mode: any) => (
                      <FormControlSelectItem
                        data-action-id="groups.edit.relationship.membership-mode.choose"
                        key={mode}
                        value={mode}
                      >
                        {getCanonicalMembershipModeLabel(mode)}
                      </FormControlSelectItem>
                    ))}
                  </FormControlSelectContent>
                </FormControlSelect>
              </div>

              {formData.sibling_membership_mode === 'role_members' ? (
                <div className="space-y-2">
                  <FormControlLabel>
                    {translateText('generated.inline.0677_verbundene_rolle_6c578cbb')}
                  </FormControlLabel>
                  <FormControlSelect
                    data-action-scope="presentation"
                    value={formData.sibling_role_id ?? ''}
                    onValueChange={value => updateField('sibling_role_id', value)}
                  >
                    <FormControlSelectTrigger data-action-id="groups.edit.relationship.connected-role.open">
                      <FormControlSelectValue
                        placeholder={translateText('generated.inline.0678_rolle_waehlen_51cf1595')}
                      />
                    </FormControlSelectTrigger>
                    <FormControlSelectContent>
                      {selectableConnectedRoles.map((role: any) => (
                        <FormControlSelectItem
                          data-action-id="groups.edit.relationship.connected-role.choose"
                          key={role.id}
                          value={role.id}
                        >
                          {role.name || translateText('generated.inline.0092_role_c3f104d1')}
                        </FormControlSelectItem>
                      ))}
                    </FormControlSelectContent>
                  </FormControlSelect>
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
                  {RIGHT_TYPES.map((right: any) => (
                    <div
                      key={right}
                      className="grid gap-2 rounded-lg border p-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-center"
                    >
                      <div className="text-sm font-medium">
                        {getGroupRelationshipRightLabel(right, t)}
                      </div>
                      <FormControlSelect
                        data-action-scope="presentation"
                        value={formData.connectedRelationshipDirections[right]}
                        onValueChange={value =>
                          updateField('connectedRelationshipDirections', {
                            ...formData.connectedRelationshipDirections,
                            [right]:
                              value as GroupFormData['connectedRelationshipDirections'][RightType],
                          })
                        }
                      >
                        <FormControlSelectTrigger data-action-id="groups.edit.relationship.right-direction.open">
                          <FormControlSelectValue />
                        </FormControlSelectTrigger>
                        <FormControlSelectContent>
                          {relationshipDirectionOptions.map((option: any) => (
                            <FormControlSelectItem
                              data-action-id="groups.edit.relationship.right-direction.choose"
                              key={option.value}
                              value={option.value}
                            >
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
                <div className={featureThemeClassName('groupGroupConflictPanelWarningSurface')}>
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
              ) : siblingConfigurationChecking ? (
                <div className="text-muted-foreground text-sm" aria-live="polite">
                  {siblingConfigurationCheckingLabel}
                </div>
              ) : null}
            </div>
          </TabsContent>
        ) : null}

        <TabsContent value="contact" className="space-y-6">
          <LocationInfoSection formData={formData} onChange={updateField} />
          <SocialMediaSection formData={formData} onChange={updateField} />
        </TabsContent>
        {!isCreating && (
          <TabsContent value="themes" className="space-y-6">
            <GroupThemeSettings groupId={groupId} />
          </TabsContent>
        )}
      </SettingsTabs>

      {/* Action Buttons */}
      {canManageGroup && activeTab !== 'themes' && (
        <SettingsActionBar className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onCancel && (
            <Button
              data-action-id="groups.edit.cancel"
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {translateText('generated.inline.0065_cancel_77dfd213')}
            </Button>
          )}
          <Button
            data-action-id="groups.edit.submit"
            type="submit"
            disabled={siblingConfigurationPreflight.blocking}
            loading={isSubmitting || siblingConfigurationChecking}
            loadingLabel={submitLoadingLabel}
          >
            {isCreating
              ? t('pages.create.next')
              : translateText('generated.inline.0097_save_changes_fa2984b3')}
          </Button>
        </SettingsActionBar>
      )}
    </form>
  );
}
