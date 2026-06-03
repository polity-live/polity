import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Value } from 'platejs';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Label } from '@/features/shared/ui/ui/label';
import { RadioGroup, RadioGroupItem } from '@/features/shared/ui/ui/radio-group';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/ui/hashtag-editor';
import { DateTimeRangeInput } from '../ui/inputs/DateTimeRangeInput';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { CreateInputField } from '../ui/CreateFields';
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
import { useNetworkLinkActions } from '@/zero/network';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Switch } from '@/features/shared/ui/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/shared/ui/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
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
  NetworkLinkComposerMembershipRuleValue,
  NetworkLinkComposerTab,
  NetworkLinkPreset,
  RelativeMembershipDirection,
} from '@/features/network/types/network.types';
import {
  getCanonicalMembershipModeLabel,
  getLegacySiblingMembershipMode,
} from '@/features/network/logic/networkLinkDerived';
import { NetworkLinkComposer } from '@/features/network/ui/NetworkLinkComposer';
import { useNetworkLinkComposerPreflight } from '@/features/network/hooks/useNetworkLinkComposerPreflight';
import {
  applyNetworkLinkPreset,
  buildCanonicalNetworkLinkPayload,
  buildNetworkLinkComposerDefaults,
  createEmptyMembershipRule,
  hasConfiguredNetworkLink,
  getPresetMembershipDirection,
  getSelectedMembershipDirection,
  hasConfiguredMembership,
} from '@/features/network/logic/networkLinkComposer';

type GroupType = 'base' | 'hierarchical' | 'sibling';
type RelationshipDirection = GroupRelationshipDirection;
type LinkedGroupType = GroupRelationshipType;

interface LinkedGroup {
  groupId: string;
  groupName: string;
  type: LinkedGroupType;
  membershipMode: CanonicalMembershipMode;
  roleId: string;
  sourceGroupIds: string[];
  membershipRules: Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>;
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

const CREATE_LINK_DEFAULT_PRESET: NetworkLinkPreset = 'child';

function cloneMembershipRule(
  membershipRule: NetworkLinkComposerMembershipRuleValue | null | undefined
): NetworkLinkComposerMembershipRuleValue {
  const fallbackRule = createEmptyMembershipRule();
  return {
    membershipMode: membershipRule?.membershipMode ?? fallbackRule.membershipMode,
    roleId: membershipRule?.roleId ?? fallbackRule.roleId,
    sourceGroupIds: [...(membershipRule?.sourceGroupIds ?? fallbackRule.sourceGroupIds)],
  };
}

function cloneMembershipRules(
  membershipRules:
    | Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>
    | null
    | undefined
) {
  return {
    incoming: cloneMembershipRule(membershipRules?.incoming),
    outgoing: cloneMembershipRule(membershipRules?.outgoing),
  };
}

function getDisplayMembershipRule(
  membershipRules: Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>
) {
  if (hasConfiguredMembership({ membershipRule: membershipRules.incoming })) {
    return cloneMembershipRule(membershipRules.incoming);
  }

  if (hasConfiguredMembership({ membershipRule: membershipRules.outgoing })) {
    return cloneMembershipRule(membershipRules.outgoing);
  }

  return cloneMembershipRule(membershipRules.incoming);
}

function hasIncompleteMembershipRules(
  membershipRules: Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>
) {
  return [membershipRules.incoming, membershipRules.outgoing].some(membershipRule => {
    if (membershipRule.membershipMode === 'role_members') {
      return !membershipRule.roleId;
    }

    if (membershipRule.membershipMode === 'selected_source_groups') {
      return membershipRule.sourceGroupIds.length === 0;
    }

    return false;
  });
}

function toLinkedGroup(args: {
  groupId: string;
  groupName: string;
  type: LinkedGroupType;
  membershipRules: Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>;
  rightDirections: Record<GroupRelationshipRight, RelationshipDirection>;
}): LinkedGroup {
  const nextMembershipRules = cloneMembershipRules(args.membershipRules);
  const displayMembershipRule = getDisplayMembershipRule(nextMembershipRules);

  return {
    groupId: args.groupId,
    groupName: args.groupName,
    type: args.type,
    membershipMode: displayMembershipRule.membershipMode,
    roleId: displayMembershipRule.roleId,
    sourceGroupIds: [...displayMembershipRule.sourceGroupIds],
    membershipRules: nextMembershipRules,
    rightDirections: { ...args.rightDirections },
  };
}

function buildCreateLinkPresetDefaults(preset: NetworkLinkPreset = CREATE_LINK_DEFAULT_PRESET) {
  const presetValue = applyNetworkLinkPreset(preset, buildNetworkLinkComposerDefaults());
  const membershipRules = cloneMembershipRules(presetValue.membershipRules);

  return {
    type: presetValue.relationshipType as LinkedGroupType,
    membershipRules,
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

function buildCanonicalNetworkLink(args: {
  currentGroupId: string;
  otherGroupId: string;
  linkType: LinkedGroupType;
  rightDirections: Record<GroupRelationshipRight, RelationshipDirection>;
  membershipRules: Record<RelativeMembershipDirection, NetworkLinkComposerMembershipRuleValue>;
}) {
  return buildCanonicalNetworkLinkPayload({
    currentGroupId: args.currentGroupId,
    otherGroupId: args.otherGroupId,
    relationshipType: args.linkType,
    rightDirections: args.rightDirections,
    membershipRules: cloneMembershipRules(args.membershipRules),
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
  const { proposeNetworkLinkChange } = useNetworkLinkActions();
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
  const [linkMembershipRules, setLinkMembershipRules] = useState(() =>
    cloneMembershipRules(initialLinkPresetState.membershipRules)
  );
  const [linkRightDirections, setLinkRightDirections] = useState<
    Record<GroupRelationshipRight, RelationshipDirection>
  >(() => initialLinkPresetState.rightDirections);
  const [linkComposerTab, setLinkComposerTab] = useState<NetworkLinkComposerTab>('preset');
  const [linkPreset, setLinkPreset] = useState<NetworkLinkPreset>(initialLinkPresetState.preset);

  const { roles: selectedGroupRoles } = useGroupRoles(linkGroupId || groupId);
  const { roles: currentGroupRoles } = useGroupRoles(groupId);

  // Constitutional event state
  const [createConstitutionalEvent, setCreateConstitutionalEvent] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');

  const { allHashtags } = useCommonState({ loadAllHashtags: true });
  const emailValidationMessage = t('common.validation.emailHint', 'Enter a valid email address.');
  const emailIsValid = isValidOptionalEmailAddress(email);
  const radioGroupType = groupType === 'sibling' ? 'hierarchical' : groupType;
  const siblingLinks = linkedGroups.filter(link => link.type === 'sibling');
  const siblingMembershipModes = siblingLinks.flatMap(link => [
    link.membershipRules.incoming.membershipMode,
    link.membershipRules.outgoing.membershipMode,
  ]);
  const activeLinkMembershipDirection =
    getSelectedMembershipDirection({ membershipRules: linkMembershipRules }) ??
    getPresetMembershipDirection(linkPreset);
  const activeLinkMembershipRule = cloneMembershipRule(
    linkMembershipRules[activeLinkMembershipDirection]
  );
  const siblingMembershipMode = activeLinkMembershipRule.membershipMode;
  const connectedRoleId = activeLinkMembershipRule.roleId;
  const hasConfiguredLink = hasConfiguredNetworkLink({
    rightDirections: linkRightDirections,
    membershipRules: linkMembershipRules,
  });
  const hasIncompleteLinkMembershipRules = hasIncompleteMembershipRules(linkMembershipRules);
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
      membershipRules: linkMembershipRules,
      rightDirections: linkRightDirections,
      preset: linkPreset,
    }),
    [linkGroupId, linkMembershipRules, linkPreset, linkRightDirections, linkType]
  );

  useEffect(() => {
    setLinkMembershipRules(current => ({
      incoming: {
        ...current.incoming,
        roleId: '',
      },
      outgoing: {
        ...current.outgoing,
        roleId: '',
      },
    }));
  }, [linkGroupId]);

  const handleDescriptionContentChange = useCallback((value: Value) => {
    setDescriptionContent(value);
    setDescription(richTextToPlainText(value));
  }, []);

  const activeLinkConflictPreflight = useNetworkLinkComposerPreflight({
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
    if (!linkGroupId || !hasConfiguredLink) {
      toast.error(
        'Bitte waehle eine Gruppe und konfiguriere mindestens ein Recht oder eine Mitgliedschaftsregel.'
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
      toast.error('Bitte vervollstaendige alle konfigurierten Mitgliedschaftsregeln.');
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
                membershipRules: linkMembershipRules,
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
          membershipRules: linkMembershipRules,
          rightDirections: linkRightDirections,
        }),
      ]);
    }
    const resetState = buildCreateLinkPresetDefaults();
    setLinkGroupId('');
    setLinkType(resetState.type);
    setLinkRightDirections(resetState.rightDirections);
    setLinkMembershipRules(resetState.membershipRules);
    setLinkComposerTab('preset');
    setLinkPreset(resetState.preset);
  }, [
    activeLinkConflictPreflight.blocking,
    activeLinkConflictPreflight.response.summary,
    hasConfiguredLink,
    hasIncompleteLinkMembershipRules,
    linkGroupId,
    linkMembershipRules,
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
          description: 'Initial guest access created during group setup.',
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
          proposeNetworkLinkChange({
            id: crypto.randomUUID(),
            active_network_link_id: null,
            ...(() => {
              const payload = buildCanonicalNetworkLink({
                currentGroupId: groupId,
                otherGroupId: link.groupId,
                linkType: link.type,
                rightDirections: link.rightDirections,
                membershipRules: link.membershipRules,
              });
              return {
                proposed_network_link_id: payload.id,
                source_group_id: payload.source_group_id,
                target_group_id: payload.target_group_id,
                structural_relation: payload.structural_relation,
                initiator_group_id: groupId,
                desired_rights: payload.rights.map(right => ({
                  id: right.id,
                  right_key: right.right_key,
                  direction: right.direction,
                })),
                desired_membership_rules: {
                  forward: payload.membership_rule.forward,
                  backward: payload.membership_rule.backward,
                },
                desired_membership_mode: payload.membership_rule.membership_mode,
                desired_role_id: payload.membership_rule.role_id ?? null,
                desired_source_group_ids: payload.membership_rule.source_group_ids ?? null,
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
    resolvedGroupType === 'base'
      ? t('pages.create.group.groupTypes.base')
      : resolvedGroupType === 'hierarchical'
        ? t('pages.create.group.groupTypes.hierarchical')
        : t('common.network.sibling', 'Geschwistergruppe');
  const visibilityLabel =
    visibility === 'public'
      ? t('pages.create.common.public')
      : visibility === 'authenticated'
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
          ? (getLegacySiblingMembershipMode(linkedGroup.membershipMode) ?? undefined)
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
      incoming: (selectedGroupRoles ?? []).filter(
        role => role.scope === 'group' && role.assignee_kind !== 'guest'
      ),
      outgoing: (currentGroupRoles ?? []).filter(
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
          content: (
            <div className="space-y-4">
              <CreateInputField
                label={t('pages.create.group.nameLabel')}
                required
                hint={t('pages.create.group.tips.name')}
                value={name}
                onValueChange={setName}
                placeholder={t('pages.create.group.namePlaceholder')}
              />
              <div className="space-y-2">
                <Label>{t('pages.create.group.descriptionLabel')}</Label>
                <p className="text-muted-foreground text-xs">
                  {t('pages.create.group.tips.description')}
                </p>
                <MiniPlateEditor
                  value={descriptionContent}
                  onChange={handleDescriptionContentChange}
                  placeholder={t('pages.create.group.descriptionPlaceholder')}
                />
              </div>
              <CreateInputField
                label={t('pages.create.group.emailLabel')}
                type="email"
                validator={value =>
                  isValidOptionalEmailAddress(value) ? null : emailValidationMessage
                }
                value={email}
                onValueChange={setEmail}
                placeholder={t('pages.create.group.emailPlaceholder')}
              />
              <div className="space-y-2">
                <Label>{t('pages.create.group.groupType')}</Label>
                <RadioGroup
                  value={radioGroupType}
                  onValueChange={value => setGroupType(value as GroupType)}
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="group-type-base"
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        radioGroupType === 'base'
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value="base" id="group-type-base" className="mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">
                          {t('pages.create.group.groupTypes.base')}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t('pages.create.group.groupTypes.baseDesc')}
                        </div>
                      </div>
                    </Label>
                    <Label
                      htmlFor="group-type-hierarchical"
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        radioGroupType === 'hierarchical'
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem
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
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          ),
        },
        {
          label: t('pages.create.group.linkGroups'),
          isValid: () => true,
          content: (
            <div className="space-y-6">
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <Label>Verbindungen zu anderen Gruppen</Label>
                  <p className="text-muted-foreground text-xs">
                    {groupType === 'base'
                      ? t('pages.create.group.tips.linkGroups')
                      : 'Waehle zuerst eine Gruppe. Im Beziehungstyp entscheidest du dann, ob diese Gruppe uebergeordnet, untergeordnet oder eine Geschwistergruppe ist.'}
                  </p>
                </div>

                <NetworkLinkComposer
                  activeTab={linkComposerTab}
                  onActiveTabChange={setLinkComposerTab}
                  value={linkComposerValue}
                  onValueChange={nextValue => {
                    setLinkGroupId(nextValue.selectedGroupId);
                    setLinkType(nextValue.relationshipType);
                    setLinkMembershipRules(nextValue.membershipRules);
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
                      !hasConfiguredLink ||
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
                      setLinkMembershipRules(resetState.membershipRules);
                      setLinkComposerTab('preset');
                      setLinkPreset(resetState.preset);
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
                {activeLinkConflictPreflight.isLoading ? (
                  <div className="text-muted-foreground text-sm">Pruefe Konflikte...</div>
                ) : null}
              </div>

              {linkedGroups.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    {t('pages.create.group.linkedGroups')}
                  </Label>
                  {linkedGroups.map(linkedGroup => (
                    <div
                      key={`${linkedGroup.type}-${linkedGroup.groupId}`}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <Badge
                        className={cn(
                          'border text-xs hover:opacity-100',
                          getRelationshipBadgeClasses(linkedGroup.type)
                        )}
                      >
                        {linkedGroup.type === 'parent'
                          ? t('pages.create.group.parent')
                          : linkedGroup.type === 'child'
                            ? t('pages.create.group.child')
                            : t('common.network.sibling', 'Geschwistergruppe')}
                      </Badge>
                      <Badge className="border-muted bg-muted/50 text-foreground text-xs hover:opacity-100">
                        {getCanonicalMembershipModeLabel(linkedGroup.membershipMode)}
                      </Badge>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="space-y-1">
                          <span className="block text-sm font-medium">{linkedGroup.groupName}</span>
                          <p className="text-muted-foreground text-xs">
                            {getCurrentGroupRelationshipLabel({
                              relationshipType: linkedGroup.type,
                              currentGroupName: name,
                              selectedGroupName: linkedGroup.groupName,
                              siblingMembershipMode:
                                linkedGroup.type === 'sibling'
                                  ? (getLegacySiblingMembershipMode(linkedGroup.membershipMode) ??
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
        {
          label: t('pages.create.group.locationLabel'),
          isValid: () => true,
          optional: true,
          content: (
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
        {
          label: t('pages.create.group.imageAndTags'),
          isValid: () => true,
          optional: true,
          content: (
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
        // Step 4: Invite People
        {
          label: allowGuestInvites ? 'Gaeste einladen' : t('pages.create.group.inviteMembers'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs">
                {allowGuestInvites
                  ? 'Diese Gruppe vergibt Mitgliedschaft automatisch. Du kannst hier stattdessen Gaeste mit einer Gastrolle einladen.'
                  : t('pages.create.group.tips.inviteMembers')}
              </p>
              <UserSearchInput
                value={invitedUserIds}
                onChange={setInvitedUserIds}
                label={allowGuestInvites ? 'Gaeste suchen' : t('pages.create.group.searchUsers')}
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
                      ? 'Gaeste per CSV vorbereiten'
                      : t('pages.create.group.csvGuideTitle')}
                  </CardTitle>
                  <CardDescription>
                    {allowGuestInvites
                      ? 'Importiere Gaeste aus einer CSV mit Vor- und Nachname.'
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
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('pages.create.group.csvColumnFirstName')}</TableHead>
                              <TableHead>{t('pages.create.group.csvColumnLastName')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>Ada</TableCell>
                              <TableCell>Lovelace</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Grace</TableCell>
                              <TableCell>Hopper</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                        <p className="text-muted-foreground text-xs">
                          {t('pages.create.group.csvGuideFootnote')}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="csv-upload"
                  className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  {allowGuestInvites
                    ? 'Gaeste importieren'
                    : t('pages.create.group.inviteMembersOptional')}{' '}
                  (CSV)
                </Label>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvUpload}
                />
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
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                        {t('pages.create.group.csvFoundCount', {
                          count: csvInviteSummary.matchedNames.length,
                        })}
                      </Badge>
                      <Badge className="border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-50">
                        {t('pages.create.group.csvNotFoundCount', {
                          count: csvInviteSummary.notFoundNames.length,
                        })}
                      </Badge>
                      {csvInviteSummary.ambiguousNames.length > 0 && (
                        <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                          {t('pages.create.group.csvAmbiguousCount', {
                            count: csvInviteSummary.ambiguousNames.length,
                          })}
                        </Badge>
                      )}
                    </div>

                    {csvInviteSummary.matchedNames.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs tracking-wide text-emerald-700 uppercase">
                          {t('pages.create.group.csvFoundNames')}
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {csvInviteSummary.matchedNames.map(name => (
                            <Badge
                              key={name}
                              className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50"
                            >
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {csvInviteSummary.notFoundNames.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs tracking-wide text-rose-700 uppercase">
                          {t('pages.create.group.csvNotFoundNames')}
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {csvInviteSummary.notFoundNames.map(name => (
                            <Badge
                              key={name}
                              className="border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-50"
                            >
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {csvInviteSummary.ambiguousNames.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs tracking-wide text-amber-700 uppercase">
                          {t('pages.create.group.csvAmbiguousNames')}
                        </Label>
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
                        <Label className="text-xs tracking-wide text-amber-700 uppercase">
                          {t('pages.create.group.csvInvalidRows')}
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {csvInviteSummary.invalidRows.map(row => (
                            <Badge
                              key={row}
                              className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50"
                            >
                              {row}
                            </Badge>
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
                  {allowGuestInvites ? 'Gaeste vorgemerkt' : t('pages.create.group.invited')}
                </p>
              )}
            </div>
          ),
        },
        // Step 6: Constitutional Event
        {
          label: t('pages.create.group.createConstitutionalEvent'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs">
                {t('pages.create.group.tips.constitutionalEvent')}
              </p>
              <div className="flex items-center gap-3">
                <Switch
                  checked={createConstitutionalEvent}
                  onCheckedChange={setCreateConstitutionalEvent}
                />
                <Label>{t('pages.create.group.optionalGeneralAssembly')}</Label>
              </div>
              {createConstitutionalEvent && (
                <div className="space-y-4 rounded-md border p-4">
                  <p className="text-muted-foreground text-xs">
                    {t('pages.create.group.eventTypeDescription')}
                  </p>
                  <CreateInputField
                    label={t('pages.create.group.eventName')}
                    value={eventName}
                    onValueChange={setEventName}
                    placeholder={t('pages.create.group.eventNamePlaceholder')}
                  />
                  <CreateInputField
                    label={t('pages.create.group.eventLocation')}
                    value={eventLocation}
                    onValueChange={setEventLocation}
                    placeholder={t('pages.create.group.eventLocationPlaceholder')}
                  />
                  <DateTimeRangeInput
                    startDate={eventStartDate}
                    startTime={eventStartTime}
                    showEnd={false}
                    onChange={(field, value) => {
                      if (field === 'startDate') setEventStartDate(value);
                      else if (field === 'startTime') setEventStartTime(value);
                    }}
                  />
                </div>
              )}
            </div>
          ),
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!name.trim() && emailIsValid,
          content: (
            <CreateSummaryStep
              entityType="group"
              badge={t('pages.create.group.reviewBadge')}
              secondaryBadge={groupTypeLabel}
              title={name || t('pages.create.group.namePlaceholder')}
              subtitle={description || undefined}
              media={imageURL ? { imageUrl: imageURL, imageAlt: name || 'Group image' } : undefined}
              hashtags={hashtags.length > 0 ? hashtags : undefined}
              sections={[
                {
                  title: t('pages.create.group.basicInfo'),
                  fields: [
                    ...(email ? [{ label: t('pages.create.group.emailLabel'), value: email }] : []),
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
                      ? [{ label: t('pages.create.group.locationLabel'), value: locationSummary }]
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
                              Mitgliedschaftsmodus:{' '}
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
