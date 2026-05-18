'use client';

import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { AlertTriangle, Check, Mail, Trash2 } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { toast } from 'sonner';
import type { NormalizedGroupRelationship } from '../types/network.types';
import type { HierarchyConflictUser } from '../hooks/useHierarchyLinkConflicts';

interface HierarchyConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  otherGroupName: string;
  relationships: NormalizedGroupRelationship[];
  affectedUsers: HierarchyConflictUser[];
  partnerUsers: HierarchyConflictUser[];
  canAccept: boolean;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
}

interface ConflictSectionUserItemProps {
  user: HierarchyConflictUser;
  description: string;
  actions: ReactNode;
  onOpenMessage: (user: HierarchyConflictUser) => void;
}

function ConflictSectionUserItem({
  user,
  description,
  actions,
  onOpenMessage,
}: ConflictSectionUserItemProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenMessage(user);
    }
  };

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        className="hover:bg-accent/60 focus-visible:ring-ring flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => onOpenMessage(user)}
        onKeyDown={handleKeyDown}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-12 w-12 rounded-2xl">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.displayName} />
            <AvatarFallback className="rounded-2xl">
              {user.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.displayName}</p>
            <p className="text-muted-foreground truncate text-sm">{description}</p>
          </div>
        </div>
        <div
          className="flex shrink-0 flex-wrap items-center justify-end gap-2"
          onClick={event => event.stopPropagation()}
        >
          {actions}
        </div>
      </div>
    </li>
  );
}

export function HierarchyConflictDialog({
  open,
  onOpenChange,
  groupName,
  otherGroupName,
  relationships,
  affectedUsers,
  partnerUsers,
  canAccept,
  onAccept,
  onReject,
}: HierarchyConflictDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { leaveGroup } = useGroupActions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const rightsLabel = useMemo(
    () =>
      relationships
        .map(rel => rel.with_right)
        .filter(Boolean)
        .join(', '),
    [relationships]
  );

  const handleMessage = (user: HierarchyConflictUser) => {
    navigate({
      to: '/messages',
      search: {
        userId: user.userId,
        name: user.displayName,
      },
    });
    onOpenChange(false);
  };

  const handleRemoveFromGroup = async (user: HierarchyConflictUser) => {
    if (!user.membershipIdInCurrentGroup) {
      toast.error(t('common.network.conflictUserNotInGroup'));
      return;
    }

    setRemovingUserId(user.userId);
    try {
      await leaveGroup({ id: user.membershipIdInCurrentGroup });
      toast.success(t('common.network.conflictUserRemoved'));
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error(t('common.network.conflictUserRemoveFailed'));
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleAccept = async () => {
    if (!canAccept) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onAccept();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await onReject();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const affectedMembersDescription = t('common.network.affectedMembersDescription');
  const futurePartnersDescription = t('common.network.futurePartnersDescription', {
    groupName: otherGroupName,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,42rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('common.network.manageLinkRequest')}</DialogTitle>
          <DialogDescription>
            {t('common.network.manageLinkRequestDescription', {
              groupName,
              otherGroupName,
              rights: rightsLabel,
            })}
          </DialogDescription>
        </DialogHeader>

        {affectedUsers.length === 0 && partnerUsers.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{t('common.network.linkPossibleDescription')}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-destructive/30 bg-destructive/10 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
              <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('common.network.linkConflictDescription')}</span>
            </div>
            <div className="space-y-4">
              <section className="bg-muted/20 space-y-3 rounded-2xl border p-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">
                    {t('common.network.affectedMembersHeading')}
                  </h3>
                  <p className="text-muted-foreground text-sm">{affectedMembersDescription}</p>
                </div>
                {affectedUsers.length > 0 ? (
                  <ul className="space-y-2">
                    {affectedUsers.map(user => (
                      <ConflictSectionUserItem
                        key={user.userId}
                        user={user}
                        description={t('common.network.directMemberOfYourGroup')}
                        onOpenMessage={handleMessage}
                        actions={
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={event => {
                                event.stopPropagation();
                                handleMessage(user);
                              }}
                            >
                              <Mail className="mr-1 h-3.5 w-3.5" />
                              {t('features.timeline.cards.message')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={removingUserId === user.userId || isSubmitting}
                              onClick={async event => {
                                event.stopPropagation();
                                await handleRemoveFromGroup(user);
                              }}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              {t('common.network.removeFromGroup')}
                            </Button>
                          </>
                        }
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted-foreground rounded-2xl border border-dashed px-3 py-6 text-sm">
                    {t('common.network.noAffectedMembers')}
                  </div>
                )}
              </section>

              <section className="bg-muted/20 space-y-3 rounded-2xl border p-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">
                    {t('common.network.futurePartnersHeading')}
                  </h3>
                  <p className="text-muted-foreground text-sm">{futurePartnersDescription}</p>
                </div>
                {partnerUsers.length > 0 ? (
                  <ul className="space-y-2">
                    {partnerUsers.map(user => (
                      <ConflictSectionUserItem
                        key={user.userId}
                        user={user}
                        description={t('common.network.directMemberOfGroup', {
                          groupName: otherGroupName,
                        })}
                        onOpenMessage={handleMessage}
                        actions={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={event => {
                              event.stopPropagation();
                              handleMessage(user);
                            }}
                          >
                            <Mail className="mr-1 h-3.5 w-3.5" />
                            {t('features.timeline.cards.message')}
                          </Button>
                        }
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted-foreground rounded-2xl border border-dashed px-3 py-6 text-sm">
                    {t('common.network.noFuturePartners', { groupName: otherGroupName })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        <DialogFooter className="mt-6 gap-3 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {t('common.actions.cancel')}
          </Button>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={handleReject}>
            {t('common.network.reject')}
          </Button>
          <Button type="button" disabled={!canAccept || isSubmitting} onClick={handleAccept}>
            {t('common.network.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
