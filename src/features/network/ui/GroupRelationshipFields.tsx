import {
  getEntityToneClasses,
  getRightToneClasses,
  getSemanticToneClasses,
} from '@/features/shared/theme';
import { RoleTag } from '@/features/groups/ui/RoleTag';
import {
  BadgeControl,
  TOKEN_BADGE_FILTER_HOVER_CLASSES,
  type RightType,
} from '@/features/shared/ui/status';
import {
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
} from '@/features/shared/ui/form';
import { Check } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/features/shared/ui/ui/button';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import {
  getSiblingMembershipModeLabel,
  getGroupRelationshipNameText,
  getGroupRelationshipRightSentenceText,
  getSiblingRelationshipPhraseText,
  type SiblingMembershipMode,
  type TranslateFn,
} from '../logic/groupRelationshipSentence';
import { getCanonicalMembershipModeLabel } from '../logic/groupConnectionDerived';
import type { GroupRelationshipRightDisplayStatus } from '../logic/networkRelationshipHelpers';
import type {
  CanonicalMembershipMode,
  GroupRelationshipDirection,
  GroupRelationshipType,
  RelativeMembershipDirection,
} from '../types/network.types';

export type GroupRelationshipRight = RightType;
export type GroupRelationshipPhraseMode = 'selection' | 'statement' | 'role';
export type GroupRelationshipTagCase = 'sentence-start' | 'embedded';
export type GroupRelationshipTagDisplayMode = 'contextual' | 'name-only';
type SelectableGroupRelationshipDirection = Exclude<GroupRelationshipDirection, 'none'>;
export interface GroupRelationshipDirectionOption {
  value: SelectableGroupRelationshipDirection;
  label: string;
}

const GROUP_RELATIONSHIP_RIGHT_OPTIONS: {
  value: GroupRelationshipRight;
  labelKey: string;
  descKey: string;
}[] = [
  {
    value: 'informationRight',
    labelKey: 'common.network.rightInfo',
    descKey: 'common.network.rightInfoDesc',
  },
  {
    value: 'amendmentRight',
    labelKey: 'common.network.rightAmendment',
    descKey: 'common.network.rightAmendmentDesc',
  },
  {
    value: 'rightToSpeak',
    labelKey: 'common.network.rightSpeak',
    descKey: 'common.network.rightSpeakDesc',
  },
  {
    value: 'activeVotingRight',
    labelKey: 'common.network.rightActiveVoting',
    descKey: 'common.network.rightActiveVotingDesc',
  },
  {
    value: 'passiveVotingRight',
    labelKey: 'common.network.rightPassiveVoting',
    descKey: 'common.network.rightPassiveVotingDesc',
  },
];

export function getGroupRelationshipDirectionOptions(
  t: TranslateFn
): GroupRelationshipDirectionOption[] {
  return [
    {
      value: 'current_grants_right_to_partner',
      label: t('common.network.directionOutgoingLabel'),
    },
    {
      value: 'partner_grants_right_to_current',
      label: t('common.network.directionIncomingLabel'),
    },
    {
      value: 'mutual',
      label: t('common.network.directionBidirectionalLabel'),
    },
  ];
}

export function invertGroupRelationshipType(
  relationshipType: GroupRelationshipType
): GroupRelationshipType {
  if (relationshipType === 'parent') {
    return 'child';
  }

  if (relationshipType === 'child') {
    return 'parent';
  }

  return 'sibling';
}

function getSafeGroupName(name: string, fallback: string) {
  const trimmedName = name.trim();
  return trimmedName || fallback;
}

export function getCurrentGroupRelationshipLabel({
  relationshipType,
  currentGroupName,
  selectedGroupName,
  siblingMembershipMode,
  t,
}: {
  relationshipType: GroupRelationshipType;
  currentGroupName: string;
  selectedGroupName: string;
  siblingMembershipMode?: SiblingMembershipMode | null;
  t: TranslateFn;
}) {
  const safeCurrentGroupName = getSafeGroupName(currentGroupName, t('common.network.thisGroup'));
  const safeSelectedGroupName = getSafeGroupName(selectedGroupName, t('common.unspecified'));

  if (relationshipType === 'parent') {
    return t('common.network.currentGroupAsParentOf', {
      currentGroupName: safeCurrentGroupName,
      selectedGroupName: safeSelectedGroupName,
    });
  }

  if (relationshipType === 'child') {
    return t('common.network.currentGroupAsChildOf', {
      currentGroupName: safeCurrentGroupName,
      selectedGroupName: safeSelectedGroupName,
    });
  }

  return getSiblingRelationshipPhraseText({
    mode: 'sentence',
    siblingMembershipMode,
    currentGroupName: safeCurrentGroupName,
    selectedGroupName: safeSelectedGroupName,
    t,
  });
}

export function getGroupRelationshipTypeLabel(
  relationshipType: GroupRelationshipType,
  t: TranslateFn
) {
  if (relationshipType === 'parent') {
    return t('common.network.parent');
  }

  if (relationshipType === 'child') {
    return t('common.network.child');
  }

  return t('common.network.sibling');
}

export function getGroupRelationshipRightLabel(right: GroupRelationshipRight, t: TranslateFn) {
  const option = GROUP_RELATIONSHIP_RIGHT_OPTIONS.find(entry => entry.value === right);
  return option ? t(option.labelKey) : right;
}

function getStatusBadgeLabel(status: string, t: TranslateFn) {
  switch (status) {
    case 'accepted':
      return t('common.network.acceptedStatus');
    case 'incoming':
      return t('common.network.incomingRequest');
    case 'outgoing':
      return t('common.network.outgoingRequest');
    default:
      return status;
  }
}

function isRequestDisplayStatus(status: string) {
  return status === 'incoming' || status === 'outgoing';
}

function getRelationshipConnectorLabel(
  relationshipType: GroupRelationshipType,
  t: TranslateFn,
  mode: GroupRelationshipPhraseMode = 'selection',
  siblingMembershipMode?: SiblingMembershipMode | null
) {
  if (mode === 'statement') {
    if (relationshipType === 'parent') {
      return t('common.network.isParentGroupOf');
    }

    if (relationshipType === 'child') {
      return t('common.network.isChildGroupOf');
    }

    return getSiblingRelationshipPhraseText({
      mode: 'statement',
      siblingMembershipMode,
      t,
    });
  }

  if (mode === 'role') {
    if (relationshipType === 'parent') {
      return t('common.network.parentGroupOf');
    }

    if (relationshipType === 'child') {
      return t('common.network.childGroupOf');
    }

    return getSiblingRelationshipPhraseText({
      mode: 'role',
      siblingMembershipMode,
      t,
    });
  }

  if (relationshipType === 'parent') {
    return t('common.network.asParentGroupOf');
  }

  if (relationshipType === 'child') {
    return t('common.network.asChildGroupOf');
  }

  return getSiblingRelationshipPhraseText({
    mode: 'selection',
    siblingMembershipMode,
    t,
  });
}

function getRelationshipConnectorClasses(relationshipType: GroupRelationshipType) {
  if (relationshipType === 'parent') {
    return cn(getSemanticToneClasses('warning').badge, TOKEN_BADGE_FILTER_HOVER_CLASSES);
  }

  if (relationshipType === 'child') {
    return cn(getSemanticToneClasses('info').badge, TOKEN_BADGE_FILTER_HOVER_CLASSES);
  }

  return cn(getSemanticToneClasses('accent').badge, TOKEN_BADGE_FILTER_HOVER_CLASSES);
}

function getGroupTagClasses(kind: 'current' | 'selected') {
  return cn(
    getEntityToneClasses('group').badge,
    TOKEN_BADGE_FILTER_HOVER_CLASSES,
    kind === 'current' && 'ring-1 ring-[var(--entity-group-ring)]'
  );
}

export function GroupRelationshipNameTag({
  name,
  kind,
  caseStyle = 'sentence-start',
  groupId,
  displayMode = 'contextual',
  linkGroups = true,
}: {
  name: string;
  kind: 'current' | 'selected';
  caseStyle?: GroupRelationshipTagCase;
  groupId?: string;
  displayMode?: GroupRelationshipTagDisplayMode;
  linkGroups?: boolean;
}) {
  const { t } = useTranslation();
  const fallback =
    kind === 'current'
      ? caseStyle === 'embedded'
        ? t('common.network.thisGroupEmbedded')
        : t('common.network.thisGroup')
      : t('common.network.selectedPartnerGroup', 'Gewählte Partnergruppe');
  const safeName = getSafeGroupName(name, fallback);
  const displayName =
    displayMode === 'name-only'
      ? safeName
      : getGroupRelationshipNameText({
          name,
          kind,
          caseStyle,
          t,
        });

  const badge = (
    <BadgeControl
      variant="outline"
      className={cn('max-w-full text-[11px] font-semibold', getGroupTagClasses(kind))}
    >
      <span className="truncate">{displayName}</span>
    </BadgeControl>
  );

  if (!groupId || !linkGroups) {
    return badge;
  }

  return (
    <Link
      to="/group/$id"
      params={{ id: groupId }}
      className="focus-visible:ring-ring inline-flex max-w-full rounded-md transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {badge}
    </Link>
  );
}

export function GroupRelationshipConnector({
  relationshipType,
  mode = 'selection',
  siblingMembershipMode,
  className,
}: {
  relationshipType: GroupRelationshipType;
  mode?: GroupRelationshipPhraseMode;
  siblingMembershipMode?: SiblingMembershipMode | null;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <BadgeControl
      variant="outline"
      className={cn(
        'max-w-full text-[11px] font-medium',
        getRelationshipConnectorClasses(relationshipType),
        className
      )}
    >
      {getRelationshipConnectorLabel(relationshipType, t, mode, siblingMembershipMode)}
    </BadgeControl>
  );
}

export function GroupRelationshipTypePreview({
  relationshipType,
  currentGroupName,
  selectedGroupName,
  siblingMembershipMode,
  currentGroupId,
  selectedGroupId,
  linkGroups = true,
}: {
  relationshipType: GroupRelationshipType;
  currentGroupName: string;
  selectedGroupName: string;
  siblingMembershipMode?: SiblingMembershipMode | null;
  currentGroupId?: string;
  selectedGroupId?: string;
  linkGroups?: boolean;
}) {
  const { t } = useTranslation();
  const safeCurrentGroupName = getSafeGroupName(currentGroupName, t('common.network.thisGroup'));
  const safeSelectedGroupName = getSafeGroupName(selectedGroupName, t('common.unspecified'));

  return (
    <div className="flex flex-wrap items-center gap-2 leading-tight">
      <GroupRelationshipNameTag
        name={safeCurrentGroupName}
        kind="current"
        groupId={currentGroupId}
        displayMode="name-only"
        linkGroups={linkGroups}
      />
      <GroupRelationshipConnector
        relationshipType={relationshipType}
        mode="selection"
        siblingMembershipMode={siblingMembershipMode}
      />
      <GroupRelationshipNameTag
        name={safeSelectedGroupName}
        kind="selected"
        groupId={selectedGroupId}
        displayMode="name-only"
        linkGroups={linkGroups}
      />
    </div>
  );
}

function getSafeRelationshipGroupNames(args: {
  currentGroupName: string;
  selectedGroupName: string;
  t: TranslateFn;
}) {
  return {
    safeCurrentGroupName: getSafeGroupName(
      args.currentGroupName,
      args.t('common.network.thisGroup')
    ),
    safeSelectedGroupName: getSafeGroupName(args.selectedGroupName, args.t('common.unspecified')),
  };
}

export function GroupRelationshipMembershipModeDescription({
  membershipMode,
  direction,
  currentGroupName,
  selectedGroupName,
  currentGroupId,
  selectedGroupId,
  requiredSourceRoleId,
  requiredSourceRoleName,
  className,
  linkGroups = true,
}: {
  membershipMode: CanonicalMembershipMode;
  direction: RelativeMembershipDirection;
  currentGroupName: string;
  selectedGroupName: string;
  currentGroupId?: string;
  selectedGroupId?: string;
  requiredSourceRoleId?: string | null;
  requiredSourceRoleName?: string | null;
  className?: string;
  linkGroups?: boolean;
}) {
  const { t } = useTranslation();
  const { safeCurrentGroupName, safeSelectedGroupName } = getSafeRelationshipGroupNames({
    currentGroupName,
    selectedGroupName,
    t,
  });

  const currentTag = (
    <GroupRelationshipNameTag
      name={safeCurrentGroupName}
      kind="current"
      caseStyle="embedded"
      groupId={currentGroupId}
      displayMode="name-only"
      linkGroups={linkGroups}
    />
  );
  const selectedTag = (
    <GroupRelationshipNameTag
      name={safeSelectedGroupName}
      kind="selected"
      caseStyle="embedded"
      groupId={selectedGroupId}
      displayMode="name-only"
      linkGroups={linkGroups}
    />
  );

  const sourceTag = direction === 'partner_members_to_current' ? selectedTag : currentTag;
  const targetTag = direction === 'partner_members_to_current' ? currentTag : selectedTag;
  const selectedRoleLabel = t('common.network.selectedRole');

  if (membershipMode === 'all_members') {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5 leading-relaxed', className)}>
        <span>{t('common.network.addAllActiveMembersOf')}</span>
        {sourceTag}
        <span>{t('common.network.directionTo')}</span>
        {targetTag}
        <span>.</span>
      </div>
    );
  }

  if (membershipMode === 'role_members') {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5 leading-relaxed', className)}>
        <span>{t('common.network.addOnlyMembersOf')}</span>
        {sourceTag}
        <span>{t('common.network.membersWithRole')}</span>
        <RoleTag
          roleId={requiredSourceRoleId}
          roleName={requiredSourceRoleName ?? null}
          fallbackKey="membership-required-source-role"
        >
          {requiredSourceRoleName ?? selectedRoleLabel}
        </RoleTag>
        <span>{t('common.network.directionTo')}</span>
        {targetTag}
        <span>.</span>
      </div>
    );
  }

  if (membershipMode === 'selected_source_groups') {
    const targetGroupName =
      direction === 'partner_members_to_current' ? safeCurrentGroupName : safeSelectedGroupName;
    const sourceGroupName =
      direction === 'partner_members_to_current' ? safeSelectedGroupName : safeCurrentGroupName;
    const targetGroupId =
      direction === 'partner_members_to_current' ? currentGroupId : selectedGroupId;
    const sourceGroupId =
      direction === 'partner_members_to_current' ? selectedGroupId : currentGroupId;

    return (
      <SiblingMembershipModeDescription
        siblingMembershipMode="parliament"
        currentGroupName={targetGroupName}
        selectedGroupName={sourceGroupName}
        currentGroupId={targetGroupId}
        selectedGroupId={sourceGroupId}
        className={className}
        linkGroups={linkGroups}
      />
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 leading-relaxed', className)}>
      <span>{t('common.network.doNotAddMembersAutomatically')}</span>
    </div>
  );
}

export function SiblingMembershipModeDescription({
  siblingMembershipMode,
  currentGroupName,
  selectedGroupName,
  currentGroupId,
  selectedGroupId,
  className,
  linkGroups = true,
}: {
  siblingMembershipMode: SiblingMembershipMode;
  currentGroupName: string;
  selectedGroupName: string;
  currentGroupId?: string;
  selectedGroupId?: string;
  className?: string;
  linkGroups?: boolean;
}) {
  const { t } = useTranslation();
  const { safeCurrentGroupName, safeSelectedGroupName } = getSafeRelationshipGroupNames({
    currentGroupName,
    selectedGroupName,
    t,
  });
  const parliamentAfterSource = t(
    'common.network.siblingMembershipExplanationParliamentAfterSource',
    'haben.'
  );

  const currentTag = (
    <GroupRelationshipNameTag
      name={safeCurrentGroupName}
      kind="current"
      caseStyle="embedded"
      groupId={currentGroupId}
      displayMode="name-only"
      linkGroups={linkGroups}
    />
  );
  const selectedTag = (
    <GroupRelationshipNameTag
      name={safeSelectedGroupName}
      kind="selected"
      caseStyle="embedded"
      groupId={selectedGroupId}
      displayMode="name-only"
      linkGroups={linkGroups}
    />
  );

  if (siblingMembershipMode === 'open') {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5 leading-relaxed', className)}>
        <span className="text-xs">
          {t('common.network.siblingMembershipExplanationOpenBeforeSource')}
        </span>
        {selectedTag}
        <span className="text-xs">
          {t('common.network.siblingMembershipExplanationOpenBetweenGroups', 'können')}
        </span>
        {currentTag}
        <span className="text-xs">
          {t('common.network.siblingMembershipExplanationOpenAfterTarget')}
        </span>
      </div>
    );
  }

  if (siblingMembershipMode === 'elected') {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5 leading-relaxed', className)}>
        <span className="text-xs">
          {t('common.network.siblingMembershipExplanationElectedBeforeSource')}
        </span>
        {selectedTag}
        <span className="text-xs">
          {t('common.network.siblingMembershipExplanationElectedBetweenGroups')}
        </span>
        {currentTag}
        <span className="text-xs">
          {t('common.network.siblingMembershipExplanationElectedAfterTarget', 'automatisch.')}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 leading-relaxed', className)}>
      <span className="text-xs">
        {t('common.network.siblingMembershipExplanationParliamentBeforeTarget')}
      </span>
      {currentTag}
      <span className="text-xs">
        {t('common.network.siblingMembershipExplanationParliamentBetweenGroups')}
      </span>
      {selectedTag}
      <span className={cn('text-xs', /^[.,;:!?]/.test(parliamentAfterSource) && '-ml-1')}>
        {parliamentAfterSource}
      </span>
    </div>
  );
}

function RelationshipTypeOptionContent({
  relationshipType,
  selectedGroupName,
  siblingMembershipMode,
  currentGroupId,
  selectedGroupId,
  linkGroups = true,
}: {
  relationshipType: GroupRelationshipType;
  currentGroupName: string;
  selectedGroupName: string;
  siblingMembershipMode?: SiblingMembershipMode | null;
  currentGroupId?: string;
  selectedGroupId?: string;
  linkGroups?: boolean;
}) {
  const { t } = useTranslation();
  const safeSelectedGroupName = getSafeGroupName(
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
      linkGroups={linkGroups}
    />
  );

  const selectedTag = (
    <GroupRelationshipNameTag
      name={safeSelectedGroupName}
      kind="selected"
      caseStyle="embedded"
      groupId={selectedGroupId}
      displayMode="name-only"
      linkGroups={linkGroups}
    />
  );

  if (relationshipType === 'parent') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
        {currentTag}
        <span className="text-xs">{t('common.network.isParentGroupOf')}</span>
        {selectedTag}
      </div>
    );
  }

  if (relationshipType === 'child') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
        {currentTag}
        <span className="text-xs">{t('common.network.isChildGroupOf')}</span>
        {selectedTag}
      </div>
    );
  }

  const siblingType = getSiblingMembershipModeLabel(siblingMembershipMode, t);
  return (
    <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
      {currentTag}
      <span className="text-xs">{t('common.network.isConnectedWith')}</span>
      {selectedTag}
      <span className="text-xs">
        {siblingType ? `as ${siblingType.toLowerCase()} partner groups` : 'as partner groups'}
      </span>
    </div>
  );
}

interface GroupRelationshipTypeSelectProps {
  id?: string;
  label: string;
  value: GroupRelationshipType;
  currentGroupName: string;
  selectedGroupName: string;
  currentGroupId?: string;
  selectedGroupId?: string;
  siblingMembershipMode?: SiblingMembershipMode | null;
  onValueChange: (value: GroupRelationshipType) => void;
  helperText?: string;
  disabled?: boolean;
  disabledOptions?: Partial<Record<GroupRelationshipType, boolean>>;
}

export function GroupRelationshipTypeSelect({
  id = 'relationshipType',
  label,
  value,
  currentGroupName,
  selectedGroupName,
  currentGroupId,
  selectedGroupId,
  siblingMembershipMode,
  onValueChange,
  helperText,
  disabled = false,
  disabledOptions,
}: GroupRelationshipTypeSelectProps) {
  const { t } = useTranslation();
  const selectedLabel = getCurrentGroupRelationshipLabel({
    relationshipType: value,
    currentGroupName,
    selectedGroupName,
    siblingMembershipMode,
    t,
  });

  return (
    <div className="grid gap-2">
      <FormControlLabel htmlFor={id}>{label}</FormControlLabel>
      <FormControlSelect
        value={value}
        onValueChange={next => onValueChange(next as GroupRelationshipType)}
        disabled={disabled}
      >
        <FormControlSelectTrigger id={id} className="h-auto min-h-12 py-3 [&>span]:line-clamp-none">
          <div className="min-w-0 flex-1 text-left">
            <RelationshipTypeOptionContent
              relationshipType={value}
              currentGroupName={currentGroupName}
              selectedGroupName={selectedGroupName}
              siblingMembershipMode={siblingMembershipMode}
              currentGroupId={currentGroupId}
              selectedGroupId={selectedGroupId}
              linkGroups={false}
            />
            <span className="sr-only">{selectedLabel}</span>
          </div>
        </FormControlSelectTrigger>
        <FormControlSelectContent className="w-[var(--radix-select-trigger-width)] max-w-none">
          <FormControlSelectItem value="parent" disabled={disabledOptions?.parent} className="py-2">
            <RelationshipTypeOptionContent
              relationshipType="parent"
              currentGroupName={currentGroupName}
              selectedGroupName={selectedGroupName}
              currentGroupId={currentGroupId}
              selectedGroupId={selectedGroupId}
              linkGroups={false}
            />
          </FormControlSelectItem>
          <FormControlSelectItem value="child" disabled={disabledOptions?.child} className="py-2">
            <RelationshipTypeOptionContent
              relationshipType="child"
              currentGroupName={currentGroupName}
              selectedGroupName={selectedGroupName}
              currentGroupId={currentGroupId}
              selectedGroupId={selectedGroupId}
              linkGroups={false}
            />
          </FormControlSelectItem>
          <FormControlSelectItem
            value="sibling"
            disabled={disabledOptions?.sibling}
            className="py-2"
          >
            <RelationshipTypeOptionContent
              relationshipType="sibling"
              currentGroupName={currentGroupName}
              selectedGroupName={selectedGroupName}
              siblingMembershipMode={siblingMembershipMode}
              currentGroupId={currentGroupId}
              selectedGroupId={selectedGroupId}
              linkGroups={false}
            />
          </FormControlSelectItem>
        </FormControlSelectContent>
      </FormControlSelect>
      {helperText ? <p className="text-muted-foreground text-sm">{helperText}</p> : null}
    </div>
  );
}

export function GroupRelationshipTypeSummary({
  label,
  relationshipType,
  currentGroupName,
  selectedGroupName,
  siblingMembershipMode,
  currentGroupId,
  selectedGroupId,
}: {
  label: string;
  relationshipType: GroupRelationshipType;
  currentGroupName: string;
  selectedGroupName: string;
  siblingMembershipMode?: SiblingMembershipMode | null;
  currentGroupId?: string;
  selectedGroupId?: string;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="rounded-lg border p-4">
        <RelationshipTypeOptionContent
          relationshipType={relationshipType}
          currentGroupName={currentGroupName}
          selectedGroupName={selectedGroupName}
          siblingMembershipMode={siblingMembershipMode}
          currentGroupId={currentGroupId}
          selectedGroupId={selectedGroupId}
        />
      </div>
    </div>
  );
}

interface GroupRelationshipRightsSelectorProps {
  label: string;
  tutorialAnchor?: string;
  selectedRights: Set<GroupRelationshipRight>;
  onToggleRight: (right: GroupRelationshipRight) => void;
  helperText?: string;
  existingRightStatuses?: ReadonlyMap<string, GroupRelationshipRightDisplayStatus>;
  rightDirections?: Partial<Record<GroupRelationshipRight, GroupRelationshipDirection>>;
  onDirectionChange?: (
    right: GroupRelationshipRight,
    direction: GroupRelationshipDirection
  ) => void;
  directionOptions?: GroupRelationshipDirectionOption[];
  currentGroupName?: string;
  selectedGroupName?: string;
  currentGroupId?: string;
  selectedGroupId?: string;
  disabled?: boolean;
  optionsContainerClassName?: string;
}

function getRightSentenceBadgeClasses(right: GroupRelationshipRight) {
  const tone = getRightToneClasses(right);

  return cn(tone.badge, TOKEN_BADGE_FILTER_HOVER_CLASSES);
}

function RightSentenceEmphasis({ right }: { right: GroupRelationshipRight }) {
  const { t } = useTranslation();

  return (
    <BadgeControl className={cn('text-[11px]', getRightSentenceBadgeClasses(right))}>
      {getGroupRelationshipRightLabel(right, t)}
    </BadgeControl>
  );
}

export function GroupRelationshipDirectionSentence({
  direction,
  right,
  currentGroupName,
  selectedGroupName,
  currentGroupId,
  selectedGroupId,
  linkGroups = true,
}: {
  direction: SelectableGroupRelationshipDirection;
  right: GroupRelationshipRight;
  currentGroupName: string;
  selectedGroupName: string;
  currentGroupId?: string;
  selectedGroupId?: string;
  linkGroups?: boolean;
}) {
  const { t } = useTranslation();
  const safeCurrentGroupName = getSafeGroupName(currentGroupName, t('common.network.thisGroup'));
  const safeSelectedGroupName = getSafeGroupName(selectedGroupName, t('common.unspecified'));
  const srText = getGroupRelationshipRightSentenceText({
    direction,
    rightLabel: getGroupRelationshipRightLabel(right, t),
    currentGroupName: safeCurrentGroupName,
    selectedGroupName: safeSelectedGroupName,
    t,
  });

  if (direction === 'partner_grants_right_to_current') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 leading-tight">
        <GroupRelationshipNameTag
          name=""
          kind="current"
          caseStyle="sentence-start"
          groupId={currentGroupId}
          displayMode="name-only"
          linkGroups={linkGroups}
        />
        <span className="text-xs">{t('common.network.directionHas', 'has')}</span>
        <RightSentenceEmphasis right={right} />
        <span className="text-xs">{t('common.network.directionIn', 'in')}</span>
        <GroupRelationshipNameTag
          name={safeSelectedGroupName}
          kind="selected"
          caseStyle="embedded"
          groupId={selectedGroupId}
          displayMode="name-only"
          linkGroups={linkGroups}
        />
        <span className="sr-only">{srText}</span>
      </div>
    );
  }

  if (direction === 'mutual') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 leading-tight">
        <GroupRelationshipNameTag
          name=""
          kind="current"
          caseStyle="sentence-start"
          groupId={currentGroupId}
          displayMode="name-only"
          linkGroups={linkGroups}
        />
        <span className="text-xs">{t('common.network.directionAnd', 'and')}</span>
        <GroupRelationshipNameTag
          name={safeSelectedGroupName}
          kind="selected"
          caseStyle="embedded"
          groupId={selectedGroupId}
          displayMode="name-only"
          linkGroups={linkGroups}
        />
        <span className="text-xs">
          {t('common.network.directionHaveMutually', 'give each other')}
        </span>
        <RightSentenceEmphasis right={right} />
        <span className="sr-only">{srText}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 leading-tight">
      <GroupRelationshipNameTag
        name=""
        kind="current"
        caseStyle="sentence-start"
        groupId={currentGroupId}
        displayMode="name-only"
        linkGroups={linkGroups}
      />
      <span className="text-xs">{t('common.network.directionGrants', 'gives')}</span>
      <RightSentenceEmphasis right={right} />
      <span className="text-xs">{t('common.network.directionTo', 'to')}</span>
      <GroupRelationshipNameTag
        name={safeSelectedGroupName}
        kind="selected"
        caseStyle="embedded"
        groupId={selectedGroupId}
        displayMode="name-only"
        linkGroups={linkGroups}
      />
      <span className="sr-only">{srText}</span>
    </div>
  );
}

export function GroupRelationshipRightSentenceList({
  rights,
  rightDirections,
  currentGroupName,
  selectedGroupName,
  currentGroupId,
  selectedGroupId,
  className,
  itemClassName,
  linkGroups = true,
}: {
  rights?: GroupRelationshipRight[];
  rightDirections?: Partial<Record<GroupRelationshipRight, GroupRelationshipDirection>>;
  currentGroupName: string;
  selectedGroupName: string;
  currentGroupId?: string;
  selectedGroupId?: string;
  className?: string;
  itemClassName?: string;
  linkGroups?: boolean;
}) {
  const safeRights = rights ?? [];
  const safeRightDirections = rightDirections ?? {};

  const items = safeRights.flatMap(right => {
    const direction = safeRightDirections[right];

    if (!direction || direction === 'none') {
      return [];
    }

    return [{ right, direction }];
  });

  if (!items.length) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {items.map(item => (
        <div
          key={item.right}
          className={cn(
            'border-border/70 bg-background/80 rounded-lg border px-3 py-2 shadow-sm',
            itemClassName
          )}
        >
          <GroupRelationshipDirectionSentence
            direction={item.direction}
            right={item.right}
            currentGroupName={currentGroupName}
            selectedGroupName={selectedGroupName}
            currentGroupId={currentGroupId}
            selectedGroupId={selectedGroupId}
            linkGroups={linkGroups}
          />
        </div>
      ))}
    </div>
  );
}

export function GroupRelationshipMembershipModeSummary({
  label,
  membershipMode,
  membershipDirection,
  currentGroupName,
  selectedGroupName,
  currentGroupId,
  selectedGroupId,
  membershipSourceGroupName,
  membershipTargetGroupName,
  membershipSourceGroupId,
  membershipTargetGroupId,
  requiredSourceRoleId,
  requiredSourceRoleName,
}: {
  label: string;
  membershipMode: 'none' | 'all_members' | 'role_members' | 'selected_source_groups';
  membershipDirection?: RelativeMembershipDirection | null;
  currentGroupName: string;
  selectedGroupName: string;
  currentGroupId?: string;
  selectedGroupId?: string;
  membershipSourceGroupName?: string | null;
  membershipTargetGroupName?: string | null;
  membershipSourceGroupId?: string | null;
  membershipTargetGroupId?: string | null;
  requiredSourceRoleId?: string | null;
  requiredSourceRoleName?: string | null;
}) {
  const hasCanonicalMembershipEndpoints =
    Boolean(membershipSourceGroupName || membershipSourceGroupId) &&
    Boolean(membershipTargetGroupName || membershipTargetGroupId);
  const descriptionDirection = hasCanonicalMembershipEndpoints
    ? 'current_members_to_partner'
    : membershipDirection;
  const descriptionCurrentGroupName = hasCanonicalMembershipEndpoints
    ? (membershipSourceGroupName ?? membershipSourceGroupId ?? currentGroupName)
    : currentGroupName;
  const descriptionSelectedGroupName = hasCanonicalMembershipEndpoints
    ? (membershipTargetGroupName ?? membershipTargetGroupId ?? selectedGroupName)
    : selectedGroupName;
  const descriptionCurrentGroupId = hasCanonicalMembershipEndpoints
    ? (membershipSourceGroupId ?? undefined)
    : currentGroupId;
  const descriptionSelectedGroupId = hasCanonicalMembershipEndpoints
    ? (membershipTargetGroupId ?? undefined)
    : selectedGroupId;

  return (
    <div className="rounded-lg border p-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <p className="text-lg font-semibold">{getCanonicalMembershipModeLabel(membershipMode)}</p>
        {descriptionDirection ? (
          <div className="text-muted-foreground text-sm">
            <GroupRelationshipMembershipModeDescription
              membershipMode={membershipMode}
              direction={descriptionDirection}
              currentGroupName={descriptionCurrentGroupName}
              selectedGroupName={descriptionSelectedGroupName}
              currentGroupId={descriptionCurrentGroupId}
              selectedGroupId={descriptionSelectedGroupId}
              requiredSourceRoleId={requiredSourceRoleId}
              requiredSourceRoleName={requiredSourceRoleName}
              className="text-sm"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GroupRelationshipRightsSummary({
  label,
  selectedRights,
  helperText,
  existingRightStatuses,
  rightDirections,
  currentGroupName,
  selectedGroupName,
  currentGroupId,
  selectedGroupId,
  optionsContainerClassName,
}: {
  label: string;
  selectedRights: readonly GroupRelationshipRight[];
  helperText?: string;
  existingRightStatuses?: ReadonlyMap<string, GroupRelationshipRightDisplayStatus>;
  rightDirections?: Partial<Record<GroupRelationshipRight, GroupRelationshipDirection>>;
  currentGroupName: string;
  selectedGroupName: string;
  currentGroupId?: string;
  selectedGroupId?: string;
  optionsContainerClassName?: string;
}) {
  const { t } = useTranslation();
  const visibleOptions = GROUP_RELATIONSHIP_RIGHT_OPTIONS.filter(option =>
    selectedRights.includes(option.value)
  );

  if (visibleOptions.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {helperText ? <p className="text-muted-foreground text-sm">{helperText}</p> : null}
      </div>
      <div className={cn('grid gap-2', optionsContainerClassName)}>
        {visibleOptions.map(option => {
          const status = existingRightStatuses?.get(option.value);
          const configuredDirection = rightDirections?.[option.value];
          const direction: SelectableGroupRelationshipDirection =
            configuredDirection && configuredDirection !== 'none'
              ? configuredDirection
              : 'current_grants_right_to_partner';

          return (
            <div key={option.value} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{t(option.labelKey)}</div>
                  <div className="text-muted-foreground text-sm">{t(option.descKey)}</div>
                </div>
                {status ? (
                  <BadgeControl
                    variant={isRequestDisplayStatus(status) ? 'secondary' : 'default'}
                    className="shrink-0"
                  >
                    {getStatusBadgeLabel(status, t)}
                  </BadgeControl>
                ) : null}
              </div>
              <div className="mt-3 rounded-md border px-3 py-2">
                <GroupRelationshipDirectionSentence
                  direction={direction}
                  right={option.value}
                  currentGroupName={currentGroupName}
                  selectedGroupName={selectedGroupName}
                  currentGroupId={currentGroupId}
                  selectedGroupId={selectedGroupId}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GroupRelationshipRightsSelector({
  label,
  tutorialAnchor,
  selectedRights,
  onToggleRight,
  helperText,
  existingRightStatuses,
  rightDirections,
  onDirectionChange,
  directionOptions,
  currentGroupName,
  selectedGroupName,
  currentGroupId,
  selectedGroupId,
  disabled = false,
  optionsContainerClassName,
}: GroupRelationshipRightsSelectorProps) {
  const { t } = useTranslation();
  const sentenceCurrentGroupName = currentGroupName ?? '';
  const sentenceSelectedGroupName = selectedGroupName ?? '';

  return (
    <div className="grid gap-3" data-tutorial-anchor={tutorialAnchor}>
      <div className="space-y-1">
        <FormControlLabel>{label}</FormControlLabel>
        {helperText ? <p className="text-muted-foreground text-sm">{helperText}</p> : null}
      </div>
      <div className={cn('grid gap-2', optionsContainerClassName)}>
        {GROUP_RELATIONSHIP_RIGHT_OPTIONS.map(option => {
          const isSelected = selectedRights.has(option.value);
          const status = existingRightStatuses?.get(option.value);
          const configuredDirection = rightDirections?.[option.value];
          const selectedDirection: SelectableGroupRelationshipDirection =
            configuredDirection && configuredDirection !== 'none'
              ? configuredDirection
              : 'current_grants_right_to_partner';

          return (
            <div
              key={option.value}
              className={cn(
                'rounded-lg border p-3 transition-colors',
                isSelected
                  ? cn(getRightToneClasses(option.value).surface, 'shadow-sm')
                  : 'border-border bg-muted/20',
                !disabled && (isSelected ? 'hover:shadow-md' : 'hover:bg-accent')
              )}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => onToggleRight(option.value)}
                className="h-auto w-full items-start justify-start p-0 text-left whitespace-normal hover:bg-transparent disabled:opacity-100"
                disabled={disabled}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                    isSelected
                      ? cn(getRightToneClasses(option.value).badge, 'shadow-sm')
                      : 'border-muted-foreground'
                  )}
                >
                  {isSelected ? <Check className="h-3 w-3" /> : null}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium">{t(option.labelKey)}</div>
                    {status ? (
                      <BadgeControl
                        variant={isRequestDisplayStatus(status) ? 'secondary' : 'default'}
                        className="shrink-0"
                      >
                        {getStatusBadgeLabel(status, t)}
                      </BadgeControl>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground text-sm">{t(option.descKey)}</div>
                </div>
              </Button>
              {isSelected && onDirectionChange && directionOptions ? (
                <div
                  className={cn(
                    'mt-3 ml-8 rounded-md border px-3 py-2',
                    isSelected ? 'border-border/70 bg-background/80' : 'border-border bg-background'
                  )}
                >
                  <FormControlSelect
                    value={selectedDirection}
                    onValueChange={value =>
                      onDirectionChange(option.value, value as GroupRelationshipDirection)
                    }
                    disabled={disabled}
                  >
                    <FormControlSelectTrigger className="border-border bg-background/80 h-auto min-h-10 py-2 text-left shadow-none">
                      <div className="min-w-0 flex-1 text-left">
                        <GroupRelationshipDirectionSentence
                          direction={selectedDirection}
                          right={option.value}
                          currentGroupName={sentenceCurrentGroupName}
                          selectedGroupName={sentenceSelectedGroupName}
                          currentGroupId={currentGroupId}
                          selectedGroupId={selectedGroupId}
                          linkGroups={false}
                        />
                        <span className="sr-only">
                          {getGroupRelationshipRightSentenceText({
                            direction: selectedDirection,
                            rightLabel: getGroupRelationshipRightLabel(option.value, t),
                            currentGroupName: sentenceCurrentGroupName,
                            selectedGroupName: sentenceSelectedGroupName,
                            t,
                          })}
                        </span>
                      </div>
                    </FormControlSelectTrigger>
                    <FormControlSelectContent
                      data-tutorial-overlay-allowed
                      className="z-[2147483150]"
                    >
                      {directionOptions.map(directionOption => (
                        <FormControlSelectItem
                          key={directionOption.value}
                          value={directionOption.value}
                        >
                          <GroupRelationshipDirectionSentence
                            direction={directionOption.value}
                            right={option.value}
                            currentGroupName={sentenceCurrentGroupName}
                            selectedGroupName={sentenceSelectedGroupName}
                            currentGroupId={currentGroupId}
                            selectedGroupId={selectedGroupId}
                            linkGroups={false}
                          />
                        </FormControlSelectItem>
                      ))}
                    </FormControlSelectContent>
                  </FormControlSelect>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
