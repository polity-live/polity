import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useEventActions } from '@/zero/events/useEventActions';
import { useEventById, useEventParticipantsQuery } from '@/zero/events/useEventState';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export type ParticipationStatus =
  'invited' | 'requested' | 'active' | 'member' | 'admin' | 'confirmed';

export function useEventParticipation(eventId: string) {
  const { user } = useAuth();
  const { joinEvent, leaveEvent: doLeaveEvent, updateParticipant } = useEventActions();
  const [isLoading, setIsLoading] = useState(false);

  // Query event details including type and group
  const { event, isLoading: eventLoading } = useEventById(eventId);

  const eventType = event?.event_type;

  // Check if user is a member of the event's group
  const isGroupMember = event?.group?.memberships?.some(
    m => m.user?.id === user?.id && (m.status === 'active' || m.status === 'admin')
  );

  // Check if user is a confirmed delegate
  const isConfirmedDelegate = event?.delegates?.some(
    d => d.user?.id === user?.id && d.status === 'confirmed'
  );

  // Query participants
  const { participants: allParticipantsData, isLoading: participantsLoading } =
    useEventParticipantsQuery(eventId);

  const queryLoading = eventLoading || participantsLoading;

  const participation = allParticipantsData?.find(p => p.user_id === user?.id);

  // Filter to count only active participants (excluding invited and requested)
  const allParticipants = allParticipantsData || [];
  const filteredParticipants = allParticipants.filter(
    p =>
      p.status === 'active' ||
      p.status === 'member' ||
      p.status === 'admin' ||
      p.status === 'confirmed'
  );
  const participantCount = filteredParticipants.length;

  const status: ParticipationStatus | null = (participation?.status as ParticipationStatus) || null;
  const isParticipant =
    status === 'active' || status === 'member' || status === 'admin' || status === 'confirmed';
  const isAdmin = status === 'admin';
  const hasRequested = status === 'requested';
  const isInvited = status === 'invited';

  // Request to participate in the event
  const requestParticipation = async () => {
    if (!user?.id || participation) return;

    // Validate eventId is a valid UUID
    if (!eventId || typeof eventId !== 'string') {
      console.error('Invalid eventId:', eventId);
      return;
    }

    // Check participation eligibility based on event type
    if (eventType === 'delegate_assembly') {
      if (!isConfirmedDelegate) {
        toast.error(
          translateText(
            'generated.inline.0466_only_confirmed_delegates_can_participate_in_t_18a6a4d3'
          )
        );
        return;
      }
    } else if (eventType === 'general_assembly') {
      if (!isGroupMember) {
        toast.error(
          translateText(
            'generated.inline.0467_only_members_of_the_associated_group_can_part_03a2dedc'
          )
        );
        return;
      }
    } else if (eventType === 'on_invite') {
      toast.error(translateText('generated.inline.0468_this_event_is_by_invitation_only_904d226e'));
      return;
    }
    // For 'open', everyone can request participation

    setIsLoading(true);
    try {
      const newParticipationId = crypto.randomUUID();

      await waitForClientApply(
        joinEvent({
          id: newParticipationId,
          status: 'requested',
          event_id: eventId,
          group_id: event?.group?.id ?? null,
          visibility: event?.visibility ?? 'public',
        })
      );

      toast.success(
        translateText('generated.inline.0469_participation_request_sent_successfully_239ea238')
      );
    } catch (error) {
      console.error('Failed to request participation:', error);
      console.error('Event ID:', eventId);
      console.error('User ID:', user?.id);
      toast.error(
        translateText(
          'generated.inline.0470_failed_to_request_participation_please_try_ag_3f5ea838'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Leave the event
  const leaveEvent = async () => {
    if (!participation?.id) return;

    setIsLoading(true);
    try {
      await waitForClientApply(doLeaveEvent({ id: participation.id }));
      toast.success(translateText('generated.inline.0471_successfully_left_the_event_a2c899b8'));
    } catch (error) {
      console.error('Failed to leave event:', error);
      toast.error(
        translateText('generated.inline.0472_failed_to_leave_event_please_try_again_8ea27458')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Accept invitation
  const acceptInvitation = async () => {
    if (!participation?.id || status !== 'invited') return;

    setIsLoading(true);
    try {
      await waitForClientApply(
        updateParticipant({
          id: participation.id,
          status: 'active',
        })
      );
      toast.success(translateText('generated.inline.0473_successfully_joined_the_event_f7687c9c'));
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
    participation,
    status,
    isParticipant,
    isAdmin,
    hasRequested,
    isInvited,
    participantCount,
    isLoading: queryLoading || isLoading,
    requestParticipation,
    leaveEvent,
    acceptInvitation,
    eventType,
    isGroupMember,
    isConfirmedDelegate,
    canParticipate:
      eventType === 'open' ||
      (eventType === 'delegate_assembly' && isConfirmedDelegate) ||
      (eventType === 'general_assembly' && isGroupMember),
  };
}
