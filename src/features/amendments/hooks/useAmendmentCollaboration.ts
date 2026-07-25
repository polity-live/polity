import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { ProjectedAmendmentCollaborationState } from '@/features/search/types/projected-card-state';

export type CollaborationStatus =
  'invited' | 'requested' | 'active' | 'collaborator' | 'member' | 'admin';

export function useAmendmentCollaboration(
  amendmentId: string,
  projectedState?: ProjectedAmendmentCollaborationState
) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const {
    requestCollaboration: addCollaboratorAction,
    leaveCollaboration: removeCollaboratorAction,
    acceptInvitation: acceptInvitationAction,
  } = useAmendmentActions();

  const {
    collaboration,
    status,
    isCollaborator,
    isAdmin,
    hasRequested,
    isInvited,
    collaboratorCount,
    isLoading: queryLoading,
  } = useAmendmentState({
    amendmentId: projectedState ? undefined : amendmentId,
    userId: projectedState ? undefined : user?.id,
  });
  const projectedCollaboration = projectedState?.collaborations[0] ?? null;
  const resolvedCollaboration = projectedState ? projectedCollaboration : collaboration;
  const resolvedStatus = projectedState
    ? ((projectedCollaboration?.status as CollaborationStatus | undefined) ?? null)
    : status;
  const resolvedIsCollaborator =
    resolvedStatus === 'member' ||
    resolvedStatus === 'admin' ||
    resolvedStatus === 'active' ||
    resolvedStatus === 'collaborator';

  // Request to collaborate on the amendment
  const requestCollaboration = async () => {
    if (!user?.id || resolvedCollaboration) return;

    // Validate amendmentId is a valid UUID
    if (!amendmentId || typeof amendmentId !== 'string') {
      console.error('Invalid amendmentId:', amendmentId);
      return;
    }

    setIsLoading(true);
    try {
      const newCollaborationId = crypto.randomUUID();

      await waitForClientApply(
        addCollaboratorAction({
          id: newCollaborationId,
          status: 'requested',
          user_id: user.id,
          amendment_id: amendmentId,
          role_id: null,
          visibility: '',
        })
      );

      // Send notification to amendment admins
    } catch (error) {
      console.error('Failed to request collaboration:', error);
      console.error('Amendment ID:', amendmentId);
      console.error('User ID:', user?.id);
      toast.error(
        translateText(
          'generated.inline.0135_failed_to_request_collaboration_please_try_ag_b255ebd0'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Leave the amendment collaboration
  const leaveCollaboration = async () => {
    if (!resolvedCollaboration?.id) return;

    setIsLoading(true);
    try {
      await waitForClientApply(removeCollaboratorAction(resolvedCollaboration.id));
    } catch (error) {
      console.error('Failed to leave collaboration:', error);
      toast.error(
        translateText(
          'generated.inline.0136_failed_to_leave_collaboration_please_try_agai_fd2dfbeb'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Accept invitation
  const acceptInvitation = async () => {
    if (!resolvedCollaboration?.id || resolvedStatus !== 'invited') return;

    setIsLoading(true);
    try {
      await waitForClientApply(acceptInvitationAction(resolvedCollaboration.id));
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      toast.error(
        translateText('generated.inline.0137_failed_to_accept_invitation_please_try_again_9c80b3af')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    collaboration: resolvedCollaboration,
    status: resolvedStatus,
    isCollaborator: projectedState ? resolvedIsCollaborator : isCollaborator,
    isAdmin: projectedState ? resolvedStatus === 'admin' : isAdmin,
    hasRequested: projectedState ? resolvedStatus === 'requested' : hasRequested,
    isInvited: projectedState ? resolvedStatus === 'invited' : isInvited,
    collaboratorCount: projectedState?.collaboratorCount ?? collaboratorCount,
    isLoading: (projectedState?.isLoading ?? queryLoading) || isLoading,
    requestCollaboration,
    leaveCollaboration,
    acceptInvitation,
  };
}
