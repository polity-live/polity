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
      return t('common.network.siblingMembershipModeOpen');
    case 'elected':
      return t('common.network.siblingMembershipModeElected');
    case 'parliament':
      return t('common.network.siblingMembershipModeParliament');
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
      return t('common.network.currentGroupAsSiblingOfWithType', {
        currentGroupName,
        selectedGroupName,
        siblingType,
      });
    }

    return t('common.network.currentGroupAsSiblingOf', {
      currentGroupName,
      selectedGroupName,
    });
  }

  if (mode === 'statement') {
    if (siblingType) {
      return t('common.network.isSiblingGroupOfWithType', { siblingType });
    }

    return t('common.network.isSiblingGroupOf');
  }

  if (mode === 'role') {
    if (siblingType) {
      return t('common.network.siblingGroupOfWithType', { siblingType });
    }

    return t('common.network.siblingGroupOf');
  }

  if (siblingType) {
    return t('common.network.asSiblingGroupOfWithType', { siblingType });
  }

  return t('common.network.asSiblingGroupOf');
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
  selectedGroupName,
  t,
}: {
  direction: Exclude<GroupRelationshipDirection, 'none'>;
  rightLabel: string;
  currentGroupName: string;
  selectedGroupName: string;
  t: TranslateFn;
}) {
  const currentGroupLabel = t('common.network.thisGroup');
  const selectedGroupLabel = getGroupRelationshipNameText({
    name: selectedGroupName,
    kind: 'selected',
    t,
  });
  const templateParams = {
    currentGroupName: currentGroupLabel,
    rightLabel,
    selectedGroupName: selectedGroupLabel,
  };

  if (direction === 'current_grants_right_to_partner') {
    return t(
      'common.network.currentGroupGivesRightTo',
      templateParams,
      `${currentGroupLabel} ${t('common.network.directionGrants', 'gives')} ${rightLabel} ${t(
        'common.network.directionTo',
        'to'
      )} ${selectedGroupLabel}`
    );
  }

  if (direction === 'mutual') {
    return t(
      'common.network.groupsMutuallyShareRight',
      templateParams,
      `${currentGroupLabel} ${t('common.network.directionAnd', 'and')} ${selectedGroupLabel} ${t(
        'common.network.directionHaveMutually',
        'give each other'
      )} ${rightLabel}`
    );
  }

  return t(
    'common.network.currentGroupHasRightIn',
    templateParams,
    `${currentGroupLabel} ${t('common.network.directionHas', 'has')} ${rightLabel} ${t(
      'common.network.directionIn',
      'in'
    )} ${selectedGroupLabel}`
  );
}
