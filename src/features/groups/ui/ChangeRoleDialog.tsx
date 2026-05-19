/**
 * Change Role Dialog Component
 *
 * Allows promoting or demoting a member by selecting a new role.
 * Roles are split into promotion and demotion sections based on sort_order.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { Label } from '@/features/shared/ui/ui/label';
import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { buildRightsSummaryForRoles, sortGroupRoles } from '../logic/buildMembershipRightsSummary';
import type { ParticipationRoleLike } from '@/features/shared/types/participation';

interface ChangeRoleDialogProps<TRole extends ParticipationRoleLike> {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  currentRoles: TRole[];
  roles: TRole[];
  onConfirm: (newRoleIds: string[]) => void;
  title?: string;
  emptyRolesLabel?: string;
  noSelectedRolesLabel?: string;
  emptyRightsLabel?: string;
  cancelLabel?: string;
  submitLabel?: string;
}

export function ChangeRoleDialog<TRole extends ParticipationRoleLike>({
  isOpen,
  onOpenChange,
  memberName,
  currentRoles,
  roles,
  onConfirm,
  title = 'Manage Roles',
  emptyRolesLabel = 'No roles available.',
  noSelectedRolesLabel = 'No roles selected',
  emptyRightsLabel = 'No explicit action rights are assigned through the currently selected roles.',
  cancelLabel = 'Cancel',
  submitLabel = 'Save Roles',
}: ChangeRoleDialogProps<TRole>) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [rightsOpen, setRightsOpen] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedRoleIds(
      currentRoles.map(role => role.id).filter((roleId): roleId is string => Boolean(roleId))
    );
    setRightsOpen(true);
  }, [currentRoles, isOpen]);

  const sortedRoles = useMemo(() => sortGroupRoles(roles), [roles]);

  const selectedRoles = useMemo(
    () => sortedRoles.filter(role => selectedRoleIds.includes(role.id)),
    [selectedRoleIds, sortedRoles]
  );

  const rightsSummary = useMemo(() => buildRightsSummaryForRoles(selectedRoles), [selectedRoles]);

  const currentRoleNames = currentRoles
    .map(role => role.name)
    .filter(Boolean)
    .join(', ');
  const selectedRoleNames = selectedRoles.map(role => role.name || 'Role').join(', ');

  const handleConfirm = () => {
    onConfirm(selectedRoleIds);
    setSelectedRoleIds([]);
    setRightsOpen(true);
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedRoleIds([]);
      setRightsOpen(true);
    }
    onOpenChange(open);
  };

  const toggleRoleSelection = (roleId: string, checked: boolean) => {
    setSelectedRoleIds(previous =>
      checked ? [...previous, roleId] : previous.filter(id => id !== roleId)
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Select all roles that should apply to <span className="font-medium">{memberName}</span>.
            {currentRoleNames && (
              <>
                {' '}
                Current roles: <span className="font-medium">{currentRoleNames}</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            {sortedRoles.length > 0 ? (
              sortedRoles.map(role => {
                const isChecked = selectedRoleIds.includes(role.id);

                return (
                  <Label
                    key={role.id}
                    htmlFor={`role-${role.id}`}
                    className="hover:bg-accent flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors"
                  >
                    <Checkbox
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
                  </Label>
                );
              })
            ) : (
              <p className="text-muted-foreground py-4 text-center text-sm">{emptyRolesLabel}</p>
            )}
          </div>

          <Collapsible open={rightsOpen} onOpenChange={setRightsOpen}>
            <div className="border-border/70 from-background via-background to-muted/30 overflow-hidden rounded-2xl border bg-gradient-to-br">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="hover:bg-muted/40 flex h-auto w-full items-center justify-between rounded-none px-4 py-4 text-left"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck className="h-4 w-4" />
                      Effective Action Rights
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {rightsSummary.length} rights from{' '}
                      {selectedRoleNames || noSelectedRolesLabel.toLowerCase()}. Source details
                      update as you change the role selection.
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
                    <div className="text-sm font-medium">Selected roles</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedRoles.length > 0 ? (
                        selectedRoles.map(role => (
                          <Badge
                            key={role.id}
                            variant="secondary"
                            className="rounded-full px-3 py-1"
                          >
                            {role.name || 'Role'}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          {noSelectedRolesLabel}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="border-border/70 overflow-x-auto rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[220px]">Effective Right</TableHead>
                          <TableHead>Granted By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rightsSummary.length > 0 ? (
                          rightsSummary.map(right => (
                            <TableRow key={right.key}>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium">{right.label}</div>
                                  <div className="text-muted-foreground text-xs">
                                    {right.resource} / {right.action}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  {right.sources.map(source => (
                                    <div
                                      key={`${right.key}-${source.roleId}`}
                                      className="border-border/70 bg-muted/30 rounded-full border px-3 py-1 text-xs"
                                    >
                                      <span className="font-medium">{source.roleName}</span>
                                      {!source.isDirect ? (
                                        <span className="text-muted-foreground">
                                          {' '}
                                          via {source.viaLabel}
                                        </span>
                                      ) : null}
                                      {source.isDirect ? (
                                        <Badge
                                          variant="outline"
                                          className="ml-2 border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
                                        >
                                          direct
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="ml-2 border-sky-500/50 text-sky-700 dark:text-sky-300"
                                        >
                                          implied
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={2}
                              className="text-muted-foreground py-8 text-center"
                            >
                              {emptyRightsLabel}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
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
      </DialogContent>
    </Dialog>
  );
}
