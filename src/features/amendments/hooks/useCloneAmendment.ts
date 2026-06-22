import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import type { PathWithEventSegment } from '@/features/amendments/logic/amendmentPathHelpers';
import { notifyAmendmentCloned } from '@/features/notifications/utils/notification-helpers.ts';
import { useCreateAmendmentPath } from './useCreateAmendmentPath';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
  readonly discussions: ReadonlyJSONValue | null;
  readonly image_url: string | null;
  readonly origin_amendment_id?: string | null;
  readonly document?: CloneAmendmentDocument | null;
  readonly documents: readonly CloneAmendmentDocument[];
}

interface CloneSelection {
  sourceGroupId: string | null;
  groupId: string | null;
  groupData: { id: string; name?: string | null; description?: unknown } | null;
  eventId: string | null;
  eventData: { id: string; title?: string | null } | null;
  collaboratorUserId: string;
  pathWithEvents: PathWithEventSegment[];
  pathMode: 'hierarchy' | 'workflow';
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

  const { createAmendment, updateAmendment } = useAmendmentActions();
  const { createDocument } = useDocumentActions();
  const { createAmendmentPath } = useCreateAmendmentPath();

  const handleClone = () => {
    if (!userId) {
      toast.error(
        translateText('generated.inline.0151_please_log_in_to_clone_this_amendment_1b43b556')
      );
      return;
    }
    setCloneDialogOpen(true);
  };

  const handleConfirmClone = async (selection: CloneSelection) => {
    if (!userId) {
      toast.error(
        translateText('generated.inline.0151_please_log_in_to_clone_this_amendment_1b43b556')
      );
      return;
    }
    if (!amendment) {
      toast.error(translateText('generated.inline.0152_amendment_data_not_loaded_cc4bd6c4'));
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

      const originalDocument = amendment.document ?? amendment.documents?.[0];

      // Find the closest event in the path
      const eventsWithDates = pathWithEvents.filter(seg => seg.eventStartDate != null);
      eventsWithDates.sort((a, b) => {
        const dateA = a.eventStartDate ? new Date(a.eventStartDate).getTime() : 0;
        const dateB = b.eventStartDate ? new Date(b.eventStartDate).getTime() : 0;
        return dateA - dateB;
      });
      const closestEventId = eventsWithDates.length > 0 ? eventsWithDates[0].eventId : null;

      // Build the process path. Agenda items and votes are created by the process engine.
      const enrichedPath = [];

      for (const segment of selectedEventId ? pathWithEvents : []) {
        let forwardingStatus = 'previous_decision_outstanding';

        if (segment.eventId) {
          if (segment.eventId === closestEventId) {
            forwardingStatus = 'forward_confirmed';
          }
        }

        enrichedPath.push({
          ...segment,
          agendaItemId: null,
          amendmentVoteId: null,
          forwardingStatus,
        });
      }

      const createAmendmentResult = createAmendment({
        id: cloneId,
        title: translateText('generated.inline.0016_valuea36c_clone_a73c56fa', {
          valuea36c: amendment.title ?? '',
        }),
        code: amendment.code ? `${amendment.code}-CLONE` : '',
        reason: amendment.reason ?? '',
        category: amendment.category ?? '',
        preamble: amendment.preamble ?? '',
        group_id: targetGroupId,
        event_id: selectedEventId,
        clone_source_id: amendmentId,
        origin_amendment_id: amendment.origin_amendment_id ?? amendmentId,
        document_id: null,
        tags: amendment.tags ?? [],
        visibility: amendment.visibility ?? 'public',
        discussions: [],
        x: '',
        youtube: '',
        linkedin: '',
        website: '',
        image_url: amendment.image_url ?? null,
      });
      await serverConfirmed(createAmendmentResult);

      const createDocumentResult = createDocument({
        id: cloneDocumentId,
        amendment_id: cloneId,
        content: originalDocument?.content ?? { type: 'doc', content: [] },
        editing_mode: 'edit',
      });
      await serverConfirmed(createDocumentResult);

      await updateAmendment({
        id: cloneId,
        document_id: cloneDocumentId,
      });

      if (selectedEventId && enrichedPath.length > 0) {
        await createAmendmentPath({
          amendmentId: cloneId,
          amendmentTitle: `${amendment.title ?? ''} (Clone)`,
          amendmentReason: amendment.reason ?? null,
          enrichedPath,
          sourceGroupId: selection.sourceGroupId,
          workflowId,
          pathMode: selection.pathMode,
        });
      }

      // Notify about the clone
      await notifyAmendmentCloned({
        senderId: userId,
        senderName: userEmail || 'Someone',
        originalAmendmentId: amendmentId,
        originalAmendmentTitle: amendment.title ?? '',
        newAmendmentId: cloneId,
      });

      toast.success(translateText('generated.inline.0153_amendment_cloned_successfully_e51bc162'));
      setCloneDialogOpen(false);
      navigate({ to: `/amendment/${cloneId}` });
    } catch (error) {
      console.error('Error cloning amendment:', error);
      toast.error(translateText('generated.inline.0154_failed_to_clone_amendment_85f2f2a1'));
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
