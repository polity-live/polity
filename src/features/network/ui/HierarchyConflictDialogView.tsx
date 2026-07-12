'use client';
import { featureThemeClassName } from '@/features/shared/theme';
import {
  ManagementDialogBody,
  ManagementDialogContent,
  ManagementDialogFooter,
  ManagementDialogHeader,
  ManagementDialogSection,
} from '@/features/shared/ui/dialog';
import { Dialog, DialogDescription, DialogTitle } from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { AlertTriangle, Check, Loader2, Mail, Trash2 } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { GroupConflictPanel } from '@/features/groups/ui/GroupConflictPanel';
import { UserSearchCard } from '@/features/search/ui/UserSearchCard';
export interface HierarchyConflictDialogViewProps {
  open: any;
  onOpenChange: any;
  groupName: any;
  otherGroupName: any;
  relationships: any;
  affectedUsers: any;
  partnerUsers: any;
  canAccept: any;
  onAccept: any;
  onReject: any;
  t: any;
  navigate: any;
  leaveGroup: any;
  isSubmitting: any;
  setIsSubmitting: any;
  removingUserId: any;
  setRemovingUserId: any;
  relationshipPreflightInput: any;
  relationshipPreflight: any;
  rightsLabel: any;
  hasStructuredConflicts: any;
  hasFallbackConflictUsers: any;
  handleMessage: any;
  handleRemoveFromGroup: any;
  handleAccept: any;
  handleReject: any;
  affectedMembersDescription: any;
  futurePartnersDescription: any;
}

export function HierarchyConflictDialogView({
  open,
  onOpenChange,
  groupName,
  otherGroupName,
  affectedUsers,
  partnerUsers,
  canAccept,
  t,
  isSubmitting,
  removingUserId,
  relationshipPreflight,
  rightsLabel,
  hasStructuredConflicts,
  hasFallbackConflictUsers,
  handleMessage,
  handleRemoveFromGroup,
  handleAccept,
  handleReject,
  affectedMembersDescription,
  futurePartnersDescription,
}: HierarchyConflictDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ManagementDialogContent className="h-[min(90dvh,42rem)] sm:max-w-3xl">
        <ManagementDialogHeader>
          <DialogTitle>{t('common.network.manageLinkRequest')}</DialogTitle>
          <DialogDescription>
            {t('common.network.manageLinkRequestDescription', {
              groupName,
              otherGroupName,
              rights: rightsLabel,
            })}
          </DialogDescription>
        </ManagementDialogHeader>

        <ManagementDialogBody className="space-y-4">
          {relationshipPreflight.isLoading ? (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {translateText('generated.inline.0797_konflikte_werden_geprueft_d2e75312')}
              </span>
            </div>
          ) : !hasStructuredConflicts && !hasFallbackConflictUsers ? (
            <div className={featureThemeClassName('networkHierarchyConflictDialogSuccessBadge')}>
              <Check
                className={featureThemeClassName('networkHierarchyConflictDialogSuccessIcon')}
              />
              <span>{t('common.network.linkPossibleDescription')}</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-destructive/30 bg-destructive/10 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {relationshipPreflight.response.summary ??
                    t('common.network.linkConflictDescription')}
                </span>
              </div>
              {hasStructuredConflicts ? (
                <GroupConflictPanel response={relationshipPreflight.response} />
              ) : null}
              <div className="space-y-4">
                <ManagementDialogSection className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold">
                      {t('common.network.affectedMembersHeading')}
                    </h3>
                    <p className="text-muted-foreground text-sm">{affectedMembersDescription}</p>
                  </div>
                  {affectedUsers.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {affectedUsers.map((user: any, index: number) => (
                        <UserSearchCard
                          key={user.userId}
                          index={index}
                          user={{
                            id: user.userId,
                            first_name: user.displayName,
                            avatar: user.avatarUrl,
                          }}
                          actions={
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={event => {
                                  event.stopPropagation();
                                  handleMessage(user);
                                }}
                              >
                                <Mail className="mr-1 h-3 w-3" />
                                {t('features.timeline.cards.message')}
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                disabled={removingUserId === user.userId || isSubmitting}
                                onClick={async event => {
                                  event.stopPropagation();
                                  await handleRemoveFromGroup(user);
                                }}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                {t('common.network.removeFromGroup')}
                              </Button>
                            </>
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground rounded-2xl border border-dashed px-3 py-6 text-sm">
                      {t('common.network.noAffectedMembers')}
                    </div>
                  )}
                </ManagementDialogSection>

                <ManagementDialogSection className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold">
                      {t('common.network.futurePartnersHeading')}
                    </h3>
                    <p className="text-muted-foreground text-sm">{futurePartnersDescription}</p>
                  </div>
                  {partnerUsers.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {partnerUsers.map((user: any, index: number) => (
                        <UserSearchCard
                          key={user.userId}
                          index={index}
                          user={{
                            id: user.userId,
                            first_name: user.displayName,
                            avatar: user.avatarUrl,
                          }}
                          actions={
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={event => {
                                event.stopPropagation();
                                handleMessage(user);
                              }}
                            >
                              <Mail className="mr-1 h-3 w-3" />
                              {t('features.timeline.cards.message')}
                            </Button>
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground rounded-2xl border border-dashed px-3 py-6 text-sm">
                      {t('common.network.noFuturePartners', { groupName: otherGroupName })}
                    </div>
                  )}
                </ManagementDialogSection>
              </div>
            </div>
          )}
        </ManagementDialogBody>

        <ManagementDialogFooter className="gap-3 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isSubmitting}
            onClick={handleReject}
          >
            {t('common.network.reject')}
          </Button>
          <Button
            type="button"
            disabled={
              !canAccept ||
              isSubmitting ||
              relationshipPreflight.blocking ||
              relationshipPreflight.isLoading
            }
            onClick={handleAccept}
          >
            {t('common.network.accept')}
          </Button>
        </ManagementDialogFooter>
      </ManagementDialogContent>
    </Dialog>
  );
}
