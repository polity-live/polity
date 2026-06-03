import { useState } from 'react';
import { toast } from 'sonner';
import { useEventActions } from '@/zero/events/useEventActions';
import type { EventUpdateInput } from '@/zero/events/schema';

/**
 * Hook for event mutations
 */
export function useEventMutations(eventId: string) {
  const {
    inviteParticipant,
    updateParticipant,
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

      for (const userId of userIds) {
        const participantId = crypto.randomUUID();
        await inviteParticipant({
          id: participantId,
          status: 'invited',
          user_id: userId,
          event_id: eventId,
          group_id: null,
          visibility: 'public',
          initial_role_ids: normalizedRoleIds,
        });
      }

      toast.success(`Successfully invited ${userIds.length} participant(s)`);
      return { success: true };
    } catch (error) {
      console.error('Failed to invite participants:', error);
      toast.error('Failed to invite participants');
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
      await updateParticipant({
        id: participationId,
        status: 'active',
      });

      toast.success('Participation approved');
      return { success: true };
    } catch (error) {
      console.error('Failed to approve participation:', error);
      toast.error('Failed to approve participation');
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
      await leaveEvent({
        id: participationId,
      });

      toast.success('Participation request rejected');
      return { success: true };
    } catch (error) {
      console.error('Failed to reject participation:', error);
      toast.error('Failed to reject participation');
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
      await leaveEvent({
        id: participationId,
      });

      toast.success('Participant removed successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to remove participant:', error);
      toast.error('Failed to remove participant');
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
      await syncParticipantRoles({
        event_participant_id: participationId,
        role_ids: roleIds,
        assigned_by_id: senderId ?? null,
      });

      toast.success('Participant role updated');
      return { success: true };
    } catch (error) {
      console.error('Failed to change participant role:', error);
      toast.error('Failed to change participant role');
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
      await doUpdateEvent({
        id: eventId,
        ...updates,
      });

      toast.success('Event updated successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to update event:', error);
      toast.error('Failed to update event');
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
