import {
  BadgeControl,
  getRelationshipBadgeClassName as getRelationshipBadgeClasses,
} from '@/features/shared/ui/status';
import { FormControlLabel } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils.ts';
import {
  getCurrentGroupRelationshipLabel,
  GroupRelationshipRightSentenceList,
  type GroupRelationshipRight,
} from '@/features/network/ui/GroupRelationshipFields';
import { GroupConnectionComposer } from '@/features/network/ui/GroupConnectionComposer';
import {
  getCanonicalMembershipModeLabel,
  getSiblingMembershipKind,
} from '@/features/network/logic/groupConnectionDerived';
import { Link2, X } from 'lucide-react';

interface GroupConnectionsInputProps {
  label: string;
  hint: string;
  linkedGroupsLabel: string;
  addLabel: string;
  cancelLabel: string;
  checkingLabel: string;
  currentGroupId: string;
  currentGroupName: string;
  activeTab: any;
  value: any;
  availableGroups: any[];
  selectableRolesByDirection: any;
  existingRightStatuses: any;
  preflight: any;
  disabledPresets?: any;
  disabledPresetFallback?: any;
  groupSelectorLabel: string;
  linkedGroups: any[];
  addDisabled: boolean;
  onActiveTabChange: (tab: any) => void;
  onValueChange: (value: any) => void;
  onAdd: () => void;
  onCancel: () => void;
  onRemove: (groupId: string) => void;
  getSelectedRights: (
    rightDirections: Record<GroupRelationshipRight, any>
  ) => GroupRelationshipRight[];
  t: (key: string) => string;
}

export function GroupConnectionsInput({
  label,
  hint,
  linkedGroupsLabel,
  addLabel,
  cancelLabel,
  checkingLabel,
  currentGroupId,
  currentGroupName,
  activeTab,
  value,
  availableGroups,
  selectableRolesByDirection,
  existingRightStatuses,
  preflight,
  disabledPresets,
  disabledPresetFallback,
  groupSelectorLabel,
  linkedGroups,
  addDisabled,
  onActiveTabChange,
  onValueChange,
  onAdd,
  onCancel,
  onRemove,
  getSelectedRights,
  t,
}: GroupConnectionsInputProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1">
          <FormControlLabel>{label}</FormControlLabel>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>

        <GroupConnectionComposer
          activeTab={activeTab}
          onActiveTabChange={onActiveTabChange}
          value={value}
          onValueChange={onValueChange}
          currentGroupId={currentGroupId}
          currentGroupName={currentGroupName}
          availableGroups={availableGroups}
          selectableRolesByDirection={selectableRolesByDirection}
          existingRightStatuses={existingRightStatuses}
          preflight={preflight}
          disabledPresets={disabledPresets}
          disabledPresetFallback={disabledPresetFallback}
          groupSelectorLabel={groupSelectorLabel}
        />

        <div className="flex gap-2">
          <Button
            data-action-id="create.group-connections.add"
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdd}
            disabled={addDisabled}
          >
            <Link2 className="mr-1 h-4 w-4" />
            {addLabel}
          </Button>
          <Button
            data-action-id="create.group-connections.cancel"
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
        </div>
        {preflight.isLoading ? (
          <div className="text-muted-foreground text-sm">{checkingLabel}</div>
        ) : null}
      </div>

      {linkedGroups.length > 0 ? (
        <div className="space-y-2">
          <FormControlLabel className="text-muted-foreground text-xs">
            {linkedGroupsLabel}
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
              <BadgeControl tone="mutedContrast" size="xs">
                {getCanonicalMembershipModeLabel(linkedGroup.membershipMode)}
              </BadgeControl>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="space-y-1">
                  <span className="block text-sm font-medium">{linkedGroup.groupName}</span>
                  <p className="text-muted-foreground text-xs">
                    {getCurrentGroupRelationshipLabel({
                      relationshipType: linkedGroup.type,
                      currentGroupName,
                      selectedGroupName: linkedGroup.groupName,
                      siblingMembershipMode:
                        linkedGroup.type === 'sibling'
                          ? (getSiblingMembershipKind(linkedGroup.membershipMode) ?? undefined)
                          : undefined,
                      t,
                    })}
                  </p>
                </div>
                <GroupRelationshipRightSentenceList
                  rights={getSelectedRights(linkedGroup.rightDirections)}
                  rightDirections={linkedGroup.rightDirections}
                  currentGroupName={currentGroupName}
                  selectedGroupName={linkedGroup.groupName}
                  currentGroupId={currentGroupId}
                  selectedGroupId={linkedGroup.groupId}
                />
              </div>
              <Button
                data-action-id="create.group-connections.remove"
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onRemove(linkedGroup.groupId)}
                aria-label={`${cancelLabel} ${linkedGroup.groupName}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
