import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
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
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
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
import { RIGHT_GRADIENTS, type RightType } from '@/features/shared/ui/status';

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
      value: 'current_has_right_in_partner',
      label: t('common.network.directionOutgoingLabel'),
    },
    {
      value: 'partner_has_right_in_current',
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
    return featureThemeClassName('networkGroupRelationshipFieldsDangerWarningGradientSurface');
  }

  if (relationshipType === 'child') {
    return featureThemeClassName('networkGroupRelationshipFieldsInfoAccentGradientSurface');
  }

  return featureThemeClassName('networkGroupRelationshipFieldsWarningAccentGradientSurface');
}

function getGroupTagClasses(kind: 'current' | 'selected') {
  return kind === 'current'
    ? [
        featureThemeClassName('networkGroupRelationshipFieldsSuccessInfoGradientSurface'),
        featureThemeClassName('networkGroupRelationshipFieldsSuccessInfoGradientSurfaceAlpha'),
        featureThemeClassName('networkGroupRelationshipFieldsSuccessInfoGradientSurfaceBeta'),
        featureThemeClassName('networkGroupRelationshipFieldsSuccessInfoGradientSurfaceGamma'),
      ].join(' ')
    : [
        featureThemeClassName('networkGroupRelationshipFieldsInfoAccentGradientSurfaceAlpha'),
        featureThemeClassName('networkGroupRelationshipFieldsInfoAccentGradientSurfaceBeta'),
        featureThemeClassName('networkGroupRelationshipFieldsInfoAccentGradientSurfaceGamma'),
        featureThemeClassName('networkGroupRelationshipFieldsInfoAccentGradientSurfaceDelta'),
      ].join(' ');
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
        ? 'diese Gruppe'
        : 'Diese Gruppe'
      : 'andere Gruppe';
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
      className={cn(
        translateText('generated.inline.0116_max_w_full_text_11px_font_semibold_c328bdd2'),
        getGroupTagClasses(kind)
      )}
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
      className="focus-visible:ring-ring inline-flex max-w-full rounded-full transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
    <span
      className={cn(
        featureThemeClassName('networkGroupRelationshipFieldsThemedGradientSurface'),
        getRelationshipConnectorClasses(relationshipType),
        className
      )}
    >
      {getRelationshipConnectorLabel(relationshipType, t, mode, siblingMembershipMode)}
    </span>
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
  className,
  linkGroups = true,
}: {
  membershipMode: CanonicalMembershipMode;
  direction: RelativeMembershipDirection;
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

  if (membershipMode === 'all_members') {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5 leading-relaxed', className)}>
        <span>{translateText('generated.inline.0788_alle_aktiven_mitglieder_von_f860cd6f')}</span>
        {sourceTag}
        <span>{translateText('generated.inline.0789_werden_in_96b98a79')}</span>
        {targetTag}
        <span>{translateText('generated.inline.0790_bernommen_edf81839')}</span>
      </div>
    );
  }

  if (membershipMode === 'role_members') {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5 leading-relaxed', className)}>
        <span>
          {translateText(
            'generated.inline.0791_nur_mitglieder_mit_der_gew_hlten_rolle_in_82006765'
          )}
        </span>
        {sourceTag}
        <span>{translateText('generated.inline.0789_werden_in_96b98a79')}</span>
        {targetTag}
        <span>{translateText('generated.inline.0790_bernommen_edf81839')}</span>
      </div>
    );
  }

  if (membershipMode === 'selected_source_groups') {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5 leading-relaxed', className)}>
        <span>
          {translateText(
            'generated.inline.0792_nur_mitglieder_aus_den_gew_hlten_source_grupp_b86ab3d3'
          )}
        </span>
        {sourceTag}
        <span>{translateText('generated.inline.0789_werden_in_96b98a79')}</span>
        {targetTag}
        <span>{translateText('generated.inline.0790_bernommen_edf81839')}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 leading-relaxed', className)}>
      <span>{translateText('generated.inline.0793_mitglieder_von_1bf6d7fb')}</span>
      {sourceTag}
      <span>{translateText('generated.inline.0794_werden_nicht_automatisch_in_7bcc7b9c')}</span>
      {targetTag}
      <span>{translateText('generated.inline.0790_bernommen_edf81839')}</span>
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
          {t('common.network.siblingMembershipExplanationOpenBetweenGroups', 'koennen')}
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
  const safeCurrentGroupName = getSafeGroupName(currentGroupName, 'diese Gruppe');
  const safeSelectedGroupName = getSafeGroupName(selectedGroupName, 'Partnergruppe');

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

  if (relationshipType === 'parent') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
        <span className="text-xs">
          {translateText('generated.inline.0772_die_aktuelle_gruppe_d7fbaf59')}
        </span>
        {currentTag}
        <span className="text-xs">
          {translateText(
            'generated.inline.0773_ist_bergeordnet_die_gew_hlte_partnergruppe_4d9d2a93'
          )}
        </span>
        {selectedTag}
        <span className="text-xs">
          {translateText('generated.inline.0771_ist_untergeordnet_9610f87b')}
        </span>
      </div>
    );
  }

  if (relationshipType === 'child') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
        <span className="text-xs">
          {translateText('generated.inline.0795_die_gew_hlte_partnergruppe_1a260d6d')}
        </span>
        {selectedTag}
        <span className="text-xs">
          {translateText('generated.inline.0770_ist_bergeordnet_die_aktuelle_gruppe_36b12d80')}
        </span>
        {currentTag}
        <span className="text-xs">
          {translateText('generated.inline.0771_ist_untergeordnet_9610f87b')}
        </span>
      </div>
    );
  }

  const siblingType = getSiblingMembershipModeLabel(siblingMembershipMode, t);
  return (
    <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
      <span className="text-xs">
        {translateText('generated.inline.0772_die_aktuelle_gruppe_d7fbaf59')}
      </span>
      {currentTag}
      <span className="text-xs">
        {translateText('generated.inline.0774_und_die_gew_hlte_partnergruppe_a51207fb')}
      </span>
      {selectedTag}
      <span className="text-xs">
        {translateText('generated.inline.0117_sind_7377a06f')}
        {siblingType ? ` ${siblingType.toLowerCase()}` : ''}
        {translateText('generated.inline.0796_geschwistergruppen_7f9c060b')}
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

function getRightUnderlineClasses(right: GroupRelationshipRight) {
  switch (right) {
    case 'informationRight':
      return featureThemeClassName('networkGroupRelationshipFieldsInfoGradientSurface');
    case 'amendmentRight':
      return featureThemeClassName(
        'networkGroupRelationshipFieldsDangerWarningGradientSurfaceAlpha'
      );
    case 'rightToSpeak':
      return featureThemeClassName('networkGroupRelationshipFieldsDangerAccentGradientSurface');
    case 'activeVotingRight':
      return featureThemeClassName('networkGroupRelationshipFieldsSuccessInfoGradientSurfaceDelta');
    case 'passiveVotingRight':
      return featureThemeClassName(
        'networkGroupRelationshipFieldsInfoAccentGradientSurfaceEpsilon'
      );
    default:
      return 'from-foreground to-foreground decoration-foreground/80';
  }
}

function RightSentenceEmphasis({ right }: { right: GroupRelationshipRight }) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        featureThemeClassName('networkGroupRelationshipFieldsThemedGradientSurface'),
        getRightUnderlineClasses(right)
      )}
    >
      {getGroupRelationshipRightLabel(right, t)}
    </span>
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

  if (direction === 'partner_has_right_in_current') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 leading-tight">
        <GroupRelationshipNameTag
          name={safeSelectedGroupName}
          kind="selected"
          caseStyle="sentence-start"
          groupId={selectedGroupId}
          displayMode="name-only"
          linkGroups={linkGroups}
        />
        <span className="text-xs">{t('common.network.directionHas')}</span>
        <RightSentenceEmphasis right={right} />
        <span className="text-xs">{t('common.network.directionIn')}</span>
        <GroupRelationshipNameTag
          name={safeCurrentGroupName}
          kind="current"
          caseStyle="embedded"
          groupId={currentGroupId}
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
          name={safeCurrentGroupName}
          kind="current"
          caseStyle="sentence-start"
          groupId={currentGroupId}
          displayMode="name-only"
          linkGroups={linkGroups}
        />
        <span className="text-xs">{t('common.network.directionAnd')}</span>
        <GroupRelationshipNameTag
          name={safeSelectedGroupName}
          kind="selected"
          caseStyle="embedded"
          groupId={selectedGroupId}
          displayMode="name-only"
          linkGroups={linkGroups}
        />
        <span className="text-xs">{t('common.network.directionHaveMutually')}</span>
        <RightSentenceEmphasis right={right} />
        <span className="sr-only">{srText}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 leading-tight">
      <GroupRelationshipNameTag
        name={safeCurrentGroupName}
        kind="current"
        caseStyle="sentence-start"
        groupId={currentGroupId}
        displayMode="name-only"
        linkGroups={linkGroups}
      />
      <span className="text-xs">{t('common.network.directionHas')}</span>
      <RightSentenceEmphasis right={right} />
      <span className="text-xs">{t('common.network.directionIn')}</span>
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
}: {
  label: string;
  membershipMode: 'none' | 'all_members' | 'role_members' | 'selected_source_groups';
  membershipDirection?: RelativeMembershipDirection | null;
  currentGroupName: string;
  selectedGroupName: string;
  currentGroupId?: string;
  selectedGroupId?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <p className="text-lg font-semibold">{getCanonicalMembershipModeLabel(membershipMode)}</p>
        {membershipDirection ? (
          <div className="text-muted-foreground text-sm">
            <GroupRelationshipMembershipModeDescription
              membershipMode={membershipMode}
              direction={membershipDirection}
              currentGroupName={currentGroupName}
              selectedGroupName={selectedGroupName}
              currentGroupId={currentGroupId}
              selectedGroupId={selectedGroupId}
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
              : 'current_has_right_in_partner';

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
    <div className="grid gap-3">
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
              : 'current_has_right_in_partner';

          return (
            <div
              key={option.value}
              className={cn(
                'rounded-lg border p-3 transition-colors',
                isSelected
                  ? cn(
                      featureThemeClassName('networkGroupRelationshipFieldsContrastBorder'),
                      RIGHT_GRADIENTS[option.value]
                    )
                  : 'border-border bg-muted/20',
                !disabled && (isSelected ? 'hover:opacity-90' : 'hover:bg-accent')
              )}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => onToggleRight(option.value)}
                className={featureThemeClassName('networkGroupRelationshipFieldsContrastPanel')}
                disabled={disabled}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                    isSelected
                      ? featureThemeClassName('networkGroupRelationshipFieldsContrastBadge')
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
                  <div
                    className={cn(
                      'text-sm',
                      isSelected
                        ? featureThemeClassName('networkGroupRelationshipFieldsContrastText')
                        : 'text-muted-foreground'
                    )}
                  >
                    {t(option.descKey)}
                  </div>
                </div>
              </Button>
              {isSelected && onDirectionChange && directionOptions ? (
                <div
                  className={cn(
                    'mt-3 ml-8 rounded-md border px-3 py-2',
                    isSelected
                      ? featureThemeClassName('networkGroupRelationshipFieldsContrastSurface')
                      : 'border-border bg-background'
                  )}
                >
                  <FormControlSelect
                    value={selectedDirection}
                    onValueChange={value =>
                      onDirectionChange(option.value, value as GroupRelationshipDirection)
                    }
                    disabled={disabled}
                  >
                    <FormControlSelectTrigger
                      className={cn(
                        featureThemeClassName('networkGroupRelationshipFieldsContrastBadgeAlpha'),
                        isSelected &&
                          featureThemeClassName('networkGroupRelationshipFieldsContrastTextAlpha')
                      )}
                    >
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
                    <FormControlSelectContent>
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
