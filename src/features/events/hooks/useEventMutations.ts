import { useState } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useEventActions } from '@/zero/events/useEventActions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import type { EventUpdateInput } from '@/zero/events/schema';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

/**
 * Hook for event mutations
 */
export function useEventMutations(eventId: string) {
  const {
    inviteParticipant,
    updateParticipant,
    syncParticipantRoles,
    leaveEvent,
    updateEvent: doUpdateEvent,
  } = useEventActions();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Invite participants to the event
   */
  const inviteParticipants = async (
    userIds: string[],
    roleIds?: string | string[],
    senderId?: string,
    eventTitle?: string
  ) => {
    void eventTitle;

    if (userIds.length === 0) return { success: false, error: 'No users selected' };

    setIsLoading(true);
    try {
      const normalizedRoleIds = Array.isArray(roleIds)
        ? roleIds.filter(Boolean)
        : roleIds
          ? [roleIds]
          : [];

      await Promise.all(
        userIds.map(userId =>
          waitForClientApply(
            inviteParticipant({
              id: crypto.randomUUID(),
              status: 'invited',
              user_id: userId,
              event_id: eventId,
              group_id: null,
              visibility: 'public',
              initial_role_ids: normalizedRoleIds,
            })
          )
        )
      );

      toast.success(
        translateText('features.events.participants.inviteSuccess', { count: userIds.length })
      );
      return { success: true };
    } catch (error) {
      console.error('Failed to invite participants:', error);
      toast.error(translateText('generated.inline.0452_failed_to_invite_participants_98a87f1c'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Approve a participation request
   */
  const approveParticipation = async (
    participationId: string,
    userId?: string,
    senderId?: string,
    eventTitle?: string
  ) => {
    void userId;
    void senderId;
    void eventTitle;

    setIsLoading(true);
    try {
      await waitForClientApply(
        updateParticipant({
          id: participationId,
          status: 'active',
        })
      );

      toast.success(translateText('generated.inline.0453_participation_approved_2d1f7f60'));
      return { success: true };
    } catch (error) {
      console.error('Failed to approve participation:', error);
      toast.error(translateText('generated.inline.0454_failed_to_approve_participation_eb726123'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reject a participation request
   */
  const rejectParticipation = async (
    participationId: string,
    userId?: string,
    senderId?: string,
    eventTitle?: string
  ) => {
    void userId;
    void senderId;
    void eventTitle;

    setIsLoading(true);
    try {
      await waitForClientApply(
        leaveEvent({
          id: participationId,
        })
      );

      toast.success(translateText('generated.inline.0455_participation_request_rejected_3d4d3f9f'));
      return { success: true };
    } catch (error) {
      console.error('Failed to reject participation:', error);
      toast.error(translateText('generated.inline.0456_failed_to_reject_participation_187c3be5'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove a participant from the event
   */
  const removeParticipant = async (
    participationId: string,
    userId?: string,
    senderId?: string,
    eventTitle?: string
  ) => {
    void userId;
    void senderId;
    void eventTitle;

    setIsLoading(true);
    try {
      await waitForClientApply(
        leaveEvent({
          id: participationId,
        })
      );

      toast.success(
        translateText('generated.inline.0457_participant_removed_successfully_4704450f')
      );
      return { success: true };
    } catch (error) {
      console.error('Failed to remove participant:', error);
      toast.error(translateText('generated.inline.0458_failed_to_remove_participant_eb460372'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Change a participant's role
   */
  const changeParticipantRole = async (
    participationId: string,
    roleId: string,
    userId?: string,
    senderId?: string,
    eventTitle?: string,
    isPromotion?: boolean
  ) => {
    return changeParticipantRoles(
      participationId,
      roleId ? [roleId] : [],
      userId,
      senderId,
      eventTitle,
      isPromotion
    );
  };

  /**
   * Change a participant's roles
   */
  const changeParticipantRoles = async (
    participationId: string,
    roleIds: string[],
    userId?: string,
    senderId?: string,
    eventTitle?: string,
    isPromotion?: boolean
  ) => {
    void userId;
    void eventTitle;
    void isPromotion;

    setIsLoading(true);
    try {
      await waitForClientApply(
        syncParticipantRoles({
          event_participant_id: participationId,
          role_ids: roleIds,
          assigned_by_id: senderId ?? null,
        })
      );

      toast.success(translateText('generated.inline.0459_participant_role_updated_4697982e'));
      return { success: true };
    } catch (error) {
      console.error('Failed to change participant role:', error);
      toast.error(
        translateText('generated.inline.0460_failed_to_change_participant_role_008475f2')
      );
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update event details
   */
  const updateEvent = async (
    updates: Partial<EventUpdateInput>,
    options?: {
      actorId?: string;
      eventTitle?: string;
      visibility?: string;
      previousImageURL?: string;
      previousVideoURL?: string;
    }
  ) => {
    void options;

    setIsLoading(true);
    try {
      await waitForClientApply(
        doUpdateEvent({
          id: eventId,
          ...updates,
        })
      );

      toast.success(translateText('generated.inline.0461_event_updated_successfully_bc659249'));
      return { success: true };
    } catch (error) {
      console.error('Failed to update event:', error);
      toast.error(translateText('generated.inline.0462_failed_to_update_event_db303d38'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    inviteParticipants,
    approveParticipation,
    rejectParticipation,
    removeParticipant,
    changeParticipantRole,
    changeParticipantRoles,
    updateEvent,
    isLoading,
  };
}
