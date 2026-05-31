import type { GroupRelationshipDirection } from '../types/network.types';

export type GroupRelationshipNameKind = 'current' | 'selected';
export type GroupRelationshipNameCase = 'sentence-start' | 'embedded';
export type SiblingMembershipMode = 'open' | 'elected' | 'parliament';

type TranslateParamValue = string | number | null | undefined;

export type TranslateFn = (
  key: string,
  paramsOrFallback?: string | Record<string, TranslateParamValue>,
  fallback?: string
) => string;

type SiblingRelationshipPhraseMode = 'selection' | 'statement' | 'role' | 'sentence';

function getSafeGroupName(name: string, fallback: string) {
  const trimmedName = name.trim();
  return trimmedName || fallback;
}

export function getSiblingMembershipModeLabel(
  mode: SiblingMembershipMode | null | undefined,
  t: TranslateFn
) {
  switch (mode) {
    case 'open':
      return t('common.network.siblingMembershipModeOpen', 'Open');
    case 'elected':
      return t('common.network.siblingMembershipModeElected', 'Elected');
    case 'parliament':
      return t('common.network.siblingMembershipModeParliament', 'Parliament');
    default:
      return null;
  }
}

export function getSiblingRelationshipPhraseText({
  mode,
  siblingMembershipMode,
  t,
  currentGroupName,
  selectedGroupName,
}: {
  mode: SiblingRelationshipPhraseMode;
  siblingMembershipMode?: SiblingMembershipMode | null;
  t: TranslateFn;
  currentGroupName?: string;
  selectedGroupName?: string;
}) {
  const siblingType = getSiblingMembershipModeLabel(siblingMembershipMode, t);

  if (mode === 'sentence') {
    if (!currentGroupName || !selectedGroupName) {
      return '';
    }

    if (siblingType) {
      return t(
        'common.network.currentGroupAsSiblingOfWithType',
        {
          currentGroupName,
          selectedGroupName,
          siblingType,
        },
        '{{currentGroupName}} as sibling group ({{siblingType}}) of {{selectedGroupName}}'
      );
    }

    return t(
      'common.network.currentGroupAsSiblingOf',
      {
        currentGroupName,
        selectedGroupName,
      },
      '{{currentGroupName}} as sibling group of {{selectedGroupName}}'
    );
  }

  if (mode === 'statement') {
    if (siblingType) {
      return t(
        'common.network.isSiblingGroupOfWithType',
        { siblingType },
        'is sibling group ({{siblingType}}) of'
      );
    }

    return t('common.network.isSiblingGroupOf', 'is sibling group of');
  }

  if (mode === 'role') {
    if (siblingType) {
      return t(
        'common.network.siblingGroupOfWithType',
        { siblingType },
        'sibling group ({{siblingType}}) of'
      );
    }

    return t('common.network.siblingGroupOf', 'sibling group of');
  }

  if (siblingType) {
    return t(
      'common.network.asSiblingGroupOfWithType',
      { siblingType },
      'as sibling group ({{siblingType}}) of'
    );
  }

  return t('common.network.asSiblingGroupOf', 'as sibling group of');
}

export function getGroupRelationshipNameText({
  name,
  kind,
  t,
  caseStyle = 'sentence-start',
}: {
  name: string;
  kind: GroupRelationshipNameKind;
  t: TranslateFn;
  caseStyle?: GroupRelationshipNameCase;
}) {
  const fallback =
    kind === 'current'
      ? caseStyle === 'embedded'
        ? t('common.network.thisGroupEmbedded')
        : t('common.network.thisGroup')
      : t('common.unspecified');
  const safeName = getSafeGroupName(name, fallback);

  if (kind !== 'current') {
    return safeName;
  }

  if (safeName === fallback) {
    return fallback;
  }

  return caseStyle === 'embedded'
    ? t('common.network.thisGroupWithNameEmbedded', { groupName: safeName })
    : t('common.network.thisGroupWithName', { groupName: safeName });
}

export function getGroupRelationshipRightSentenceText({
  direction,
  rightLabel,
  currentGroupName,
  selectedGroupName,
  t,
}: {
  direction: Exclude<GroupRelationshipDirection, 'none'>;
  rightLabel: string;
  currentGroupName: string;
  selectedGroupName: string;
  t: TranslateFn;
}) {
  const currentGroupLabel = getGroupRelationshipNameText({
    name: currentGroupName,
    kind: 'current',
    t,
  });
  const selectedGroupLabel = getGroupRelationshipNameText({
    name: selectedGroupName,
    kind: 'selected',
    t,
  });

  if (direction === 'incoming') {
    return t(
      'common.network.currentGroupHasRightIn',
      {
        currentGroupName: currentGroupLabel,
        rightLabel,
        selectedGroupName: selectedGroupLabel,
      },
      '{{currentGroupName}} has {{rightLabel}} in {{selectedGroupName}}'
    );
  }

  if (direction === 'bidirectional') {
    return t(
      'common.network.groupsMutuallyShareRight',
      {
        currentGroupName: currentGroupLabel,
        rightLabel,
        selectedGroupName: selectedGroupLabel,
      },
      '{{currentGroupName}} and {{selectedGroupName}} share {{rightLabel}} mutually'
    );
  }

  return t(
    'common.network.currentGroupGrantsRightTo',
    {
      currentGroupName: currentGroupLabel,
      rightLabel,
      selectedGroupName: selectedGroupLabel,
    },
    '{{currentGroupName}} grants {{rightLabel}} to {{selectedGroupName}}'
  );
}
