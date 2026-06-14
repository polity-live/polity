'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { useUserState } from '@/zero/users/useUserState';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  notifyBloggerInvited,
  notifyDocumentCollaboratorInvited,
} from '@/features/notifications/utils/notification-helpers.ts';

import type { EditorEntityType } from '../types';

export interface InviteCollaboratorDialogProps {
  entityType: EditorEntityType;
  entityId: string;
  currentUserId: string;
  entityTitle?: string;
  existingCollaboratorIds?: string[];
}

export function useInviteCollaboratorModel({
  entityType,
  entityId,
  currentUserId,
  entityTitle,
  existingCollaboratorIds = [],
}: InviteCollaboratorDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const { createEntry } = useBlogActions();
  const { addCollaborator } = useDocumentActions();

  // Query all users via facade
  const { allUsers: users, isLoading } = useUserState({ includeAllUsers: true });

  // Filter users based on search and exclude existing collaborators
  const filteredUsers = users?.filter(user => {
    if (!user?.id) return false;
    if (user.id === currentUserId) return false;
    if (existingCollaboratorIds.includes(user.id)) return false;

    const query = searchQuery.toLowerCase();
    return (
      user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query) ||
      user.handle?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleInvite = async () => {
    if (selectedUsers.length === 0) return;

    setIsInviting(true);
    try {
      // Create collaborator/blogger entries
      for (const userId of selectedUsers) {
        if (entityType === 'blog') {
          const bloggerId = crypto.randomUUID();
          await createEntry({
            id: bloggerId,
            blog_id: entityId,
            user_id: userId,
            role_id: null,
            status: 'collaborator',
            visibility: '',
          });
        } else {
          const collaboratorId = crypto.randomUUID();
          await addCollaborator({
            id: collaboratorId,
            document_id: entityId,
            user_id: userId,
            role_id: null,
            status: 'collaborator',
            visibility: '',
          });
        }
      }

      // Send notifications to invited users
      for (const userId of selectedUsers) {
        if (entityType === 'blog') {
          await notifyBloggerInvited({
            senderId: currentUserId,
            recipientUserId: userId,
            blogId: entityId,
            blogTitle: entityTitle || 'Blog',
          });
        } else {
          await notifyDocumentCollaboratorInvited({
            senderId: currentUserId,
            recipientUserId: userId,
            documentId: entityId,
            documentTitle: entityTitle || 'Document',
          });
        }
      }

      const message =
        selectedUsers.length === 1
          ? t('features.editor.inviteDialog.invitedOne')
          : t('features.editor.inviteDialog.invitedMultiple').replace(
              '{{count}}',
              String(selectedUsers.length)
            );

      toast.success(message);

      // Reset state
      setSelectedUsers([]);
      setSearchQuery('');
      setOpen(false);
    } catch (error) {
      console.error('Failed to invite collaborators:', error);
      toast.error(t('features.editor.inviteDialog.inviteFailed'));
    } finally {
      setIsInviting(false);
    }
  };

  return {
    filteredUsers,
    handleInvite,
    isInviting,
    isLoading,
    open,
    searchQuery,
    selectedUsers,
    setOpen,
    setSearchQuery,
    toggleUserSelection,
    users,
  };
}

export type InviteCollaboratorModel = ReturnType<typeof useInviteCollaboratorModel>;
