import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Value } from 'platejs';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { DateTimeRangeInput } from '../ui/inputs/DateTimeRangeInput';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useCommonState } from '@/zero/common';
import { useAllGroups, useGroupRoles } from '@/zero/groups/useGroupState';
import { useUserState } from '@/zero/users/useUserState';
import { useAuth } from '@/providers/auth-provider';
import {
  getCurrentGroupRelationshipLabel,
  type GroupRelationshipRight,
} from '@/features/network/ui/GroupRelationshipFields';
import type { ColumnDef } from '@/features/shared/ui/data-table';
import { isValidOptionalEmailAddress } from '@/features/shared/logic/inputValidation';
import { matchInviteCsvUsers, type InviteCsvMatchResult } from '../logic/groupInviteCsv';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import {
  geoLocationFieldsFromShape,
  type GeoLocationShape,
} from '@/features/shared/logic/geoLocationShape';
import {
  EMPTY_RICH_TEXT_VALUE,
  richTextToPlainText,
  toZeroRichTextValue,
} from '@/features/shared/logic/richText';
import { toast } from '@/features/shared/ui/ui/sonner';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import type {
  CanonicalMembershipMode,
  GroupRelationshipDirection,
  GroupRelationshipType,
  GroupConnectionComposerMembershipRuleValue,
  GroupConnectionComposerTab,
  GroupConnectionPreset,
  RelativeMembershipDirection,
} from '@/features/network/types/network.types';
import { getSiblingMembershipKind } from '@/features/network/logic/groupConnectionDerived';
import { useGroupConnectionComposerPreflight } from '@/features/network/hooks/useGroupConnectionComposerPreflight';
import {
  applyGroupConnectionPreset,
  buildCanonicalGroupConnectionPayload,
  buildGroupConnectionComposerDefaults,
  createEmptyMembershipRule,
  hasConfiguredGroupConnection,
  hasIncompleteMembershipRule,
} from '@/features/network/logic/groupConnectionComposer';
import { CreateRichTextField } from '../ui/inputs/CreateRichTextField';
import { GroupTypeInput } from '../ui/inputs/GroupTypeInput';
import { GroupConnectionsInput } from '../ui/inputs/GroupConnectionsInput';
import { GroupLocationInput } from '../ui/inputs/GroupLocationInput';
import { GroupMediaSettingsInput } from '../ui/inputs/GroupMediaSettingsInput';
import { GroupInvitePeopleInput } from '../ui/inputs/GroupInvitePeopleInput';
import { ConstitutionalEventToggleInput } from '../ui/inputs/ConstitutionalEventToggleInput';
import { CreateGroupSummaryStep } from '../ui/CreateGroupSummaryStep';
import {
  createBlockedSubmitOutcome,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';
import {
  consumeCreateRestoreDraft,
  trackCreateFinalization,
  waitForOptimisticCreate,
} from '../logic/createFinalization';
import { toLocalTimestamp } from '@/features/shared/logic/localDateTime';

type GroupType = 'base' | 'hierarchical' | 'sibling';
type RelationshipDirection = GroupRelationshipDirection;
type LinkedGroupType = GroupRelationshipType;

interface LinkedGroup {
  groupId: string;
  groupName: string;
  type: LinkedGroupType;
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: GroupConnectionComposerMembershipRuleValue;
  membershipMode: CanonicalMembershipMode;
  roleId: string;
  sourceGroupIds: string[];
  rightDirections: Record<GroupRelationshipRight, RelationshipDirection>;
}

const INITIAL_SIBLING_RIGHT_DIRECTIONS: Record<GroupRelationshipRight, RelationshipDirection> = {
  informationRight: 'none',
  amendmentRight: 'none',
  rightToSpeak: 'none',
  activeVotingRight: 'none',
  passiveVotingRight: 'none',
};

const RELATIONSHIP_RIGHTS = Object.keys(
  INITIAL_SIBLING_RIGHT_DIRECTIONS
) as GroupRelationshipRight[];

interface CsvInviteSummary extends InviteCsvMatchResult {
  matchedNames: string[];
}

type CreateGroupRestoreState = Partial<{
  groupType: GroupType;
  name: string;
  description: string;
  descriptionContent: Value;
  email: string;
  country: string;
  region: string;
  post_code: string;
  city: string;
  street: string;
  house_number: string;
  latitude: number | null;
  longitude: number | null;
  locationShape: GeoLocationShape | null;
  imageURL: string;
  videoURL: string;
  hashtags: string[];
  visibility: 'public' | 'authenticated' | 'private';
  invitedUserIds: string[];
  linkedGroups: LinkedGroup[];
  createConstitutionalEvent: boolean;
  eventName: string;
  eventLocation: string;
  eventStartDate: string;
  eventStartTime: string;
}>;

function createInitialRelationshipDirections(): Record<
  GroupRelationshipRight,
  RelationshipDirection
> {
  return { ...INITIAL_SIBLING_RIGHT_DIRECTIONS };
}

function getSelectedRights(rightDirections: Record<GroupRelationshipRight, RelationshipDirection>) {
  return RELATIONSHIP_RIGHTS.filter(right => rightDirections[right] !== 'none');
}

const CREATE_LINK_DEFAULT_PRESET: GroupConnectionPreset = 'child';
const CREATE_GROUP_CURRENT_ROLE_MEMBERSHIP_DISABLED_REASON =
  'Create this group first before sending members by one of its roles. Roles for this group are created after the group exists.';

function cloneMembershipRule(
  membershipRule: GroupConnectionComposerMembershipRuleValue | null | undefined
): GroupConnectionComposerMembershipRuleValue {
  const fallbackRule = createEmptyMembershipRule();
  return {
    membershipMode: membershipRule?.membershipMode ?? fallbackRule.membershipMode,
    roleId: membershipRule?.roleId ?? fallbackRule.roleId,
    sourceGroupIds: [...(membershipRule?.sourceGroupIds ?? fallbackRule.sourceGroupIds)],
  };
}

function toLinkedGroup(args: {
  groupId: string;
  groupName: string;
  type: LinkedGroupType;
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: GroupConnectionComposerMembershipRuleValue;
  rightDirections: Record<GroupRelationshipRight, RelationshipDirection>;
}): LinkedGroup {
  const displayMembershipRule = cloneMembershipRule(args.membershipRule);

  return {
    groupId: args.groupId,
    groupName: args.groupName,
    type: args.type,
    membershipDirection: args.membershipDirection,
    membershipRule: displayMembershipRule,
    membershipMode: displayMembershipRule.membershipMode,
    roleId: displayMembershipRule.roleId,
    sourceGroupIds: [...displayMembershipRule.sourceGroupIds],
    rightDirections: { ...args.rightDirections },
  };
}

function buildCreateLinkPresetDefaults(preset: GroupConnectionPreset = CREATE_LINK_DEFAULT_PRESET) {
  const presetValue = applyGroupConnectionPreset(preset, buildGroupConnectionComposerDefaults());

  return {
    type: presetValue.relationshipType as LinkedGroupType,
    membershipDirection: presetValue.membershipDirection,
    membershipRule: cloneMembershipRule(presetValue.membershipRule),
    rightDirections: { ...presetValue.rightDirections } as Record<
      GroupRelationshipRight,
      RelationshipDirection
    >,
    preset: presetValue.preset,
  };
}

function buildCanonicalGroupConnection(args: {
  currentGroupId: string;
  otherGroupId: string;
  connectionType: LinkedGroupType;
  rightDirections: Record<GroupRelationshipRight, RelationshipDirection>;
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: GroupConnectionComposerMembershipRuleValue;
}) {
  return buildCanonicalGroupConnectionPayload({
    currentGroupId: args.currentGroupId,
    otherGroupId: args.otherGroupId,
    relationshipType: args.connectionType,
    rightDirections: args.rightDirections,
    membershipDirection: args.membershipDirection,
    membershipRule: cloneMembershipRule(args.membershipRule),
    initiatorGroupId: args.currentGroupId,
    status: 'requested',
  });
}

export function useCreateGroupForm(): CreateFormConfig {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { createFullGroup } = useGroupActions();
  const { groups: allGroups } = useAllGroups();
  const availableGroups = useMemo(
    () =>
      allGroups.filter((group): group is NonNullable<(typeof allGroups)[number]> =>
        Boolean(group?.id)
      ),
    [allGroups]
  );
  const { allUsers } = useUserState({ includeAllUsers: true });

  const [groupId] = useState(() => crypto.randomUUID());
  const [groupType, setGroupType] = useState<GroupType>('base');
  const initialLinkPresetState = buildCreateLinkPresetDefaults();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionContent, setDescriptionContent] = useState<Value>(EMPTY_RICH_TEXT_VALUE);
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [post_code, setPostCode] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [house_number, setHouseNumber] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationShape, setLocationShape] = useState<GeoLocationShape | null>(null);
  const [imageURL, setImageURL] = useState('');
  const [videoURL, setVideoURL] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'authenticated' | 'private'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite members state
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);
  const [csvInviteSummary, setCsvInviteSummary] = useState<CsvInviteSummary | null>(null);

  // Link groups state
  const [linkedGroups, setLinkedGroups] = useState<LinkedGroup[]>([]);
  const [linkGroupId, setLinkGroupId] = useState('');
  const [linkType, setLinkType] = useState<LinkedGroupType>(initialLinkPresetState.type);
  const [linkMembershipDirection, setLinkMembershipDirection] =
    useState<RelativeMembershipDirection | null>(initialLinkPresetState.membershipDirection);
  const [linkMembershipRule, setLinkMembershipRule] = useState(() =>
    cloneMembershipRule(initialLinkPresetState.membershipRule)
  );
  const [linkRightDirections, setLinkRightDirections] = useState<
    Record<GroupRelationshipRight, RelationshipDirection>
  >(() => initialLinkPresetState.rightDirections);
  const [linkComposerTab, setLinkComposerTab] = useState<GroupConnectionComposerTab>('preset');
  const [linkPreset, setLinkPreset] = useState<GroupConnectionPreset>(
    initialLinkPresetState.preset
  );

  const { roles: selectedGroupRoles } = useGroupRoles(linkGroupId || groupId);
  const { roles: currentGroupRoles } = useGroupRoles(groupId);

  // Constitutional event state
  const [createConstitutionalEvent, setCreateConstitutionalEvent] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');

  useEffect(() => {
    const restoreDraft = consumeCreateRestoreDraft<CreateGroupRestoreState>('group');
    if (!restoreDraft) return;
    const state = restoreDraft.formState;

    setGroupType(state.groupType ?? 'base');
    setName(state.name ?? '');
    setDescription(state.description ?? '');
    setDescriptionContent(state.descriptionContent ?? EMPTY_RICH_TEXT_VALUE);
    setEmail(state.email ?? '');
    setCountry(state.country ?? '');
    setRegion(state.region ?? '');
    setPostCode(state.post_code ?? '');
    setCity(state.city ?? '');
    setStreet(state.street ?? '');
    setHouseNumber(state.house_number ?? '');
    setLatitude(state.latitude ?? null);
    setLongitude(state.longitude ?? null);
    setLocationShape(state.locationShape ?? null);
    setImageURL(state.imageURL ?? '');
    setVideoURL(state.videoURL ?? '');
    setHashtags(state.hashtags ?? []);
    setVisibility(state.visibility ?? 'public');
    setInvitedUserIds(state.invitedUserIds ?? []);
    setLinkedGroups(state.linkedGroups ?? []);
    setCreateConstitutionalEvent(state.createConstitutionalEvent ?? false);
    setEventName(state.eventName ?? '');
    setEventLocation(state.eventLocation ?? '');
    setEventStartDate(state.eventStartDate ?? '');
    setEventStartTime(state.eventStartTime ?? '');
  }, []);

  const getDefaultFoundingAssemblyName = useCallback(() => {
    const trimmedName = name.trim();
    return trimmedName
      ? t('pages.create.group.foundingAssemblyDefaultName', { groupName: trimmedName })
      : t('pages.create.group.foundingAssemblyDefaultNameFallback');
  }, [name, t]);

  const handleConstitutionalEventToggle = useCallback(
    (checked: boolean) => {
      setCreateConstitutionalEvent(checked);
      if (checked) {
        setEventName(currentName =>
          currentName.trim() ? currentName : getDefaultFoundingAssemblyName()
        );
      }
    },
    [getDefaultFoundingAssemblyName]
  );

  const { userHashtags } = useCommonState({
    user_id: user?.id,
  });
  const preferredHashtagSuggestions = useMemo(
    () => extractHashtagTags(userHashtags),
    [userHashtags]
  );
  const emailValidationMessage = t('common.validation.emailHint');
  const emailIsValid = isValidOptionalEmailAddress(email);
  const basicInfoInvalidReason = !name.trim()
    ? t('pages.create.group.validation.nameRequired')
    : !emailIsValid
      ? emailValidationMessage
      : null;
  const radioGroupType = groupType === 'sibling' ? 'hierarchical' : groupType;
  const siblingLinks = linkedGroups.filter(link => link.type === 'sibling');
  const siblingMembershipModes = siblingLinks.map(link => link.membershipMode);
  const activeLinkMembershipRule = cloneMembershipRule(linkMembershipRule);
  const siblingMembershipMode = activeLinkMembershipRule.membershipMode;
  const connectedRoleId = activeLinkMembershipRule.roleId;
  const hasConfiguredConnection = hasConfiguredGroupConnection({
    rightDirections: linkRightDirections,
    membershipDirection: linkMembershipDirection,
    membershipRule: linkMembershipRule,
  });
  const hasIncompleteLinkMembershipRules = hasIncompleteMembershipRule({
    membershipDirection: linkMembershipDirection,
    membershipRule: linkMembershipRule,
  });
  const hasSiblingLinks = siblingLinks.length > 0;
  const siblingLinksAllowOfficialInvites = siblingMembershipModes.every(
    mode => mode === 'none' || mode === 'all_members'
  );
  const hasGuestOnlySiblingMembership = siblingMembershipModes.some(
    mode => mode === 'role_members' || mode === 'selected_source_groups'
  );
  const allowOfficialMemberInvites =
    groupType === 'base' && (!hasSiblingLinks || siblingLinksAllowOfficialInvites);
  const allowGuestInvites = groupType === 'hierarchical' || hasGuestOnlySiblingMembership;
  const linkComposerValue = useMemo(
    () => ({
      selectedGroupId: linkGroupId,
      relationshipType: linkType,
      membershipDirection: linkMembershipDirection,
      membershipRule: linkMembershipRule,
      rightDirections: linkRightDirections,
      preset: linkPreset,
    }),
    [
      linkGroupId,
      linkMembershipDirection,
      linkMembershipRule,
      linkPreset,
      linkRightDirections,
      linkType,
    ]
  );

  useEffect(() => {
    setLinkMembershipRule(current => ({
      ...current,
      roleId: '',
    }));
  }, [linkGroupId]);

  const handleDescriptionContentChange = useCallback((value: Value) => {
    setDescriptionContent(value);
    setDescription(richTextToPlainText(value));
  }, []);

  const activeLinkConflictPreflight = useGroupConnectionComposerPreflight({
    currentGroupId: groupId,
    initiatorGroupId: groupId,
    value: linkComposerValue,
    enabled: Boolean(linkGroupId),
  });

  const handleCsvUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = evt => {
        const text = evt.target?.result as string;
        if (!text) return;

        const result = matchInviteCsvUsers(text, allUsers, { excludeUserId: user?.id });

        if (result.missingColumns) {
          setCsvInviteSummary(null);
          toast.error(t('pages.create.group.csvMissingColumns'));
          return;
        }

        if (
          result.matchedUsers.length === 0 &&
          result.notFoundNames.length === 0 &&
          result.ambiguousNames.length === 0 &&
          result.invalidRows.length === 0
        ) {
          setCsvInviteSummary(null);
          toast.error(t('pages.create.group.csvEmpty'));
          return;
        }

        if (result.matchedUsers.length > 0) {
          setInvitedUserIds(prev => {
            const next = new Set(prev);
            for (const matchedUser of result.matchedUsers) {
              next.add(matchedUser.id);
            }
            return [...next];
          });
        }

        const matchedNames = result.matchedUsers.map(userEntry => userEntry.name);
        setCsvInviteSummary({
          ...result,
          matchedNames,
        });

        if (result.matchedUsers.length > 0) {
          toast.success(
            t('pages.create.group.csvMatchedUsers', { count: result.matchedUsers.length })
          );
        }

        if (
          result.notFoundNames.length > 0 ||
          result.ambiguousNames.length > 0 ||
          result.invalidRows.length > 0
        ) {
          toast.info(t('pages.create.group.csvReviewSummary'));
        }
      };
      reader.readAsText(file);
      // Reset input so same file can be re-uploaded
      e.target.value = '';
    },
    [allUsers, t, user?.id]
  );

  const handleAddLinkedGroup = useCallback(() => {
    if (!linkGroupId || !hasConfiguredConnection) {
      toast.error(
        translateText(
          'generated.inline.0328_bitte_waehle_eine_gruppe_und_konfiguriere_min_ef6be26f'
        )
      );
      return;
    }

    if (activeLinkConflictPreflight.blocking) {
      toast.error(
        activeLinkConflictPreflight.response.summary ?? t('pages.create.group.linkConflictBlocked')
      );
      return;
    }

    if (hasIncompleteLinkMembershipRules) {
      toast.error(
        translateText(
          'generated.inline.0329_bitte_vervollstaendige_alle_konfigurierten_mi_25b126d0'
        )
      );
      return;
    }

    const existing = linkedGroups.find(g => g.groupId === linkGroupId);
    if (existing) {
      toast.info(t('pages.create.group.groupAlreadyLinked'));
      setLinkedGroups(prev =>
        prev.map(g =>
          g.groupId === linkGroupId
            ? toLinkedGroup({
                groupId: g.groupId,
                groupName: g.groupName,
                type: linkType,
                membershipDirection: linkMembershipDirection,
                membershipRule: linkMembershipRule,
                rightDirections: linkRightDirections,
              })
            : g
        )
      );
    } else {
      const group = availableGroups.find(g => g.id === linkGroupId);
      setLinkedGroups(prev => [
        ...prev,
        toLinkedGroup({
          groupId: linkGroupId,
          groupName: group?.name ?? linkGroupId,
          type: linkType,
          membershipDirection: linkMembershipDirection,
          membershipRule: linkMembershipRule,
          rightDirections: linkRightDirections,
        }),
      ]);
    }
    const resetState = buildCreateLinkPresetDefaults();
    setLinkGroupId('');
    setLinkType(resetState.type);
    setLinkRightDirections(resetState.rightDirections);
    setLinkMembershipDirection(resetState.membershipDirection);
    setLinkMembershipRule(resetState.membershipRule);
    setLinkComposerTab('preset');
    setLinkPreset(resetState.preset);
  }, [
    activeLinkConflictPreflight.blocking,
    activeLinkConflictPreflight.response.summary,
    hasConfiguredConnection,
    hasIncompleteLinkMembershipRules,
    linkGroupId,
    linkMembershipDirection,
    linkMembershipRule,
    linkType,
    linkedGroups,
    availableGroups,
    t,
  ]);

  const handleRemoveLinkedGroup = useCallback((gId: string) => {
    setLinkedGroups(prev => prev.filter(g => g.groupId !== gId));
  }, []);

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!name.trim() || !emailIsValid) {
      if (!emailIsValid) {
        toast.error(emailValidationMessage);
      }
      return createBlockedSubmitOutcome();
    }

    setIsSubmitting(true);
    try {
      context?.reportProgress({ key: 'create', status: 'active' });
      const groupSubmitTarget = createRouteSubmitTarget('group', {
        to: '/group/$id',
        params: { id: groupId },
      });
      context?.reportProgress({ key: 'sync', status: 'active' });

      const connectionRequests = linkedGroups.map(link => {
        const payload = buildCanonicalGroupConnection({
          currentGroupId: groupId,
          otherGroupId: link.groupId,
          connectionType: link.type,
          rightDirections: link.rightDirections,
          membershipDirection: link.membershipDirection,
          membershipRule: link.membershipRule,
        });

        return {
          id: crypto.randomUUID(),
          active_connection_id: null,
          proposed_connection_id: payload.id,
          group_a_id: payload.group_a_id,
          group_b_id: payload.group_b_id,
          desired_connection_type: payload.connection_type,
          desired_parent_group_id: payload.parent_group_id,
          desired_child_group_id: payload.child_group_id,
          initiator_group_id: groupId,
          grants: payload.grants.map(right => ({
            id: crypto.randomUUID(),
            existing_grant_id: null,
            operation: 'upsert' as const,
            right_key: right.right_key,
            holder_group_id: right.holder_group_id,
            scope_group_id: right.scope_group_id,
          })),
          membership_rule: payload.membership_rule
            ? {
                ...payload.membership_rule,
                id: crypto.randomUUID(),
                existing_membership_rule_id: null,
                operation: 'upsert' as const,
              }
            : null,
        };
      });

      const startTimestamp = toLocalTimestamp(eventStartDate, eventStartTime);
      const foundingEventTitle = eventName.trim();
      const foundingEvent =
        createConstitutionalEvent && foundingEventTitle && user?.id
          ? {
              id: crypto.randomUUID(),
              title: foundingEventTitle,
              event_type: 'general_assembly',
              group_id: groupId,
              creator_id: user.id,
              visibility,
              location_name: eventLocation || null,
              start_date: startTimestamp,
              invited_user_ids: invitedUserIds,
            }
          : null;

      const locationFields = geoLocationFieldsFromShape(locationShape);
      const createGroupPayload = {
        group: {
          id: groupId,
          name: name.trim(),
          description: description ? toZeroRichTextValue(descriptionContent) : null,
          email: email || null,
          country: country || null,
          region: region || null,
          post_code: post_code || null,
          city: city || null,
          street: street || null,
          house_number: house_number || null,
          latitude,
          longitude,
          location_kind: locationFields.location_kind,
          location_place_id: locationFields.location_place_id,
          location_boundary_source: locationFields.location_boundary_source,
          location_geometry: locationFields.location_geometry,
          location_bounds: locationFields.location_bounds,
          image_url: imageURL || null,
          video_url: videoURL || null,
          x: null,
          youtube: null,
          linkedin: null,
          website: null,
          whatsapp: null,
          instagram: null,
          twitter: null,
          facebook: null,
          snapchat: null,
          tiktok: null,
          visibility,
          group_type: groupType,
          owner_id: null,
        },
        hashtags,
        official_invite_user_ids: allowOfficialMemberInvites ? invitedUserIds : [],
        guest_invite_user_ids: allowGuestInvites ? invitedUserIds : [],
        connection_requests: connectionRequests,
        founding_event: foundingEvent,
      };
      const createGroupResult = createFullGroup(createGroupPayload, {
        notificationMode: 'silent',
      });

      await waitForOptimisticCreate(createGroupResult);

      context?.setRecoveryTarget(groupSubmitTarget);
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });
      trackCreateFinalization({
        result: createGroupResult,
        draft: {
          id: `group:${groupId}`,
          entityType: 'group',
          entityId: groupId,
          createPath: '/create/group',
          formState: {
            groupType,
            name,
            description,
            descriptionContent,
            email,
            country,
            region,
            post_code,
            city,
            street,
            house_number,
            latitude,
            longitude,
            locationShape,
            imageURL,
            videoURL,
            hashtags,
            visibility,
            invitedUserIds,
            linkedGroups,
            createConstitutionalEvent,
            eventName,
            eventLocation,
            eventStartDate,
            eventStartTime,
          },
          mutationPayload: createGroupPayload,
          target: groupSubmitTarget,
        },
        retry: () => {
          const retryResult = createFullGroup(createGroupPayload, {
            notificationMode: 'silent',
          });
          trackCreateFinalization({
            result: retryResult,
            draft: {
              id: `group:${groupId}`,
              entityType: 'group',
              entityId: groupId,
              createPath: '/create/group',
              formState: {
                groupType,
                name,
                description,
                descriptionContent,
                email,
                country,
                region,
                post_code,
                city,
                street,
                house_number,
                latitude,
                longitude,
                locationShape,
                imageURL,
                videoURL,
                hashtags,
                visibility,
                invitedUserIds,
                linkedGroups,
                createConstitutionalEvent,
                eventName,
                eventLocation,
                eventStartDate,
                eventStartTime,
              },
              mutationPayload: createGroupPayload,
              target: groupSubmitTarget,
            },
          });
        },
      });
      setIsSubmitting(false);
      return createSuccessSubmitOutcome(groupSubmitTarget);
    } catch (error) {
      setIsSubmitting(false);
      throw error;
    }
  };

  const locationSummary = formatLocation({
    country,
    region,
    post_code,
    city,
    street,
    house_number,
  });

  const groupTypeLabel =
    groupType === 'base'
      ? t('pages.create.group.groupTypes.base')
      : groupType === 'hierarchical'
        ? t('pages.create.group.groupTypes.hierarchical')
        : t('common.network.sibling');
  const visibilityLabel =
    visibility === translateText('generated.inline.0030_public_61c9b2b1')
      ? t('pages.create.common.public')
      : visibility === translateText('generated.inline.0031_authenticated_8fda38ce')
        ? t('pages.create.common.authenticated')
        : t('pages.create.common.private');
  const invitedUserNames = invitedUserIds
    .map(invitedUserId => {
      const matchedUser = allUsers.find(currentUser => currentUser.id === invitedUserId);
      if (!matchedUser) {
        return invitedUserId;
      }

      return (
        [matchedUser.first_name, matchedUser.last_name].filter(Boolean).join(' ').trim() ||
        matchedUser.handle ||
        matchedUser.email ||
        matchedUser.id
      );
    })
    .filter(Boolean);
  const linkedGroupReviewData = linkedGroups.map(linkedGroup => ({
    id: linkedGroup.groupId,
    groupName: linkedGroup.groupName,
    type: linkedGroup.type,
    membershipMode: linkedGroup.membershipMode,
    relationshipLabel: getCurrentGroupRelationshipLabel({
      relationshipType: linkedGroup.type,
      currentGroupName: name,
      selectedGroupName: linkedGroup.groupName,
      siblingMembershipMode:
        linkedGroup.type === 'sibling'
          ? (getSiblingMembershipKind(linkedGroup.membershipMode) ?? undefined)
          : undefined,
      t,
    }),
    rights: getSelectedRights(linkedGroup.rightDirections),
    rightDirections: linkedGroup.rightDirections,
  }));
  const constitutionalEventStart =
    eventStartDate || eventStartTime
      ? `${eventStartDate || ''}${eventStartTime ? ` ${eventStartTime}` : ''}`.trim()
      : '';
  const selectableLinkGroups = useMemo(
    () => availableGroups.filter(group => group.id !== groupId),
    [availableGroups, groupId]
  );
  const selectableRolesByDirection = useMemo(
    () => ({
      partner_members_to_current: (selectedGroupRoles ?? []).filter(
        role => role.scope === 'group' && role.assignee_kind !== 'guest'
      ),
      current_members_to_partner: (currentGroupRoles ?? []).filter(
        role => role.scope === 'group' && role.assignee_kind !== 'guest'
      ),
    }),
    [currentGroupRoles, selectedGroupRoles]
  );
  const existingRightStatuses = useMemo(() => {
    if (!linkGroupId) {
      return undefined;
    }

    const statuses = new Map<string, 'accepted' | 'incoming' | 'outgoing'>();
    const pendingLink = linkedGroups.find(group => group.groupId === linkGroupId);
    getSelectedRights(
      pendingLink?.rightDirections ?? createInitialRelationshipDirections()
    ).forEach(right => {
      statuses.set(right, 'outgoing');
    });

    return statuses.size > 0 ? statuses : undefined;
  }, [linkGroupId, linkedGroups]);
  const csvGuideRows = useMemo(
    () => [
      {
        firstName: translateText('generated.inline.0333_ada_5c3cb098'),
        lastName: translateText('generated.inline.0334_lovelace_57bd0d90'),
      },
      {
        firstName: translateText('generated.inline.0335_grace_01c95267'),
        lastName: translateText('generated.inline.0336_hopper_1eb8e6de'),
      },
    ],
    []
  );
  const csvGuideColumns = useMemo<ColumnDef<(typeof csvGuideRows)[number]>[]>(
    () => [
      {
        accessorKey: 'firstName',
        header: t('pages.create.group.csvColumnFirstName'),
      },
      {
        accessorKey: 'lastName',
        header: t('pages.create.group.csvColumnLastName'),
      },
    ],
    [t]
  );
  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'group',
      title: 'pages.create.group.title',
      isSubmitting,
      onSubmit: handleSubmit,
      submissionSteps: [
        { key: 'create', label: t('pages.create.progress.submission.steps.group.create') },
        { key: 'sync', label: t('pages.create.progress.submission.steps.group.sync') },
        { key: 'ready', label: t('pages.create.progress.submission.steps.group.ready') },
      ],
      steps: [
        {
          label: t('pages.create.group.basicInfo'),
          isValid: () => !!name.trim() && emailIsValid,
          getInvalidReason: () => basicInfoInvalidReason,
          fields: [
            {
              key: 'name',
              kind: 'text',
              label: t('pages.create.group.nameLabel'),
              required: true,
              hint: t('pages.create.group.tips.name'),
              value: name,
              onValueChange: setName,
              placeholder: t('pages.create.group.namePlaceholder'),
            },
            {
              key: 'description',
              kind: 'customComponent',
              component: CreateRichTextField,
              props: {
                label: t('pages.create.group.descriptionLabel'),
                description: t('pages.create.group.tips.description'),
                value: descriptionContent,
                onChange: handleDescriptionContentChange,
                placeholder: t('pages.create.group.descriptionPlaceholder'),
              },
            },
            {
              key: 'email',
              kind: 'text',
              label: t('pages.create.group.emailLabel'),
              type: 'email',
              validator: value =>
                isValidOptionalEmailAddress(value) ? null : emailValidationMessage,
              value: email,
              onValueChange: setEmail,
              placeholder: t('pages.create.group.emailPlaceholder'),
            },
            {
              key: 'group-type',
              kind: 'customComponent',
              component: GroupTypeInput,
              props: {
                value: radioGroupType,
                label: t('pages.create.group.groupType'),
                options: {
                  base: {
                    label: t('pages.create.group.groupTypes.base'),
                    description: t('pages.create.group.groupTypes.baseDesc'),
                  },
                  hierarchical: {
                    label: t('pages.create.group.groupTypes.hierarchical'),
                    description: t('pages.create.group.groupTypes.hierarchicalDesc'),
                  },
                },
                onChange: setGroupType,
              },
            },
          ],
        },
        {
          label: t('pages.create.group.linkGroups'),
          isValid: () => true,
          fields: [
            {
              key: 'link-groups',
              kind: 'customComponent',
              component: GroupConnectionsInput,
              props: {
                label: translateText(
                  'generated.inline.0330_verbindungen_zu_anderen_gruppen_99ad40c5'
                ),
                hint:
                  groupType === 'base'
                    ? t('pages.create.group.tips.linkGroups')
                    : translateText(
                        'generated.inline.0049_waehle_zuerst_eine_gruppe_im_beziehungstyp_en_e6ccef15'
                      ),
                linkedGroupsLabel: t('pages.create.group.linkedGroups'),
                addLabel: t('pages.create.group.addGroupLink'),
                cancelLabel: translateText('generated.inline.0331_abbrechen_07af7cb3'),
                checkingLabel: translateText('generated.inline.0332_pruefe_konflikte_33f6ced2'),
                currentGroupId: groupId,
                currentGroupName: name,
                activeTab: linkComposerTab,
                value: linkComposerValue,
                availableGroups: selectableLinkGroups,
                selectableRolesByDirection,
                existingRightStatuses,
                preflight: activeLinkConflictPreflight,
                disabledPresets: {
                  role_members_to_partner: CREATE_GROUP_CURRENT_ROLE_MEMBERSHIP_DISABLED_REASON,
                },
                disabledPresetFallback: CREATE_LINK_DEFAULT_PRESET,
                groupSelectorLabel: t('pages.create.group.selectGroup'),
                linkedGroups,
                addDisabled:
                  !linkGroupId ||
                  !hasConfiguredConnection ||
                  activeLinkConflictPreflight.isLoading ||
                  activeLinkConflictPreflight.blocking ||
                  hasIncompleteLinkMembershipRules,
                onActiveTabChange: setLinkComposerTab,
                onValueChange: (nextValue: any) => {
                  setLinkGroupId(nextValue.selectedGroupId);
                  setLinkType(nextValue.relationshipType);
                  setLinkMembershipDirection(nextValue.membershipDirection);
                  setLinkMembershipRule(nextValue.membershipRule);
                  setLinkRightDirections(nextValue.rightDirections);
                  setLinkPreset(nextValue.preset);
                },
                onAdd: handleAddLinkedGroup,
                onCancel: () => {
                  const resetState = buildCreateLinkPresetDefaults();
                  setLinkGroupId('');
                  setLinkType(resetState.type);
                  setLinkRightDirections(resetState.rightDirections);
                  setLinkMembershipDirection(resetState.membershipDirection);
                  setLinkMembershipRule(resetState.membershipRule);
                  setLinkComposerTab('preset');
                  setLinkPreset(resetState.preset);
                },
                onRemove: handleRemoveLinkedGroup,
                getSelectedRights,
                t,
              },
            },
          ],
        },
        {
          label: t('pages.create.group.locationLabel'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'location',
              kind: 'customComponent',
              component: GroupLocationInput,
              props: {
                hint: t('pages.create.group.tips.location'),
                values: {
                  country,
                  region,
                  city,
                  post_code,
                  street,
                  house_number,
                  latitude,
                  longitude,
                },
                shape: locationShape,
                onShapeChange: setLocationShape,
                labels: {
                  country: t('pages.create.group.countryLabel'),
                  region: t('pages.create.group.regionLabel'),
                  city: t('pages.create.event.city'),
                  post_code: t('pages.create.event.postalCode'),
                  street: t('pages.create.event.street'),
                  house_number: t('pages.create.event.houseNumber'),
                },
                placeholders: {
                  country: t('pages.create.group.countryPlaceholder'),
                  region: t('pages.create.group.regionPlaceholder'),
                  city: t('pages.create.event.city'),
                  post_code: t('pages.create.event.postalCode'),
                  street: t('pages.create.event.street'),
                  house_number: t('pages.create.event.houseNumber'),
                },
                onCoordinatesChange: (
                  coordinates: { latitude: number; longitude: number } | null
                ) => {
                  setLatitude(coordinates?.latitude ?? null);
                  setLongitude(coordinates?.longitude ?? null);
                },
                onFieldChange: (field: string, value: string) => {
                  switch (field) {
                    case 'country':
                      setCountry(value);
                      break;
                    case 'region':
                      setRegion(value);
                      break;
                    case 'city':
                      setCity(value);
                      break;
                    case 'post_code':
                      setPostCode(value);
                      break;
                    case 'street':
                      setStreet(value);
                      break;
                    case 'house_number':
                      setHouseNumber(value);
                      break;
                  }
                },
              },
            },
          ],
        },
        {
          label: t('pages.create.group.imageAndTags'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'image-tags',
              kind: 'customComponent',
              component: GroupMediaSettingsInput,
              props: {
                imageURL,
                videoURL,
                onImageChange: setImageURL,
                onVideoChange: setVideoURL,
                groupId,
                imageLabel: t('pages.create.group.imageLabel'),
                imageDescription: t('pages.create.group.imageDescription'),
                visibility,
                hashtags,
                hashtagPlaceholder: t('pages.create.group.hashtagPlaceholder'),
                preferredHashtagSuggestions,
                onVisibilityChange: setVisibility,
                onHashtagsChange: setHashtags,
              },
            },
          ],
        },
        // Step 4: Invite People
        {
          label: allowGuestInvites
            ? t('pages.create.group.guestInvite')
            : t('pages.create.group.inviteMembers'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'invite-people',
              kind: 'customComponent',
              component: GroupInvitePeopleInput,
              props: {
                hint: allowGuestInvites
                  ? translateText(
                      'generated.inline.0050_diese_gruppe_vergibt_mitgliedschaft_automatis_1a57fa5b'
                    )
                  : t('pages.create.group.tips.inviteMembers'),
                searchLabel: allowGuestInvites
                  ? t('pages.create.group.searchGuests')
                  : t('pages.create.group.searchUsers'),
                searchPlaceholder: allowGuestInvites
                  ? t('pages.create.group.searchGuestsPlaceholder')
                  : t('pages.create.group.searchUsers'),
                excludeUserId: user?.id,
                invitedUserIds,
                onInvitedUserIdsChange: setInvitedUserIds,
                csvGuideTitle: allowGuestInvites
                  ? translateText('generated.inline.0051_gaeste_per_csv_vorbereiten_7af02b36')
                  : t('pages.create.group.csvGuideTitle'),
                csvGuideDescription: allowGuestInvites
                  ? translateText(
                      'generated.inline.0052_importiere_gaeste_aus_einer_csv_mit_vor_und_n_4c551db1'
                    )
                  : t('pages.create.group.csvGuideDescription'),
                csvGuideTrigger: t('pages.create.group.csvGuideTrigger'),
                csvGuideFootnote: t('pages.create.group.csvGuideFootnote'),
                csvGuideColumns,
                csvGuideRows,
                csvUploadLabel: allowGuestInvites
                  ? translateText('generated.inline.0053_gaeste_importieren_b28ba907')
                  : t('pages.create.group.inviteMembersOptional'),
                csvLabel: translateText('generated.inline.0337_csv_bba7e432'),
                onCsvUpload: handleCsvUpload,
                csvInviteSummary: csvInviteSummary
                  ? {
                      ...csvInviteSummary,
                      ambiguousNames: csvInviteSummary.ambiguousNames.map(entry => ({
                        ...entry,
                        candidatesLabel: t('pages.create.group.csvAmbiguousCandidates', {
                          candidates: entry.candidates.map(candidate => candidate.name).join(', '),
                        }),
                      })),
                    }
                  : null,
                csvLabels: {
                  summaryTitle: t('pages.create.group.csvSummaryTitle'),
                  summaryDescription: t('pages.create.group.csvSummaryDescription'),
                  foundCount: t('pages.create.group.csvFoundCount', {
                    count: csvInviteSummary?.matchedNames.length ?? 0,
                  }),
                  notFoundCount: t('pages.create.group.csvNotFoundCount', {
                    count: csvInviteSummary?.notFoundNames.length ?? 0,
                  }),
                  ambiguousCount: t('pages.create.group.csvAmbiguousCount', {
                    count: csvInviteSummary?.ambiguousNames.length ?? 0,
                  }),
                  foundNames: t('pages.create.group.csvFoundNames'),
                  notFoundNames: t('pages.create.group.csvNotFoundNames'),
                  ambiguousNames: t('pages.create.group.csvAmbiguousNames'),
                  invalidRows: t('pages.create.group.csvInvalidRows'),
                },
                invitedCountLabel: allowGuestInvites
                  ? translateText('generated.inline.0054_gaeste_vorgemerkt_9ea73a37')
                  : t('pages.create.group.invited'),
              },
            },
          ],
        },
        // Step 6: Constitutional Event
        {
          label: t('pages.create.group.createConstitutionalEvent'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'constitutional-toggle',
              kind: 'customComponent',
              component: ConstitutionalEventToggleInput,
              props: {
                hint: t('pages.create.group.tips.constitutionalEvent'),
                checked: createConstitutionalEvent,
                onCheckedChange: handleConstitutionalEventToggle,
                label: t('pages.create.group.optionalGeneralAssembly'),
                description: t('pages.create.group.eventTypeDescription'),
              },
            },
            ...(createConstitutionalEvent
              ? [
                  {
                    key: 'event-name',
                    kind: 'text' as const,
                    label: t('pages.create.group.eventName'),
                    value: eventName,
                    onValueChange: setEventName,
                    placeholder: t('pages.create.group.eventNamePlaceholder'),
                  },
                  {
                    key: 'event-location',
                    kind: 'text' as const,
                    label: t('pages.create.group.eventLocation'),
                    value: eventLocation,
                    onValueChange: setEventLocation,
                    placeholder: t('pages.create.group.eventLocationPlaceholder'),
                  },
                  {
                    key: 'event-time',
                    kind: 'customComponent' as const,
                    component: DateTimeRangeInput,
                    props: {
                      startDate: eventStartDate,
                      startTime: eventStartTime,
                      showEnd: false,
                      onChange: (field: string, value: string) => {
                        if (field === 'startDate') setEventStartDate(value);
                        else if (field === 'startTime') setEventStartTime(value);
                      },
                    },
                  },
                ]
              : []),
          ],
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!name.trim() && emailIsValid,
          getInvalidReason: () => basicInfoInvalidReason,
          fields: [
            {
              key: 'review',
              kind: 'customComponent',
              component: CreateGroupSummaryStep,
              props: {
                badge: t('pages.create.group.reviewBadge'),
                secondaryBadge: groupTypeLabel,
                title: name || t('pages.create.group.namePlaceholder'),
                subtitle: description || undefined,
                media: {
                  imageUrl: imageURL || undefined,
                  imageAlt: name || t('pages.create.group.imageAlt'),
                  videoUrl: videoURL || undefined,
                },
                hashtags: hashtags.length > 0 ? hashtags : undefined,
                groupLinksTitle: t('pages.create.group.groupLinksLabel'),
                linkedGroupReviewData,
                currentGroupName: name,
                currentGroupId: groupId,
                sections: [
                  {
                    title: t('pages.create.group.basicInfo'),
                    fields: [
                      ...(email
                        ? [{ label: t('pages.create.group.emailLabel'), value: email }]
                        : []),
                      {
                        label: t('pages.create.group.groupType'),
                        value: groupTypeLabel,
                      },
                      {
                        label: t('pages.create.common.visibility'),
                        value: visibilityLabel,
                      },
                    ],
                  },
                  {
                    title: t('pages.create.group.locationLabel'),
                    fields: [
                      ...(locationSummary
                        ? [
                            {
                              label: t('pages.create.group.locationLabel'),
                              value: locationSummary,
                            },
                          ]
                        : []),
                      ...(imageURL
                        ? [
                            {
                              label: t('pages.create.group.imageLabel'),
                              value: t('common.attached'),
                            },
                          ]
                        : []),
                      ...(videoURL
                        ? [
                            {
                              label: t('common.actions.uploadVideo'),
                              value: t('common.attached'),
                            },
                          ]
                        : []),
                    ],
                  },
                  {
                    title: allowGuestInvites
                      ? t('pages.create.group.guestInvite')
                      : t('pages.create.group.inviteMembers'),
                    fields: [
                      ...(invitedUserNames.length > 0
                        ? [
                            {
                              label: allowGuestInvites
                                ? t('pages.create.group.invitedGuests')
                                : t('pages.create.group.invitedMembersLabel'),
                              value: invitedUserNames.join(', '),
                            },
                          ]
                        : []),
                    ],
                  },
                  ...(createConstitutionalEvent && eventName
                    ? [
                        {
                          title: t('pages.create.group.createConstitutionalEvent'),
                          fields: [
                            {
                              label: t('pages.create.group.constitutionalEventLabel'),
                              value: eventName,
                            },
                            ...(eventLocation
                              ? [
                                  {
                                    label: t('pages.create.group.eventLocation'),
                                    value: eventLocation,
                                  },
                                ]
                              : []),
                            ...(constitutionalEventStart
                              ? [
                                  {
                                    label: t('pages.create.event.startDate'),
                                    value: constitutionalEventStart,
                                  },
                                ]
                              : []),
                          ],
                        },
                      ]
                    : []),
                ],
              },
            },
          ],
        },
      ],
    }),
    [
      name,
      description,
      descriptionContent,
      email,
      country,
      region,
      post_code,
      city,
      street,
      house_number,
      latitude,
      longitude,
      locationShape,
      locationSummary,
      imageURL,
      videoURL,
      hashtags,
      preferredHashtagSuggestions,
      visibility,
      visibilityLabel,
      groupType,
      groupTypeLabel,
      siblingMembershipMode,
      connectedRoleId,
      isSubmitting,
      groupId,
      t,
      invitedUserIds,
      invitedUserNames,
      linkedGroups,
      linkedGroupReviewData,
      linkGroupId,
      linkType,
      linkRightDirections,
      linkComposerTab,
      linkPreset,
      csvGuideColumns,
      csvGuideRows,
      allowGuestInvites,
      allowOfficialMemberInvites,
      selectableRolesByDirection,
      selectableLinkGroups,
      allGroups,
      createConstitutionalEvent,
      eventName,
      eventLocation,
      eventStartDate,
      eventStartTime,
      constitutionalEventStart,
      handleDescriptionContentChange,
      handleAddLinkedGroup,
      handleRemoveLinkedGroup,
      handleConstitutionalEventToggle,
      createFullGroup,
      emailIsValid,
      emailValidationMessage,
      basicInfoInvalidReason,
      user,
    ]
  );

  return config;
}
