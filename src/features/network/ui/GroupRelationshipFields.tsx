import { Check } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Label } from '@/features/shared/ui/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/features/shared/ui/ui/select';
import { cn } from '@/features/shared/utils/utils';
import { RIGHT_GRADIENTS, type RightType } from './RightFilters';

export type GroupRelationshipType = 'parent' | 'child';
export type GroupRelationshipRight = RightType;
export type GroupRelationshipPhraseMode = 'selection' | 'statement' | 'role';
export type GroupRelationshipTagCase = 'sentence-start' | 'embedded';

type TranslateFn = (key: string, params?: Record<string, unknown>, defaultValue?: string) => string;

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

export function invertGroupRelationshipType(
  relationshipType: GroupRelationshipType
): GroupRelationshipType {
  return relationshipType === 'parent' ? 'child' : 'parent';
}

function getSafeGroupName(name: string, fallback: string) {
  const trimmedName = name.trim();
  return trimmedName || fallback;
}

export function getCurrentGroupRelationshipLabel({
  relationshipType,
  currentGroupName,
  selectedGroupName,
  t,
}: {
  relationshipType: GroupRelationshipType;
  currentGroupName: string;
  selectedGroupName: string;
  t: TranslateFn;
}) {
  const safeCurrentGroupName = getSafeGroupName(currentGroupName, t('common.network.thisGroup'));
  const safeSelectedGroupName = getSafeGroupName(selectedGroupName, t('common.unspecified'));

  return relationshipType === 'parent'
    ? t('common.network.currentGroupAsParentOf', {
        currentGroupName: safeCurrentGroupName,
        selectedGroupName: safeSelectedGroupName,
      })
    : t('common.network.currentGroupAsChildOf', {
        currentGroupName: safeCurrentGroupName,
        selectedGroupName: safeSelectedGroupName,
      });
}

export function getGroupRelationshipRightLabel(right: GroupRelationshipRight, t: TranslateFn) {
  const option = GROUP_RELATIONSHIP_RIGHT_OPTIONS.find(entry => entry.value === right);
  return option ? t(option.labelKey) : right;
}

function getStatusBadgeLabel(status: string, t: TranslateFn) {
  if (status === 'requested') {
    return t('common.network.requested');
  }

  if (status === 'accepted') {
    return t('common.network.acceptedStatus');
  }

  return status;
}

function getRelationshipConnectorLabel(
  relationshipType: GroupRelationshipType,
  t: TranslateFn,
  mode: GroupRelationshipPhraseMode = 'selection'
) {
  if (mode === 'statement') {
    return relationshipType === 'parent'
      ? t('common.network.isParentGroupOf')
      : t('common.network.isChildGroupOf');
  }

  if (mode === 'role') {
    return relationshipType === 'parent'
      ? t('common.network.parentGroupOf')
      : t('common.network.childGroupOf');
  }

  return relationshipType === 'parent'
    ? t('common.network.asParentGroupOf')
    : t('common.network.asChildGroupOf');
}

function getRelationshipConnectorClasses(relationshipType: GroupRelationshipType) {
  return relationshipType === 'parent'
    ? 'from-amber-600 via-orange-500 to-rose-500 decoration-orange-400/90'
    : 'from-cyan-600 via-sky-500 to-violet-500 decoration-sky-400/90';
}

function getGroupTagClasses(kind: 'current' | 'selected') {
  return kind === 'current'
    ? 'border-0 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 text-emerald-800 dark:text-emerald-200'
    : 'border-0 bg-gradient-to-r from-sky-500/20 via-blue-500/20 to-indigo-500/20 text-sky-800 dark:text-sky-200';
}

export function GroupRelationshipNameTag({
  name,
  kind,
  caseStyle = 'sentence-start',
}: {
  name: string;
  kind: 'current' | 'selected';
  caseStyle?: GroupRelationshipTagCase;
}) {
  const { t } = useTranslation();
  const fallback =
    kind === 'current'
      ? caseStyle === 'embedded'
        ? t('common.network.thisGroupEmbedded')
        : t('common.network.thisGroup')
      : t('common.unspecified');
  const safeName = getSafeGroupName(name, fallback);
  const displayName =
    kind === 'current'
      ? safeName === fallback
        ? fallback
        : caseStyle === 'embedded'
          ? t('common.network.thisGroupWithNameEmbedded', { groupName: safeName })
          : t('common.network.thisGroupWithName', { groupName: safeName })
      : safeName;

  return (
    <Badge className={cn('max-w-full text-[11px] font-semibold', getGroupTagClasses(kind))}>
      <span className="truncate">{displayName}</span>
    </Badge>
  );
}

export function GroupRelationshipConnector({
  relationshipType,
  mode = 'selection',
  className,
}: {
  relationshipType: GroupRelationshipType;
  mode?: GroupRelationshipPhraseMode;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        'inline-block bg-gradient-to-r bg-clip-text text-xs font-semibold text-transparent underline decoration-2 underline-offset-4',
        getRelationshipConnectorClasses(relationshipType),
        className
      )}
    >
      {getRelationshipConnectorLabel(relationshipType, t, mode)}
    </span>
  );
}

function RelationshipTypeOptionContent({
  relationshipType,
  currentGroupName,
  selectedGroupName,
}: {
  relationshipType: GroupRelationshipType;
  currentGroupName: string;
  selectedGroupName: string;
}) {
  const { t } = useTranslation();
  const safeCurrentGroupName = getSafeGroupName(currentGroupName, t('common.network.thisGroup'));
  const safeSelectedGroupName = getSafeGroupName(selectedGroupName, t('common.unspecified'));

  return (
    <div className="flex flex-wrap items-center gap-2 leading-tight">
      <GroupRelationshipNameTag name={safeCurrentGroupName} kind="current" />
      <GroupRelationshipConnector relationshipType={relationshipType} mode="selection" />
      <GroupRelationshipNameTag name={safeSelectedGroupName} kind="selected" />
    </div>
  );
}

interface GroupRelationshipTypeSelectProps {
  id?: string;
  label: string;
  value: GroupRelationshipType;
  currentGroupName: string;
  selectedGroupName: string;
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
    t,
  });

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value}
        onValueChange={next => onValueChange(next as GroupRelationshipType)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="h-auto min-h-12 py-3 [&>span]:line-clamp-none">
          <div className="min-w-0 flex-1 text-left">
            <RelationshipTypeOptionContent
              relationshipType={value}
              currentGroupName={currentGroupName}
              selectedGroupName={selectedGroupName}
            />
            <span className="sr-only">{selectedLabel}</span>
          </div>
        </SelectTrigger>
        <SelectContent className="max-w-[26rem]">
          <SelectItem value="parent" disabled={disabledOptions?.parent} className="py-2">
            <RelationshipTypeOptionContent
              relationshipType="parent"
              currentGroupName={currentGroupName}
              selectedGroupName={selectedGroupName}
            />
          </SelectItem>
          <SelectItem value="child" disabled={disabledOptions?.child} className="py-2">
            <RelationshipTypeOptionContent
              relationshipType="child"
              currentGroupName={currentGroupName}
              selectedGroupName={selectedGroupName}
            />
          </SelectItem>
        </SelectContent>
      </Select>
      {helperText ? <p className="text-muted-foreground text-sm">{helperText}</p> : null}
    </div>
  );
}

interface GroupRelationshipRightsSelectorProps {
  label: string;
  selectedRights: Set<GroupRelationshipRight>;
  onToggleRight: (right: GroupRelationshipRight) => void;
  helperText?: string;
  existingRightStatuses?: ReadonlyMap<GroupRelationshipRight, string>;
}

export function GroupRelationshipRightsSelector({
  label,
  selectedRights,
  onToggleRight,
  helperText,
  existingRightStatuses,
}: GroupRelationshipRightsSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3">
      <div className="space-y-1">
        <Label>{label}</Label>
        {helperText ? <p className="text-muted-foreground text-sm">{helperText}</p> : null}
      </div>
      <div className="grid gap-2">
        {GROUP_RELATIONSHIP_RIGHT_OPTIONS.map(option => {
          const isSelected = selectedRights.has(option.value);
          const status = existingRightStatuses?.get(option.value);

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggleRight(option.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:opacity-90',
                isSelected
                  ? cn('border-0 text-white shadow-sm', RIGHT_GRADIENTS[option.value])
                  : 'border-border bg-muted/20 hover:bg-accent'
              )}
            >
              <div
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                  isSelected ? 'border-white/70 bg-white/15 text-white' : 'border-muted-foreground'
                )}
              >
                {isSelected ? <Check className="h-3 w-3" /> : null}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium">{t(option.labelKey)}</div>
                  {status ? (
                    <Badge
                      variant={status === 'requested' ? 'secondary' : 'default'}
                      className="shrink-0"
                    >
                      {getStatusBadgeLabel(status, t)}
                    </Badge>
                  ) : null}
                </div>
                <div
                  className={cn('text-sm', isSelected ? 'text-white/90' : 'text-muted-foreground')}
                >
                  {t(option.descKey)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
