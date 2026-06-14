import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlLabel, FormControlCheckbox } from '@/features/shared/ui/form';
/**
 * Change Role Dialog Component
 *
 * Allows promoting or demoting a member by selecting a new role.
 * Roles are split into promotion and demotion sections based on sort_order.
 */

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { DataTable } from '@/features/shared/ui/data-table';
import { StatusBadge } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { RoleTag } from './RoleTag';
export interface ChangeRoleDialogViewProps {
  isOpen: any;
  onOpenChange: any;
  memberName: any;
  currentRoles: any;
  roles: any;
  onConfirm: any;
  title: any;
  emptyRolesLabel: any;
  noSelectedRolesLabel: any;
  emptyRightsLabel: any;
  cancelLabel: any;
  submitLabel: any;
  selectedRoleIds: any;
  setSelectedRoleIds: any;
  rightsOpen: any;
  setRightsOpen: any;
  sortedRoles: any;
  selectedRoles: any;
  rightsSummary: any;
  currentRoleNames: any;
  selectedRoleNames: any;
  rightsColumns: any;
  handleConfirm: any;
  handleOpenChange: any;
  toggleRoleSelection: any;
}

export function ChangeRoleDialogView({
  isOpen,
  memberName,
  title,
  emptyRolesLabel,
  noSelectedRolesLabel,
  emptyRightsLabel,
  cancelLabel,
  submitLabel,
  selectedRoleIds,
  rightsOpen,
  setRightsOpen,
  sortedRoles,
  selectedRoles,
  rightsSummary,
  currentRoleNames,
  selectedRoleNames,
  rightsColumns,
  handleConfirm,
  handleOpenChange,
  toggleRoleSelection,
}: ChangeRoleDialogViewProps) {
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <ScrollableDialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {translateText('generated.inline.0663_select_all_roles_that_should_apply_to_4fca25fe')}
            <span className="font-medium">{memberName}</span>.
            {currentRoleNames && (
              <>
                {' '}
                {translateText('generated.inline.0664_current_roles_48ba4d9c')}
                <span className="font-medium">{currentRoleNames}</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            {sortedRoles.length > 0 ? (
              sortedRoles.map((role: any) => {
                const isChecked = selectedRoleIds.includes(role.id);

                return (
                  <FormControlLabel
                    key={role.id}
                    htmlFor={`role-${role.id}`}
                    className="hover:bg-accent flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors"
                  >
                    <FormControlCheckbox
                      id={`role-${role.id}`}
                      checked={isChecked}
                      onCheckedChange={checked => toggleRoleSelection(role.id, checked === true)}
                    />
                    <div>
                      <div className="font-medium">{role.name}</div>
                      {role.description && (
                        <div className="text-muted-foreground text-xs">{role.description}</div>
                      )}
                    </div>
                  </FormControlLabel>
                );
              })
            ) : (
              <p className="text-muted-foreground py-4 text-center text-sm">{emptyRolesLabel}</p>
            )}
          </div>

          <Collapsible open={rightsOpen} onOpenChange={setRightsOpen}>
            <div className={featureThemeClassName('groupChangeRoleDialogThemedGradientSurface')}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="hover:bg-muted/40 flex h-auto w-full items-center justify-between rounded-none px-4 py-4 text-left"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck className="h-4 w-4" />
                      {translateText('generated.inline.0665_effective_action_rights_9ecdee26')}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {rightsSummary.length}
                      {translateText('generated.inline.0666_rights_from_64a77ee2')}{' '}
                      {selectedRoleNames || noSelectedRolesLabel.toLowerCase()}
                      {translateText(
                        'generated.inline.0667_source_details_update_as_you_change_the_role__ae8c3148'
                      )}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${rightsOpen ? 'rotate-180' : ''}`}
                  />
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="border-border/70 border-t px-4 py-4">
                <div className="space-y-4">
                  <div className="border-border/70 bg-background/70 rounded-2xl border p-4">
                    <div className="text-sm font-medium">
                      {translateText('generated.inline.0668_selected_roles_71890009')}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedRoles.length > 0 ? (
                        selectedRoles.map((role: any) => (
                          <RoleTag key={role.id} roleId={role.id} roleName={role.name || 'Role'} />
                        ))
                      ) : (
                        <StatusBadge status="empty" tone="neutral">
                          {noSelectedRolesLabel}
                        </StatusBadge>
                      )}
                    </div>
                  </div>

                  <DataTable
                    columns={rightsColumns}
                    data={rightsSummary}
                    getRowId={(right: any) => right.key}
                    enablePagination={false}
                    emptyTitle={emptyRightsLabel}
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button onClick={handleConfirm}>{submitLabel}</Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
