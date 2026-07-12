/**
 * Document Mutations Hook
 *
 * Manages document CRUD operations (create, update, delete).
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface UseDocumentMutationsResult {
  createDocument: (title: string, groupId: string, userId: string) => Promise<string | null>;
  deleteDocument: (documentId: string) => Promise<boolean>;
  isCreating: boolean;
  isDeleting: boolean;
}

/**
 * Hook for managing document mutations
 *
 * @param groupId - ID of the group (for navigation after creation)
 * @returns Mutation functions and loading states
 *
 * @example
 * const { createDocument, isCreating } = useDocumentMutations(groupId);
 * const docId = await createDocument('My Document', groupId, userId);
 */
export function useDocumentMutations(_groupId: string): UseDocumentMutationsResult {
  void _groupId;

  const navigate = useNavigate();
  const {
    createDocument: createDocAction,
    deleteDocument: deleteDocAction,
    addCollaborator,
  } = useDocumentActions();
  const { createAmendment } = useAmendmentActions();
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Create a new document
   */
  const createDocument = async (
    title: string,
    groupId: string,
    userId: string,
    _groupName?: string,
    _adminUserIds?: string[]
  ): Promise<string | null> => {
    void _groupName;
    void _adminUserIds;

    if (!title.trim()) {
      toast.error(translateText('generated.inline.0399_please_enter_a_document_title_0f6a0dd5'));
      return null;
    }

    setIsCreating(true);

    try {
      // Create an amendment as the group-linking container for this document.
      // Documents are associated with groups through amendment.group_id, so we
      // must create a minimal amendment first, then attach the document to it.
      const amendmentId = crypto.randomUUID();
      await waitForClientApply(
        createAmendment({
          id: amendmentId,
          title,
          group_id: groupId,
          visibility: 'group',
          code: null,
          reason: null,
          category: null,
          preamble: null,
          event_id: null,
          clone_source_id: null,
          document_id: null,
          country: null,
          region: null,
          post_code: null,
          city: null,
          street: null,
          house_number: null,
          latitude: null,
          longitude: null,
          tags: null,
          discussions: null,
          image_url: null,
          video_url: null,
          x: null,
          youtube: null,
          linkedin: null,
          website: null,
        })
      );

      const docId = crypto.randomUUID();
      await waitForClientApply(
        createDocAction({
          id: docId,
          amendment_id: amendmentId,
          content: [
            {
              type: 'h1',
              children: [{ text: title }],
            },
            {
              type: 'p',
              children: [{ text: 'Start writing your document...' }],
            },
          ],
          editing_mode: 'single',
        })
      );

      // Add creator as collaborator so the document is user-attributed.
      await waitForClientApply(
        addCollaborator({
          id: crypto.randomUUID(),
          document_id: docId,
          user_id: userId,
          role_id: null,
          status: 'active',
          visibility: 'group',
        })
      );

      toast.success(translateText('generated.inline.0400_document_created_successfully_730aa2a8'));

      // Navigate to the new document
      navigate({ to: `/group/${groupId}/editor/${docId}` });

      return docId;
    } catch (error) {
      console.error('Failed to create document:', error);
      toast.error(translateText('generated.inline.0401_failed_to_create_document_c9b3aacf'));
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Delete a document
   */
  const deleteDocument = async (
    documentId: string,
    _documentTitle?: string,
    _senderId?: string,
    _groupName?: string,
    _adminUserIds?: string[]
  ): Promise<boolean> => {
    void _documentTitle;
    void _senderId;
    void _groupName;
    void _adminUserIds;

    setIsDeleting(true);

    try {
      await waitForClientApply(deleteDocAction(documentId));

      toast.success(translateText('generated.inline.0402_document_deleted_successfully_1e20dc3e'));
      return true;
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast.error(translateText('generated.inline.0403_failed_to_delete_document_8d53b1b5'));
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    createDocument,
    deleteDocument,
    isCreating,
    isDeleting,
  };
}
