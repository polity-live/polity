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
import { useAllGroups, useGroupState } from '@/zero/groups/useGroupState';
import { buildExistingRightStatusesForDirection } from '@/features/network/logic/networkRelationshipHelpers';
import { useUserState } from '@/zero/users/useUserState';
import { useAuth } from '@/providers/auth-provider';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import {
  getSiblingMembershipModeLabel,
  getGroupRelationshipDirectionOptions,
  getCurrentGroupRelationshipLabel,
  GroupRelationshipRightSentenceList,
  GroupRelationshipRightsSelector,
  GroupRelationshipTypeSelect,
  type GroupRelationshipDirection,
  type GroupRelationshipRight,
  type GroupRelationshipType,
} from '@/features/network/ui/GroupRelationshipFields';
import {
  getHierarchyPairForSelection,
  getStoredHierarchyRelationshipTypeForSource,
} from '@/features/network/logic/groupRelationshipOrientation';
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
import { CreateTypeaheadField } from '../ui/CreateFields';

type GroupType = 'base' | 'hierarchical' | 'sibling';
type SiblingMembershipMode = 'open' | 'elected' | 'parliament';
type RelationshipDirection = GroupRelationshipDirection;
type LinkedGroupType = GroupRelationshipType | 'sibling';

interface LinkedGroup {
  groupId: string;
  groupName: string;
  type: LinkedGroupType;
  siblingMembershipMode?: SiblingMembershipMode;
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

interface ConfiguredConnectedGroup {
  groupId: string;
  groupName: string;
  membershipMode: SiblingMembershipMode;
  roleId: string;
  rightDirections: Record<GroupRelationshipRight, RelationshipDirection>;
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

function hasSelectedRights(rightDirections: Record<GroupRelationshipRight, RelationshipDirection>) {
  return getSelectedRights(rightDirections).length > 0;
}

function toggleRightDirection(
  rightDirections: Record<GroupRelationshipRight, RelationshipDirection>,
  right: GroupRelationshipRight
) {
  return {
    ...rightDirections,
    [right]: rightDirections[right] === 'none' ? 'outgoing' : 'none',
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

function canInviteOfficialMembers(
  groupType: GroupType,
  siblingMembershipMode: SiblingMembershipMode
) {
  return groupType === 'base' || (groupType === 'sibling' && siblingMembershipMode === 'open');
}

function canInviteGuests(groupType: GroupType, siblingMembershipMode: SiblingMembershipMode) {
  return (
    groupType === 'hierarchical' ||
    (groupType === 'sibling' &&
      (siblingMembershipMode === 'elected' || siblingMembershipMode === 'parliament'))
  );
}

function buildRelationshipRequests(args: {
  currentGroupId: string;
  otherGroupId: string;
  linkType: LinkedGroupType;
  rightDirections: Record<GroupRelationshipRight, RelationshipDirection>;
}) {
  const requests: {
    group_id: string;
    related_group_id: string;
    relationship_type: GroupRelationshipType | 'sibling';
    with_right: GroupRelationshipRight;
  }[] = [];

  if (args.linkType === 'sibling') {
    for (const right of RELATIONSHIP_RIGHTS) {
      const direction = args.rightDirections[right];
      if (direction === 'outgoing' || direction === 'bidirectional') {
        requests.push({
          group_id: args.currentGroupId,
          related_group_id: args.otherGroupId,
          relationship_type: 'sibling',
          with_right: right,
        });
      }

      if (direction === 'incoming' || direction === 'bidirectional') {
        requests.push({
          group_id: args.otherGroupId,
          related_group_id: args.currentGroupId,
          relationship_type: 'sibling',
          with_right: right,
        });
      }
    }

    return requests;
  }

  const hierarchyPair = getHierarchyPairForSelection({
    currentGroupId: args.currentGroupId,
    otherGroupId: args.otherGroupId,
    relationshipType: args.linkType,
  });

  for (const right of RELATIONSHIP_RIGHTS) {
    const direction = args.rightDirections[right];
    if (direction === 'none') {
      continue;
    }

    if (direction === 'outgoing' || direction === 'bidirectional') {
      requests.push({
        group_id: args.currentGroupId,
        related_group_id: args.otherGroupId,
        relationship_type: getStoredHierarchyRelationshipTypeForSource(
          args.currentGroupId,
          hierarchyPair
        ),
        with_right: right,
      });
    }

    if (direction === 'incoming' || direction === 'bidirectional') {
      requests.push({
        group_id: args.otherGroupId,
        related_group_id: args.currentGroupId,
        relationship_type: getStoredHierarchyRelationshipTypeForSource(
          args.otherGroupId,
          hierarchyPair
        ),
        with_right: right,
      });
    }
  }

  return requests;
}

export function useCreateGroupForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createGroup, createRole, inviteGuest, inviteMember, createRelationship } =
    useGroupActions();
  const { createEvent } = useEventActions();
  const commonActions = useCommonActions();
  const { groups: allGroups } = useAllGroups();
  const { allUsers } = useUserState({ includeAllUsers: true });

  const [groupId] = useState(() => crypto.randomUUID());
  const [groupType, setGroupType] = useState<GroupType>('base');
  const [connectedGroupId, setConnectedGroupId] = useState('');
  const [siblingMembershipMode, setSiblingMembershipMode] = useState<SiblingMembershipMode>('open');
  const [connectedRoleId, setConnectedRoleId] = useState('');
  const [siblingRelationshipDirections, setSiblingRelationshipDirections] = useState<
    Record<GroupRelationshipRight, RelationshipDirection>
  >(createInitialRelationshipDirections);
  const [configuredConnectedGroup, setConfiguredConnectedGroup] =
    useState<ConfiguredConnectedGroup | null>(null);
  const [showConnectedGroupComposer, setShowConnectedGroupComposer] = useState(false);
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
  const [linkType, setLinkType] = useState<LinkedGroupType>('parent');
  const [linkRightDirections, setLinkRightDirections] = useState<
    Record<GroupRelationshipRight, RelationshipDirection>
  >(createInitialRelationshipDirections);
  const [showSiblingLinkComposer, setShowSiblingLinkComposer] = useState(false);

  const relationshipDirectionOptions = useMemo(() => getGroupRelationshipDirectionOptions(t), [t]);

  const { relationships: draftRelationships, relationshipsAsTarget: draftRelationshipsAsTarget } =
    useGroupState({ groupId: linkGroupId ? groupId : undefined });
  const activeConnectedGroupId = linkType === 'sibling' ? linkGroupId : connectedGroupId;
  const { roles: connectedGroupRoles } = useGroupState({
    groupId: activeConnectedGroupId || undefined,
  });

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
  const resolvedGroupType: GroupType =
    groupType === 'sibling' || (groupType === 'hierarchical' && configuredConnectedGroup)
      ? 'sibling'
      : groupType;
  const effectiveSiblingMembershipMode =
    configuredConnectedGroup?.membershipMode ?? siblingMembershipMode;
  const allowOfficialMemberInvites = canInviteOfficialMembers(
    resolvedGroupType,
    effectiveSiblingMembershipMode
  );
  const allowGuestInvites = canInviteGuests(resolvedGroupType, effectiveSiblingMembershipMode);

  useEffect(() => {
    if (groupType === 'base' && linkType !== 'child') {
      setLinkType('child');
    }
  }, [groupType, linkType]);

  useEffect(() => {
    if (groupType === 'base' || linkType !== 'sibling') {
      setConfiguredConnectedGroup(null);
      setShowConnectedGroupComposer(false);
      setConnectedGroupId('');
      setConnectedRoleId('');
      setSiblingRelationshipDirections(createInitialRelationshipDirections());
    }
  }, [groupType, linkType]);

  useEffect(() => {
    if (siblingMembershipMode !== 'elected') {
      setConnectedRoleId('');
    }
  }, [siblingMembershipMode]);

  useEffect(() => {
    setConnectedRoleId('');
  }, [activeConnectedGroupId]);

  useEffect(() => {
    setLinkedGroups(currentLinks => currentLinks.filter(link => link.type !== 'sibling'));
    setShowSiblingLinkComposer(false);
    setLinkGroupId('');
    setLinkRightDirections(createInitialRelationshipDirections());
  }, [groupType]);

  const resetSiblingLinkComposer = useCallback(() => {
    setShowSiblingLinkComposer(true);
    setLinkGroupId('');
    setLinkRightDirections(createInitialRelationshipDirections());
  }, []);

  const resetConnectedGroupComposer = useCallback(() => {
    setShowConnectedGroupComposer(true);
    setConnectedGroupId('');
    setSiblingMembershipMode('open');
    setConnectedRoleId('');
    setSiblingRelationshipDirections(createInitialRelationshipDirections());
  }, []);

  const handleDescriptionContentChange = useCallback((value: Value) => {
    setDescriptionContent(value);
    setDescription(richTextToPlainText(value));
  }, []);

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
    if (!linkGroupId || !hasSelectedRights(linkRightDirections)) {
      toast.error(t('pages.create.group.selectGroupAndRights'));
      return;
    }

    if (linkType === 'sibling') {
      const group = allGroups.find(g => g.id === linkGroupId);

      if (group?.group_type === 'sibling') {
        toast.error(
          'Geschwistergruppen koennen nur mit Basis- oder hierarchischen Gruppen verbunden werden.'
        );
        return;
      }

      if (siblingMembershipMode === 'elected' && !connectedRoleId) {
        toast.error('Bitte waehle eine Rolle der verbundenen Gruppe aus.');
        return;
      }

      setConfiguredConnectedGroup({
        groupId: linkGroupId,
        groupName: group?.name ?? linkGroupId,
        membershipMode: siblingMembershipMode,
        roleId: connectedRoleId,
        rightDirections: { ...linkRightDirections },
      });
      setLinkGroupId('');
      setLinkRightDirections(createInitialRelationshipDirections());
      setSiblingMembershipMode('open');
      setConnectedRoleId('');
      setShowSiblingLinkComposer(false);
      return;
    }

    const existing = linkedGroups.find(g => g.groupId === linkGroupId);
    if (existing) {
      toast.info(t('pages.create.group.groupAlreadyLinked'));
      setLinkedGroups(prev =>
        prev.map(g =>
          g.groupId === linkGroupId
            ? {
                ...g,
                type: linkType,
                rightDirections: { ...linkRightDirections },
              }
            : g
        )
      );
    } else {
      const group = allGroups.find(g => g.id === linkGroupId);
      setLinkedGroups(prev => [
        ...prev,
        {
          groupId: linkGroupId,
          groupName: group?.name ?? linkGroupId,
          type: linkType,
          rightDirections: { ...linkRightDirections },
        },
      ]);
    }
    setLinkGroupId('');
    setLinkRightDirections(createInitialRelationshipDirections());
    setShowSiblingLinkComposer(false);
  }, [
    linkGroupId,
    linkRightDirections,
    linkType,
    linkedGroups,
    allGroups,
    t,
    siblingMembershipMode,
    connectedRoleId,
    linkType,
    linkedGroups,
  ]);

  const handleRemoveLinkedGroup = useCallback(
    (gId: string) => {
      setLinkedGroups(prev => prev.filter(g => g.groupId !== gId));
      if (groupType === 'sibling' && configuredConnectedGroup?.groupId === gId) {
        setConfiguredConnectedGroup(null);
      }
    },
    [groupType, configuredConnectedGroup]
  );

  const handleAddConfiguredConnectedGroup = useCallback(() => {
    if (!connectedGroupId) {
      toast.error('Bitte waehle eine verbundene Gruppe aus.');
      return;
    }

    if (siblingMembershipMode === 'elected' && !connectedRoleId) {
      toast.error('Bitte waehle eine Rolle der verbundenen Gruppe aus.');
      return;
    }

    const connectedGroup = allGroups.find(group => group.id === connectedGroupId);

    setConfiguredConnectedGroup({
      groupId: connectedGroupId,
      groupName: connectedGroup?.name ?? connectedGroupId,
      membershipMode: siblingMembershipMode,
      roleId: connectedRoleId,
      rightDirections: { ...siblingRelationshipDirections },
    });
    setShowConnectedGroupComposer(false);
    setConnectedGroupId('');
    setSiblingMembershipMode('open');
    setConnectedRoleId('');
    setSiblingRelationshipDirections(createInitialRelationshipDirections());
  }, [
    allGroups,
    connectedGroupId,
    connectedRoleId,
    siblingMembershipMode,
    siblingRelationshipDirections,
  ]);

  const handleRemoveConfiguredConnectedGroup = useCallback(() => {
    setConfiguredConnectedGroup(null);
    setShowConnectedGroupComposer(false);
    setConnectedGroupId('');
    setSiblingMembershipMode('open');
    setConnectedRoleId('');
    setSiblingRelationshipDirections(createInitialRelationshipDirections());
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !emailIsValid) {
      if (!emailIsValid) {
        toast.error(emailValidationMessage);
      }
      return;
    }

    if (resolvedGroupType === 'sibling') {
      if (!configuredConnectedGroup) {
        toast.error('Bitte waehle eine verbundene Gruppe aus.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const derivedParliamentSourceGroupIds =
        resolvedGroupType === 'sibling' && configuredConnectedGroup?.membershipMode === 'parliament'
          ? Array.from(
              new Set(
                [
                  {
                    groupId: configuredConnectedGroup.groupId,
                    rightDirections: configuredConnectedGroup.rightDirections,
                  },
                  ...linkedGroups,
                ]
                  .filter(connection => connection.rightDirections.passiveVotingRight !== 'none')
                  .map(connection => connection.groupId)
              )
            )
          : [];

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
        group_type: resolvedGroupType,
        connected_group_id:
          resolvedGroupType === 'sibling' ? (configuredConnectedGroup?.groupId ?? null) : null,
        sibling_membership_mode:
          resolvedGroupType === 'sibling'
            ? (configuredConnectedGroup?.membershipMode ?? null)
            : null,
        sibling_role_id:
          resolvedGroupType === 'sibling' && configuredConnectedGroup?.membershipMode === 'elected'
            ? configuredConnectedGroup.roleId || null
            : null,
        parliament_source_group_ids:
          resolvedGroupType === 'sibling' &&
          configuredConnectedGroup?.membershipMode === 'parliament'
            ? derivedParliamentSourceGroupIds
            : [],
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
      } else if (allowGuestInvites && invitedUserIds.length > 0) {
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

      if (resolvedGroupType === 'sibling' && configuredConnectedGroup) {
        for (const relationship of buildRelationshipRequests({
          currentGroupId: groupId,
          otherGroupId: configuredConnectedGroup.groupId,
          linkType: 'sibling',
          rightDirections: configuredConnectedGroup.rightDirections,
        })) {
          await createRelationship({
            id: crypto.randomUUID(),
            ...relationship,
            status: 'requested',
            initiator_group_id: groupId,
          });
        }
      }

      // Create group relationships
      for (const link of linkedGroups) {
        for (const relationship of buildRelationshipRequests({
          currentGroupId: groupId,
          otherGroupId: link.groupId,
          linkType: link.type,
          rightDirections: link.rightDirections,
        })) {
          await createRelationship({
            id: crypto.randomUUID(),
            ...relationship,
            status: 'requested',
            initiator_group_id: groupId,
          });
        }
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

  const selectedLinkedGroupName = allGroups.find(group => group.id === linkGroupId)?.name ?? '';
  const configuredConnectedGroupName =
    allGroups.find(group => group.id === configuredConnectedGroup?.groupId)?.name ??
    configuredConnectedGroup?.groupName ??
    '';
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
  const connectedGroupRights = configuredConnectedGroup
    ? getSelectedRights(configuredConnectedGroup.rightDirections)
    : [];
  const linkedGroupReviewData = linkedGroups.map(linkedGroup => ({
    id: linkedGroup.groupId,
    groupName: linkedGroup.groupName,
    type: linkedGroup.type,
    relationshipLabel: getCurrentGroupRelationshipLabel({
      relationshipType: linkedGroup.type,
      currentGroupName: name,
      selectedGroupName: linkedGroup.groupName,
      siblingMembershipMode: linkedGroup.siblingMembershipMode,
      t,
    }),
    rights: getSelectedRights(linkedGroup.rightDirections),
    rightDirections: linkedGroup.rightDirections,
  }));
  const constitutionalEventStart =
    eventStartDate || eventStartTime
      ? `${eventStartDate || ''}${eventStartTime ? ` ${eventStartTime}` : ''}`.trim()
      : '';
  const selectableConnectedGroups = useMemo(
    () => allGroups.filter(group => group.id !== groupId && group.group_type !== 'sibling'),
    [allGroups, groupId]
  );
  const selectableLinkGroups = useMemo(
    () => allGroups.filter(group => group.id !== groupId),
    [allGroups, groupId]
  );
  const selectableConnectedRoles = useMemo(
    () =>
      (connectedGroupRoles ?? []).filter(
        role => role.scope === 'group' && role.assignee_kind !== 'guest'
      ),
    [connectedGroupRoles]
  );
  const selectedLinkRights = useMemo(
    () => new Set(getSelectedRights(linkRightDirections)),
    [linkRightDirections]
  );
  const selectedConnectedRights = useMemo(
    () => new Set(getSelectedRights(siblingRelationshipDirections)),
    [siblingRelationshipDirections]
  );
  const configuredConnectedRights = useMemo(
    () =>
      new Set(
        getSelectedRights(
          configuredConnectedGroup?.rightDirections ?? createInitialRelationshipDirections()
        )
      ),
    [configuredConnectedGroup]
  );

  const existingRightStatuses = useMemo(() => {
    if (!linkGroupId) {
      return undefined;
    }

    const statuses = new Map(
      buildExistingRightStatusesForDirection(
        [...(draftRelationships ?? []), ...(draftRelationshipsAsTarget ?? [])],
        {
          currentGroupId: groupId,
          otherGroupId: linkGroupId,
          relationshipType: linkType,
        }
      )
    );

    const pendingLink = linkedGroups.find(group => group.groupId === linkGroupId);
    const pendingSiblingGroup =
      configuredConnectedGroup?.groupId === linkGroupId ? configuredConnectedGroup : null;
    getSelectedRights(
      pendingSiblingGroup?.rightDirections ??
        pendingLink?.rightDirections ??
        createInitialRelationshipDirections()
    ).forEach(right => {
      if (!statuses.has(right)) {
        statuses.set(right, 'outgoing');
      }
    });

    return statuses.size > 0 ? statuses : undefined;
  }, [
    linkGroupId,
    linkType,
    groupId,
    draftRelationships,
    draftRelationshipsAsTarget,
    linkedGroups,
    configuredConnectedGroup,
  ]);

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
          isValid: () => linkType !== 'sibling' || configuredConnectedGroup !== null,
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

                <CreateTypeaheadField
                  label={t('pages.create.group.selectGroup')}
                  items={toTypeaheadItems(
                    selectableLinkGroups,
                    'group',
                    group => group.name || 'Group',
                    group =>
                      typeof group.description === 'string'
                        ? group.description.substring(0, 60)
                        : undefined,
                    undefined,
                    group => `/group/${group.id}`
                  )}
                  value={linkGroupId || undefined}
                  onChange={item => setLinkGroupId(item?.id ?? '')}
                  placeholder={t('pages.create.group.searchGroups')}
                  showAllOnFocus
                />

                {linkGroupId ? (
                  <>
                    <GroupRelationshipTypeSelect
                      id="create-group-relationship-type"
                      label={t('pages.create.group.relationshipType')}
                      value={linkType}
                      currentGroupName={name}
                      selectedGroupName={selectedLinkedGroupName}
                      siblingMembershipMode={
                        linkType === 'sibling' ? siblingMembershipMode : undefined
                      }
                      onValueChange={value => setLinkType(value)}
                      disabledOptions={{
                        parent: groupType === 'base',
                        sibling: groupType === 'base',
                      }}
                      helperText={
                        groupType === 'base'
                          ? t('common.network.baseGroupsCanOnlyBeChildren')
                          : undefined
                      }
                    />

                    {linkType === 'sibling' ? (
                      <>
                        <div className="space-y-2">
                          <Label>Geschwistergruppentyp</Label>
                          <RadioGroup
                            value={siblingMembershipMode}
                            onValueChange={value =>
                              setSiblingMembershipMode(value as SiblingMembershipMode)
                            }
                          >
                            <div className="grid gap-2 md:grid-cols-3">
                              {[
                                {
                                  value: 'open',
                                  title: getSiblingMembershipModeLabel('open', t),
                                  description:
                                    'Mitglieder der verbundenen Gruppe koennen selbst beitreten.',
                                },
                                {
                                  value: 'elected',
                                  title: getSiblingMembershipModeLabel('elected', t),
                                  description:
                                    'Eine Rolle der verbundenen Gruppe erzeugt die Mitgliedschaft automatisch.',
                                },
                                {
                                  value: 'parliament',
                                  title: getSiblingMembershipModeLabel('parliament', t),
                                  description:
                                    'Mitgliedschaft wird indirekt aus verbundenen Gruppen mit passivem Wahlrecht abgeleitet.',
                                },
                              ].map(option => (
                                <Label
                                  key={option.value}
                                  htmlFor={`sibling-mode-${option.value}`}
                                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                    siblingMembershipMode === option.value
                                      ? 'border-primary bg-primary/5'
                                      : 'hover:bg-muted/50'
                                  }`}
                                >
                                  <RadioGroupItem
                                    value={option.value}
                                    id={`sibling-mode-${option.value}`}
                                    className="mt-0.5"
                                  />
                                  <div>
                                    <div className="text-sm font-medium">{option.title}</div>
                                    <div className="text-muted-foreground text-xs">
                                      {option.description}
                                    </div>
                                  </div>
                                </Label>
                              ))}
                            </div>
                          </RadioGroup>
                        </div>

                        {siblingMembershipMode === 'elected' ? (
                          <CreateTypeaheadField
                            label="Verbundene Rolle"
                            required
                            items={toTypeaheadItems(
                              selectableConnectedRoles,
                              'role',
                              role => role.name || 'Role',
                              role => role.description || undefined
                            )}
                            value={connectedRoleId || undefined}
                            onChange={item => setConnectedRoleId(item?.id ?? '')}
                            placeholder="Mitgliedsrolle der verbundenen Gruppe waehlen"
                            showAllOnFocus
                          />
                        ) : null}
                      </>
                    ) : null}

                    <GroupRelationshipRightsSelector
                      label={t('pages.create.group.selectRights')}
                      helperText={t('common.network.existingRightsStatusHint')}
                      selectedRights={selectedLinkRights}
                      onToggleRight={right =>
                        setLinkRightDirections(currentDirections =>
                          toggleRightDirection(currentDirections, right)
                        )
                      }
                      existingRightStatuses={existingRightStatuses}
                      rightDirections={linkRightDirections}
                      onDirectionChange={(right, direction) =>
                        setLinkRightDirections(currentDirections => ({
                          ...currentDirections,
                          [right]: direction,
                        }))
                      }
                      directionOptions={relationshipDirectionOptions}
                      currentGroupName={name}
                      selectedGroupName={selectedLinkedGroupName}
                      currentGroupId={groupId}
                      selectedGroupId={linkGroupId || undefined}
                    />
                  </>
                ) : null}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddLinkedGroup}
                    disabled={
                      !linkGroupId ||
                      !hasSelectedRights(linkRightDirections) ||
                      (linkType === 'sibling' &&
                        siblingMembershipMode === 'elected' &&
                        !connectedRoleId)
                    }
                  >
                    <Link2 className="mr-1 h-4 w-4" />
                    {linkType === 'sibling'
                      ? 'Geschwistergruppe konfigurieren'
                      : t('pages.create.group.addGroupLink')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLinkGroupId('');
                      setLinkRightDirections(createInitialRelationshipDirections());
                      setSiblingMembershipMode('open');
                      setConnectedRoleId('');
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>

              {configuredConnectedGroup ? (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    Verbundene Geschwistergruppe
                  </Label>
                  <div className="flex items-start gap-3 rounded-md border p-3">
                    <div className="flex flex-col gap-1">
                      <Badge
                        className={cn(
                          'border text-xs hover:opacity-100',
                          getRelationshipBadgeClasses('sibling')
                        )}
                      >
                        {t('common.network.sibling', 'Geschwistergruppe')}
                      </Badge>
                      <Badge className="border-muted bg-muted/50 text-foreground text-xs hover:opacity-100">
                        {getSiblingMembershipModeLabel(configuredConnectedGroup.membershipMode, t)}
                      </Badge>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="space-y-1">
                        <span className="block text-sm font-medium">
                          {configuredConnectedGroup.groupName}
                        </span>
                        <p className="text-muted-foreground text-xs">
                          {getCurrentGroupRelationshipLabel({
                            relationshipType: 'sibling',
                            currentGroupName: name,
                            selectedGroupName: configuredConnectedGroup.groupName,
                            siblingMembershipMode: configuredConnectedGroup.membershipMode,
                            t,
                          })}
                        </p>
                      </div>
                      <GroupRelationshipRightSentenceList
                        rights={connectedGroupRights}
                        rightDirections={configuredConnectedGroup.rightDirections}
                        currentGroupName={name}
                        selectedGroupName={configuredConnectedGroup.groupName}
                        currentGroupId={groupId}
                        selectedGroupId={configuredConnectedGroup.groupId}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleRemoveConfiguredConnectedGroup}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : null}

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
                          : t('pages.create.group.child')}
                      </Badge>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="space-y-1">
                          <span className="block text-sm font-medium">{linkedGroup.groupName}</span>
                          <p className="text-muted-foreground text-xs">
                            {getCurrentGroupRelationshipLabel({
                              relationshipType: linkedGroup.type,
                              currentGroupName: name,
                              selectedGroupName: linkedGroup.groupName,
                              siblingMembershipMode: linkedGroup.siblingMembershipMode,
                              t,
                            })}
                          </p>
                        </div>
                        <GroupRelationshipRightSentenceList
                          rights={linkedGroup.rights}
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
                    ...(resolvedGroupType === 'sibling' && configuredConnectedGroupName
                      ? [
                          { label: 'Verbundene Gruppe', value: configuredConnectedGroupName },
                          {
                            label: 'Mitgliedschaftsmodus',
                            value: getSiblingMembershipModeLabel(
                              configuredConnectedGroup?.membershipMode ??
                                effectiveSiblingMembershipMode,
                              t
                            ),
                          },
                          ...(connectedGroupRights.length > 0
                            ? [
                                {
                                  label: 'Rechte',
                                  value: configuredConnectedGroup ? (
                                    <GroupRelationshipRightSentenceList
                                      rights={connectedGroupRights}
                                      rightDirections={configuredConnectedGroup.rightDirections}
                                      currentGroupName={name}
                                      selectedGroupName={configuredConnectedGroup.groupName}
                                      currentGroupId={groupId}
                                      selectedGroupId={configuredConnectedGroup.groupId}
                                    />
                                  ) : null,
                                },
                              ]
                            : []),
                        ]
                      : []),
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
      connectedGroupId,
      configuredConnectedGroup,
      configuredConnectedGroupName,
      connectedGroupRights,
      effectiveSiblingMembershipMode,
      siblingMembershipMode,
      connectedRoleId,
      siblingRelationshipDirections,
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
      allowGuestInvites,
      allowOfficialMemberInvites,
      selectedLinkRights,
      selectedConnectedRights,
      configuredConnectedRights,
      selectableConnectedGroups,
      selectableConnectedRoles,
      selectableLinkGroups,
      selectedLinkedGroupName,
      showConnectedGroupComposer,
      showSiblingLinkComposer,
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
      handleAddConfiguredConnectedGroup,
      handleRemoveConfiguredConnectedGroup,
      resetConnectedGroupComposer,
      resetSiblingLinkComposer,
      emailIsValid,
      emailValidationMessage,
      user,
    ]
  );

  return config;
}
