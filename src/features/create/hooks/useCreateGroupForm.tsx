import { BadgeControl } from '@/features/shared/ui/status';
import {
  FileUploadTrigger,
  FormControlLabel,
  FormControlRadioGroup,
  FormControlSwitch,
  FormControlRadioGroupItem,
} from '@/features/shared/ui/form';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Value } from 'platejs';
import { useNavigate } from '@tanstack/react-router';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { DateTimeRangeInput } from '../ui/inputs/DateTimeRangeInput';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { UserSearchInput } from '../ui/inputs/UserSearchInput';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useEventActions } from '@/zero/events/useEventActions';
import { useCommonState, useCommonActions } from '@/zero/common';
import { useAllGroups, useGroupRoles } from '@/zero/groups/useGroupState';
import { useUserState } from '@/zero/users/useUserState';
import { useAuth } from '@/providers/auth-provider';
import {
  getCurrentGroupRelationshipLabel,
  GroupRelationshipRightSentenceList,
  type GroupRelationshipRight,
} from '@/features/network/ui/GroupRelationshipFields';
import { useGroupConnectionActions } from '@/zero/network';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/shared/ui/ui/accordion';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { MiniPlateEditor } from '@/features/shared/ui/form/MiniPlateEditor';
import { GeoAddressPicker } from '@/features/shared/ui/form/GeoAddressPicker';
import { isValidOptionalEmailAddress } from '@/features/shared/logic/inputValidation';
import { cn } from '@/features/shared/utils/utils.ts';
import { matchInviteCsvUsers, type InviteCsvMatchResult } from '../logic/groupInviteCsv';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import {
  EMPTY_RICH_TEXT_VALUE,
  richTextToPlainText,
  toZeroRichTextValue,
} from '@/features/shared/logic/richText';
import { X, Upload, Link2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import type { CreateFormConfig } from '../types/create-form.types';
import type {
  CanonicalMembershipMode,
  GroupRelationshipDirection,
  GroupRelationshipType,
  GroupConnectionComposerMembershipRuleValue,
  GroupConnectionComposerTab,
  GroupConnectionPreset,
  RelativeMembershipDirection,
} from '@/features/network/types/network.types';
import {
  getCanonicalMembershipModeLabel,
  getSiblingMembershipKind,
} from '@/features/network/logic/groupConnectionDerived';
import { GroupConnectionComposer } from '@/features/network/ui/GroupConnectionComposer';
import { useGroupConnectionComposerPreflight } from '@/features/network/hooks/useGroupConnectionComposerPreflight';
import {
  applyGroupConnectionPreset,
  buildCanonicalGroupConnectionPayload,
  buildGroupConnectionComposerDefaults,
  createEmptyMembershipRule,
  hasConfiguredGroupConnection,
  hasConfiguredMembership,
} from '@/features/network/logic/groupConnectionComposer';

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

function hasIncompleteMembershipRule(args: {
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: GroupConnectionComposerMembershipRuleValue;
}) {
  if (
    !hasConfiguredMembership({
      membershipDirection: args.membershipDirection,
      membershipRule: args.membershipRule,
    })
  ) {
    return false;
  }

  if (args.membershipRule.membershipMode === 'role_members') {
    return !args.membershipRule.roleId;
  }

  if (args.membershipRule.membershipMode === 'selected_source_groups') {
    return args.membershipRule.sourceGroupIds.length === 0;
  }

  return false;
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

function getRelationshipBadgeClasses(type: LinkedGroup['type']) {
  if (type === 'sibling') {
    return 'border-violet-300 bg-violet-50 text-violet-800';
  }

  return type === 'parent'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
    : 'border-sky-300 bg-sky-50 text-sky-800';
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createGroup, createRole, inviteGuest, inviteMember } = useGroupActions();
  const { createEvent } = useEventActions();
  const commonActions = useCommonActions();
  const { proposeGroupConnectionChange } = useGroupConnectionActions();
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
  const [imageURL, setImageURL] = useState('');
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

  const { allHashtags } = useCommonState({ loadAllHashtags: true });
  const emailValidationMessage = t('common.validation.emailHint');
  const emailIsValid = isValidOptionalEmailAddress(email);
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
  const resolvedGroupType: GroupType = siblingLinks.length > 0 ? 'sibling' : groupType;
  const allowOfficialMemberInvites =
    resolvedGroupType === 'base' ||
    (resolvedGroupType === 'sibling' &&
      siblingMembershipModes.every(mode => mode === 'none' || mode === 'all_members'));
  const allowGuestInvites =
    resolvedGroupType === 'hierarchical' ||
    siblingMembershipModes.some(
      mode => mode === 'role_members' || mode === 'selected_source_groups'
    );
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
        activeLinkConflictPreflight.response.summary ??
          'Diese Verknuepfung ist aktuell durch Konflikte blockiert.'
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

  const handleSubmit = async () => {
    if (!name.trim() || !emailIsValid) {
      if (!emailIsValid) {
        toast.error(emailValidationMessage);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const createGroupResult = createGroup({
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
        image_url: imageURL || null,
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
        owner_id: null,
      });
      await serverConfirmed(createGroupResult);
      if (hashtags.length > 0) {
        await commonActions.syncEntityHashtags('group', groupId, hashtags, [], allHashtags ?? []);
      }

      if (allowOfficialMemberInvites) {
        for (const userId of invitedUserIds) {
          await inviteMember({
            id: crypto.randomUUID(),
            user_id: userId,
            group_id: groupId,
            visibility: '',
            status: 'invited',
          });
        }
      } else if (allowGuestInvites) {
        const guestRoleId = crypto.randomUUID();
        const guestRoleResult = createRole({
          id: guestRoleId,
          name: 'Guest',
          description: translateText(
            'generated.inline.0058_initial_guest_access_created_during_group_set_254a0aed'
          ),
          scope: 'group',
          group_id: groupId,
          event_id: null,
          amendment_id: null,
          blog_id: null,
          visibility: 'private',
          assignee_kind: 'guest',
          assignment_mode: 'assigned',
          default_request_role: false,
          default_invite_role: false,
          is_recurring: false,
          sort_order: -1,
        });
        await serverConfirmed(guestRoleResult);

        for (const userId of invitedUserIds) {
          await inviteGuest({
            id: crypto.randomUUID(),
            group_id: groupId,
            user_id: userId,
            status: 'invited',
            role_ids: [guestRoleId],
            invited_by_id: user?.id ?? null,
          });
        }
      }

      // Create group relationships
      for (const link of linkedGroups) {
        await serverConfirmed(
          proposeGroupConnectionChange({
            id: crypto.randomUUID(),
            active_connection_id: null,
            ...(() => {
              const payload = buildCanonicalGroupConnection({
                currentGroupId: groupId,
                otherGroupId: link.groupId,
                connectionType: link.type,
                rightDirections: link.rightDirections,
                membershipDirection: link.membershipDirection,
                membershipRule: link.membershipRule,
              });
              return {
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
            })(),
          })
        );
      }

      // Create constitutional event
      if (createConstitutionalEvent && eventName.trim() && user?.id) {
        const startTimestamp = eventStartDate
          ? new Date(`${eventStartDate}T${eventStartTime || '00:00'}`).getTime()
          : null;
        await createEvent({
          id: crypto.randomUUID(),
          title: eventName.trim(),
          event_type: 'general_assembly',
          group_id: groupId,
          creator_id: user.id,
          visibility,
          location_name: eventLocation || null,
          start_date: startTimestamp,
          invited_user_ids: invitedUserIds,
        });
      }

      navigate({ to: `/group/${groupId}` });
    } catch {
      setIsSubmitting(false);
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
    resolvedGroupType === translateText('generated.inline.0037_base_1405df66')
      ? t('pages.create.group.groupTypes.base')
      : resolvedGroupType === translateText('generated.inline.0038_hierarchical_9876c412')
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
      if (!statuses.has(right)) {
        statuses.set(right, 'outgoing');
      }
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
      steps: [
        {
          label: t('pages.create.group.basicInfo'),
          isValid: () => !!name.trim() && emailIsValid,
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
              kind: 'custom',
              node: (
                <div className="space-y-2">
                  <FormControlLabel>{t('pages.create.group.descriptionLabel')}</FormControlLabel>
                  <p className="text-muted-foreground text-xs">
                    {t('pages.create.group.tips.description')}
                  </p>
                  <MiniPlateEditor
                    value={descriptionContent}
                    onChange={handleDescriptionContentChange}
                    placeholder={t('pages.create.group.descriptionPlaceholder')}
                  />
                </div>
              ),
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
              kind: 'custom',
              node: (
                <div className="space-y-2">
                  <FormControlLabel>{t('pages.create.group.groupType')}</FormControlLabel>
                  <FormControlRadioGroup
                    value={radioGroupType}
                    onValueChange={value => setGroupType(value as GroupType)}
                  >
                    <div className="space-y-2">
                      <FormControlLabel
                        htmlFor="group-type-base"
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                          radioGroupType === 'base'
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <FormControlRadioGroupItem
                          value="base"
                          id="group-type-base"
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-medium">
                            {t('pages.create.group.groupTypes.base')}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {t('pages.create.group.groupTypes.baseDesc')}
                          </div>
                        </div>
                      </FormControlLabel>
                      <FormControlLabel
                        htmlFor="group-type-hierarchical"
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                          radioGroupType === 'hierarchical'
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <FormControlRadioGroupItem
                          value="hierarchical"
                          id="group-type-hierarchical"
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-medium">
                            {t('pages.create.group.groupTypes.hierarchical')}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {t('pages.create.group.groupTypes.hierarchicalDesc')}
                          </div>
                        </div>
                      </FormControlLabel>
                    </div>
                  </FormControlRadioGroup>
                </div>
              ),
            },
          ],
        },
        {
          label: t('pages.create.group.linkGroups'),
          isValid: () => true,
          fields: [
            {
              key: 'link-groups',
              kind: 'custom',
              node: (
                <div className="space-y-6">
                  <div className="space-y-4 rounded-lg border p-4">
                    <div className="space-y-1">
                      <FormControlLabel>
                        {translateText(
                          'generated.inline.0330_verbindungen_zu_anderen_gruppen_99ad40c5'
                        )}
                      </FormControlLabel>
                      <p className="text-muted-foreground text-xs">
                        {groupType === 'base'
                          ? t('pages.create.group.tips.linkGroups')
                          : translateText(
                              'generated.inline.0049_waehle_zuerst_eine_gruppe_im_beziehungstyp_en_e6ccef15'
                            )}
                      </p>
                    </div>

                    <GroupConnectionComposer
                      activeTab={linkComposerTab}
                      onActiveTabChange={setLinkComposerTab}
                      value={linkComposerValue}
                      onValueChange={nextValue => {
                        setLinkGroupId(nextValue.selectedGroupId);
                        setLinkType(nextValue.relationshipType);
                        setLinkMembershipDirection(nextValue.membershipDirection);
                        setLinkMembershipRule(nextValue.membershipRule);
                        setLinkRightDirections(nextValue.rightDirections);
                        setLinkPreset(nextValue.preset);
                      }}
                      currentGroupId={groupId}
                      currentGroupName={name}
                      availableGroups={selectableLinkGroups}
                      selectableRolesByDirection={selectableRolesByDirection}
                      existingRightStatuses={existingRightStatuses}
                      preflight={activeLinkConflictPreflight}
                      groupSelectorLabel={t('pages.create.group.selectGroup')}
                    />

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddLinkedGroup}
                        disabled={
                          !linkGroupId ||
                          !hasConfiguredConnection ||
                          activeLinkConflictPreflight.isLoading ||
                          activeLinkConflictPreflight.blocking ||
                          hasIncompleteLinkMembershipRules
                        }
                      >
                        <Link2 className="mr-1 h-4 w-4" />
                        {t('pages.create.group.addGroupLink')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const resetState = buildCreateLinkPresetDefaults();
                          setLinkGroupId('');
                          setLinkType(resetState.type);
                          setLinkRightDirections(resetState.rightDirections);
                          setLinkMembershipDirection(resetState.membershipDirection);
                          setLinkMembershipRule(resetState.membershipRule);
                          setLinkComposerTab('preset');
                          setLinkPreset(resetState.preset);
                        }}
                      >
                        {translateText('generated.inline.0331_abbrechen_07af7cb3')}
                      </Button>
                    </div>
                    {activeLinkConflictPreflight.isLoading ? (
                      <div className="text-muted-foreground text-sm">
                        {translateText('generated.inline.0332_pruefe_konflikte_33f6ced2')}
                      </div>
                    ) : null}
                  </div>

                  {linkedGroups.length > 0 ? (
                    <div className="space-y-2">
                      <FormControlLabel className="text-muted-foreground text-xs">
                        {t('pages.create.group.linkedGroups')}
                      </FormControlLabel>
                      {linkedGroups.map(linkedGroup => (
                        <div
                          key={`${linkedGroup.type}-${linkedGroup.groupId}`}
                          className="flex items-start gap-3 rounded-md border p-3"
                        >
                          <BadgeControl
                            className={cn(
                              'border text-xs hover:opacity-100',
                              getRelationshipBadgeClasses(linkedGroup.type)
                            )}
                          >
                            {linkedGroup.type === 'parent'
                              ? t('pages.create.group.parent')
                              : linkedGroup.type === 'child'
                                ? t('pages.create.group.child')
                                : t('common.network.sibling')}
                          </BadgeControl>
                          <BadgeControl className="border-muted bg-muted/50 text-foreground text-xs hover:opacity-100">
                            {getCanonicalMembershipModeLabel(linkedGroup.membershipMode)}
                          </BadgeControl>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="space-y-1">
                              <span className="block text-sm font-medium">
                                {linkedGroup.groupName}
                              </span>
                              <p className="text-muted-foreground text-xs">
                                {getCurrentGroupRelationshipLabel({
                                  relationshipType: linkedGroup.type,
                                  currentGroupName: name,
                                  selectedGroupName: linkedGroup.groupName,
                                  siblingMembershipMode:
                                    linkedGroup.type === 'sibling'
                                      ? (getSiblingMembershipKind(linkedGroup.membershipMode) ??
                                        undefined)
                                      : undefined,
                                  t,
                                })}
                              </p>
                            </div>
                            <GroupRelationshipRightSentenceList
                              rights={getSelectedRights(linkedGroup.rightDirections)}
                              rightDirections={linkedGroup.rightDirections}
                              currentGroupName={name}
                              selectedGroupName={linkedGroup.groupName}
                              currentGroupId={groupId}
                              selectedGroupId={linkedGroup.groupId}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleRemoveLinkedGroup(linkedGroup.groupId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ),
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
              kind: 'custom',
              node: (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-xs">
                    {t('pages.create.group.tips.location')}
                  </p>
                  <GeoAddressPicker
                    idPrefix="create-group-location"
                    values={{
                      country,
                      region,
                      city,
                      post_code,
                      street,
                      house_number,
                    }}
                    coordinates={
                      latitude !== null && longitude !== null ? { latitude, longitude } : null
                    }
                    onCoordinatesChange={coordinates => {
                      setLatitude(coordinates?.latitude ?? null);
                      setLongitude(coordinates?.longitude ?? null);
                    }}
                    onFieldChange={(field, value) => {
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
                    }}
                    labels={{
                      country: t('pages.create.group.countryLabel'),
                      region: t('pages.create.group.regionLabel'),
                      city: t('pages.create.event.city'),
                      post_code: t('pages.create.event.postalCode'),
                      street: t('pages.create.event.street'),
                      house_number: t('pages.create.event.houseNumber'),
                    }}
                    placeholders={{
                      country: t('pages.create.group.countryPlaceholder'),
                      region: t('pages.create.group.regionPlaceholder'),
                      city: t('pages.create.event.city'),
                      post_code: t('pages.create.event.postalCode'),
                      street: t('pages.create.event.street'),
                      house_number: t('pages.create.event.houseNumber'),
                    }}
                  />
                </div>
              ),
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
              kind: 'custom',
              node: (
                <div className="space-y-4">
                  <ImageUpload
                    currentImage={imageURL}
                    onImageChange={(url: string) => setImageURL(url)}
                    cleanupOnRemove
                    entityType="groups"
                    entityId={groupId}
                    label={t('pages.create.group.imageLabel')}
                    description={t('pages.create.group.imageDescription')}
                  />
                  <VisibilityInput value={visibility} onChange={setVisibility} />
                  <HashtagEditor
                    value={hashtags}
                    onChange={setHashtags}
                    placeholder={t('pages.create.group.hashtagPlaceholder')}
                  />
                </div>
              ),
            },
          ],
        },
        // Step 4: Invite People
        {
          label: allowGuestInvites ? 'Gaeste einladen' : t('pages.create.group.inviteMembers'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'invite-people',
              kind: 'custom',
              node: (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-xs">
                    {allowGuestInvites
                      ? translateText(
                          'generated.inline.0050_diese_gruppe_vergibt_mitgliedschaft_automatis_1a57fa5b'
                        )
                      : t('pages.create.group.tips.inviteMembers')}
                  </p>
                  <UserSearchInput
                    value={invitedUserIds}
                    onChange={setInvitedUserIds}
                    label={
                      allowGuestInvites ? 'Gaeste suchen' : t('pages.create.group.searchUsers')
                    }
                    placeholder={
                      allowGuestInvites
                        ? 'Gaeste nach Name oder Handle suchen'
                        : t('pages.create.group.searchUsers')
                    }
                    excludeUserId={user?.id}
                    multi
                  />
                  <Card className="bg-muted/20 border-dashed shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                        {allowGuestInvites
                          ? translateText(
                              'generated.inline.0051_gaeste_per_csv_vorbereiten_7af02b36'
                            )
                          : t('pages.create.group.csvGuideTitle')}
                      </CardTitle>
                      <CardDescription>
                        {allowGuestInvites
                          ? translateText(
                              'generated.inline.0052_importiere_gaeste_aus_einer_csv_mit_vor_und_n_4c551db1'
                            )
                          : t('pages.create.group.csvGuideDescription')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Accordion type="single" collapsible>
                        <AccordionItem value="csv-format" className="border-none">
                          <AccordionTrigger className="hover:bg-muted/50 rounded-md px-3 py-2 text-sm hover:no-underline">
                            {t('pages.create.group.csvGuideTrigger')}
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 px-1 pt-2">
                            <DataTable
                              columns={csvGuideColumns}
                              data={csvGuideRows}
                              getRowId={row => `${row.firstName}-${row.lastName}`}
                              enablePagination={false}
                              className="space-y-0"
                            />
                            <p className="text-muted-foreground text-xs">
                              {t('pages.create.group.csvGuideFootnote')}
                            </p>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                  <div className="flex items-center gap-2">
                    <FileUploadTrigger
                      inputProps={{
                        id: 'csv-upload',
                        accept: '.csv',
                        onChange: handleCsvUpload,
                      }}
                      variant="outline"
                      className="h-auto cursor-pointer px-3 py-2 text-sm"
                    >
                      <Upload className="h-4 w-4" />
                      {allowGuestInvites
                        ? translateText('generated.inline.0053_gaeste_importieren_b28ba907')
                        : t('pages.create.group.inviteMembersOptional')}{' '}
                      {translateText('generated.inline.0337_csv_bba7e432')}
                    </FileUploadTrigger>
                  </div>
                  {csvInviteSummary && (
                    <Card className="border-muted bg-background shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {t('pages.create.group.csvSummaryTitle')}
                        </CardTitle>
                        <CardDescription>
                          {t('pages.create.group.csvSummaryDescription')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <BadgeControl className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                            {t('pages.create.group.csvFoundCount', {
                              count: csvInviteSummary.matchedNames.length,
                            })}
                          </BadgeControl>
                          <BadgeControl className="border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-50">
                            {t('pages.create.group.csvNotFoundCount', {
                              count: csvInviteSummary.notFoundNames.length,
                            })}
                          </BadgeControl>
                          {csvInviteSummary.ambiguousNames.length > 0 && (
                            <BadgeControl className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                              {t('pages.create.group.csvAmbiguousCount', {
                                count: csvInviteSummary.ambiguousNames.length,
                              })}
                            </BadgeControl>
                          )}
                        </div>

                        {csvInviteSummary.matchedNames.length > 0 && (
                          <div className="space-y-2">
                            <FormControlLabel className="text-xs tracking-wide text-emerald-700 uppercase">
                              {t('pages.create.group.csvFoundNames')}
                            </FormControlLabel>
                            <div className="flex flex-wrap gap-2">
                              {csvInviteSummary.matchedNames.map(name => (
                                <BadgeControl
                                  key={name}
                                  className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50"
                                >
                                  {name}
                                </BadgeControl>
                              ))}
                            </div>
                          </div>
                        )}

                        {csvInviteSummary.notFoundNames.length > 0 && (
                          <div className="space-y-2">
                            <FormControlLabel className="text-xs tracking-wide text-rose-700 uppercase">
                              {t('pages.create.group.csvNotFoundNames')}
                            </FormControlLabel>
                            <div className="flex flex-wrap gap-2">
                              {csvInviteSummary.notFoundNames.map(name => (
                                <BadgeControl
                                  key={name}
                                  className="border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-50"
                                >
                                  {name}
                                </BadgeControl>
                              ))}
                            </div>
                          </div>
                        )}

                        {csvInviteSummary.ambiguousNames.length > 0 && (
                          <div className="space-y-2">
                            <FormControlLabel className="text-xs tracking-wide text-amber-700 uppercase">
                              {t('pages.create.group.csvAmbiguousNames')}
                            </FormControlLabel>
                            <div className="space-y-2">
                              {csvInviteSummary.ambiguousNames.map(entry => (
                                <div
                                  key={entry.fullName}
                                  className="rounded-md border border-amber-200 bg-amber-50/60 p-3"
                                >
                                  <div className="text-sm font-medium text-amber-900">
                                    {entry.fullName}
                                  </div>
                                  <div className="text-xs text-amber-800">
                                    {t('pages.create.group.csvAmbiguousCandidates', {
                                      candidates: entry.candidates
                                        .map(candidate => candidate.name)
                                        .join(', '),
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {csvInviteSummary.invalidRows.length > 0 && (
                          <div className="space-y-2">
                            <FormControlLabel className="text-xs tracking-wide text-amber-700 uppercase">
                              {t('pages.create.group.csvInvalidRows')}
                            </FormControlLabel>
                            <div className="flex flex-wrap gap-2">
                              {csvInviteSummary.invalidRows.map(row => (
                                <BadgeControl
                                  key={row}
                                  className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50"
                                >
                                  {row}
                                </BadgeControl>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  {invitedUserIds.length > 0 && (
                    <p className="text-muted-foreground text-sm">
                      {invitedUserIds.length}{' '}
                      {allowGuestInvites
                        ? translateText('generated.inline.0054_gaeste_vorgemerkt_9ea73a37')
                        : t('pages.create.group.invited')}
                    </p>
                  )}
                </div>
              ),
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
              kind: 'custom',
              node: (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-xs">
                    {t('pages.create.group.tips.constitutionalEvent')}
                  </p>
                  <div className="flex items-center gap-3">
                    <FormControlSwitch
                      checked={createConstitutionalEvent}
                      onCheckedChange={setCreateConstitutionalEvent}
                    />
                    <FormControlLabel>
                      {t('pages.create.group.optionalGeneralAssembly')}
                    </FormControlLabel>
                  </div>
                  {createConstitutionalEvent ? (
                    <p className="text-muted-foreground rounded-md border p-4 text-xs">
                      {t('pages.create.group.eventTypeDescription')}
                    </p>
                  ) : null}
                </div>
              ),
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
                    kind: 'custom' as const,
                    node: (
                      <DateTimeRangeInput
                        startDate={eventStartDate}
                        startTime={eventStartTime}
                        showEnd={false}
                        onChange={(field, value) => {
                          if (field === 'startDate') setEventStartDate(value);
                          else if (field === 'startTime') setEventStartTime(value);
                        }}
                      />
                    ),
                  },
                ]
              : []),
          ],
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!name.trim() && emailIsValid,
          fields: [
            {
              key: 'review',
              kind: 'custom',
              node: (
                <CreateSummaryStep
                  entityType="group"
                  badge={t('pages.create.group.reviewBadge')}
                  secondaryBadge={groupTypeLabel}
                  title={name || t('pages.create.group.namePlaceholder')}
                  subtitle={description || undefined}
                  media={
                    imageURL ? { imageUrl: imageURL, imageAlt: name || 'Group image' } : undefined
                  }
                  hashtags={hashtags.length > 0 ? hashtags : undefined}
                  sections={[
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
                          ? [{ label: t('pages.create.group.imageLabel'), value: 'Attached' }]
                          : []),
                      ],
                    },
                    {
                      title: allowGuestInvites
                        ? 'Gaeste einladen'
                        : t('pages.create.group.inviteMembers'),
                      fields: [
                        ...(invitedUserNames.length > 0
                          ? [
                              {
                                label: allowGuestInvites
                                  ? 'Eingeladene Gaeste'
                                  : t('pages.create.group.invitedMembersLabel'),
                                value: invitedUserNames.join(', '),
                              },
                            ]
                          : []),
                      ],
                    },
                    {
                      title: t('pages.create.group.groupLinksLabel'),
                      content:
                        linkedGroupReviewData.length > 0 ? (
                          <div className="space-y-3">
                            {linkedGroupReviewData.map(linkedGroup => (
                              <div
                                key={linkedGroup.id}
                                className="border-border/70 bg-card/70 rounded-xl border p-3"
                              >
                                <p className="text-sm font-semibold">{linkedGroup.groupName}</p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                  {linkedGroup.relationshipLabel}
                                </p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                  {translateText(
                                    'generated.inline.0338_mitgliedschaftsmodus_f28df59b'
                                  )}{' '}
                                  {getCanonicalMembershipModeLabel(linkedGroup.membershipMode)}
                                </p>
                                {linkedGroup.rights.length > 0 ? (
                                  <GroupRelationshipRightSentenceList
                                    className="mt-3"
                                    rights={linkedGroup.rights}
                                    rightDirections={linkedGroup.rightDirections}
                                    currentGroupName={name}
                                    selectedGroupName={linkedGroup.groupName}
                                    currentGroupId={groupId}
                                    selectedGroupId={linkedGroup.id}
                                  />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : undefined,
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
                  ]}
                />
              ),
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
      locationSummary,
      imageURL,
      hashtags,
      visibility,
      visibilityLabel,
      groupType,
      resolvedGroupType,
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
      emailIsValid,
      emailValidationMessage,
      user,
    ]
  );

  return config;
}
