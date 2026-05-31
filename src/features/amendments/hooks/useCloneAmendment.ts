import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import type { PathWithEventSegment } from '@/features/amendments/logic/amendmentPathHelpers';
import { notifyAmendmentCloned } from '@/features/notifications/utils/notification-helpers.ts';

interface CloneAmendmentDocument {
  readonly content: ReadonlyJSONValue | null;
}

interface CloneAmendmentData {
  readonly title: string | null;
  readonly code: string | null;
  readonly reason: string | null;
  readonly category: string | null;
  readonly preamble: string | null;
  readonly tags: string[] | null;
  readonly visibility: string;
  readonly editing_mode: string | null;
  readonly discussions: ReadonlyJSONValue | null;
  readonly image_url: string | null;
  readonly documents: readonly CloneAmendmentDocument[];
}

interface CloneSelection {
  groupId: string | null;
  groupData: { id: string; name?: string | null; description?: string | null } | null;
  eventId: string | null;
  eventData: { id: string; title?: string | null } | null;
  collaboratorUserId: string;
  pathWithEvents: PathWithEventSegment[];
  workflowId: string | null;
}

export function useCloneAmendment(
  amendmentId: string,
  amendment: CloneAmendmentData | null | undefined,
  userId: string | undefined,
  userEmail: string | undefined
) {
  const navigate = useNavigate();
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const {
    createAmendment,
    requestCollaboration: addAmendmentCollaborator,
    createPath,
    createPathSegment,
  } = useAmendmentActions();
  const { createDocument } = useDocumentActions();
  const { createAgendaItem } = useAgendaActions();

  const handleClone = () => {
    if (!userId) {
      toast.error('Please log in to clone this amendment');
      return;
    }
    setCloneDialogOpen(true);
  };

  const handleConfirmClone = async (selection: CloneSelection) => {
    if (!userId) {
      toast.error('Please log in to clone this amendment');
      return;
    }
    if (!amendment) {
      toast.error('Amendment data not loaded');
      return;
    }

    const {
      groupId: targetGroupId,
      eventId: selectedEventId,
      pathWithEvents,
      workflowId,
    } = selection;

    setIsCloning(true);
    try {
      const cloneId = crypto.randomUUID();
      const cloneDocumentId = crypto.randomUUID();
      const collaboratorId = crypto.randomUUID();
      const pathId = crypto.randomUUID();

      const originalDocument = amendment.documents?.[0];

      // Find the closest event in the path
      const eventsWithDates = pathWithEvents.filter(seg => seg.eventStartDate != null);
      eventsWithDates.sort((a, b) => {
        const dateA = a.eventStartDate ? new Date(a.eventStartDate).getTime() : 0;
        const dateB = b.eventStartDate ? new Date(b.eventStartDate).getTime() : 0;
        return dateA - dateB;
      });
      const closestEventId = eventsWithDates.length > 0 ? eventsWithDates[0].eventId : null;

      // Create agenda items and votes for each event in the path when a full target was selected.
      const enrichedPath = [];

      for (const segment of selectedEventId ? pathWithEvents : []) {
        let agendaItemId = null;
        let amendmentVoteId = null;
        let forwardingStatus = 'previous_decision_outstanding';

        if (segment.eventId) {
          agendaItemId = crypto.randomUUID();
          amendmentVoteId = crypto.randomUUID();

          if (segment.eventId === closestEventId) {
            forwardingStatus = 'forward_confirmed';
          }

          await createAgendaItem({
            id: agendaItemId,
            title: `Amendment: ${amendment.title ?? ''} (Clone)`,
            description: amendment.reason ?? '',
            type: 'amendment',
            status: 'pending',
            forwarding_status: forwardingStatus,
            order_index: 999,
            duration: 0,
            scheduled_time: '',
            start_time: 0,
            end_time: 0,
            activated_at: 0,
            completed_at: 0,
            event_id: segment.eventId,
            amendment_id: cloneId,
            majority_type: null,
            time_limit: null,
            voting_phase: null,
          });

          // TODO: Wire up to new vote model if needed
          // Old castAmendmentVote removed with voting migration
        }

        enrichedPath.push({
          ...segment,
          agendaItemId,
          amendmentVoteId,
          forwardingStatus,
        });
      }

      // Create cloned document first so amendment can reference it
      await createDocument({
        id: cloneDocumentId,
        amendment_id: null,
        content: originalDocument?.content ?? { type: 'doc', content: [] },
        editing_mode: 'collaborative',
      });

      // Create cloned amendment
      await createAmendment({
        id: cloneId,
        title: `${amendment.title ?? ''} (Clone)`,
        code: amendment.code ? `${amendment.code}-CLONE` : '',
        reason: amendment.reason ?? '',
        category: amendment.category ?? '',
        preamble: amendment.preamble ?? '',
        group_id: targetGroupId,
        event_id: selectedEventId,
        clone_source_id: amendmentId,
        document_id: cloneDocumentId,
        tags: amendment.tags ?? [],
        visibility: amendment.visibility ?? 'public',
        editing_mode: 'edit',
        discussions: amendment.discussions ?? [],
        x: '',
        youtube: '',
        linkedin: '',
        website: '',
        image_url: amendment.image_url ?? null,
      });

      // Add current user as admin collaborator
      await addAmendmentCollaborator({
        id: collaboratorId,
        status: 'admin',
        visibility: 'public',
        amendment_id: cloneId,
        user_id: userId,
        role_id: null,
      });

      if (selectedEventId && enrichedPath.length > 0) {
        await createPath({
          id: pathId,
          amendment_id: cloneId,
          title: '',
          workflow_id: workflowId,
        });

        for (const [index, segment] of enrichedPath.entries()) {
          const segmentId = crypto.randomUUID();
          await createPathSegment({
            id: segmentId,
            path_id: pathId,
            group_id: segment.groupId,
            event_id: segment.eventId ?? null,
            order_index: index,
            status: segment.forwardingStatus,
          });
        }
      }

      // Notify about the clone
      await notifyAmendmentCloned({
        senderId: userId,
        senderName: userEmail || 'Someone',
        originalAmendmentId: amendmentId,
        originalAmendmentTitle: amendment.title ?? '',
        newAmendmentId: cloneId,
      });

      toast.success('Amendment cloned successfully!');
      setCloneDialogOpen(false);
      navigate({ to: `/amendment/${cloneId}` });
    } catch (error) {
      console.error('Error cloning amendment:', error);
      toast.error('Failed to clone amendment');
    } finally {
      setIsCloning(false);
    }
  };

  return {
    cloneDialogOpen,
    setCloneDialogOpen,
    isCloning,
    handleClone,
    handleConfirmClone,
  };
}
