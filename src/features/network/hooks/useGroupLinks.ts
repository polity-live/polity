/**
 * Hook for managing group links
 */

import { useState } from 'react';
import { useGroupLinks as useFacadeGroupLinks } from '@/zero/groups/useGroupState';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useCommonActions } from '@/zero/common/useCommonActions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function useGroupLinks(groupId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const { links, isLoading: isQuerying } = useFacadeGroupLinks(groupId);
  const { createLink: createLinkAction, deleteLink: deleteLinkAction } = useCommonActions();

  const addLink = async (label: string, url: string, senderId?: string) => {
    setIsLoading(true);
    try {
      const linkId = crypto.randomUUID();
      await waitForClientApply(
        createLinkAction({
          id: linkId,
          label,
          url,
          group_id: groupId,
          user_id: senderId || null,
          event_id: null,
        })
      );

      toast.success(translateText('generated.inline.0757_link_added_successfully_d2837d5b'));
      return { success: true, linkId };
    } catch (error) {
      console.error('Failed to add link:', error);
      toast.error(translateText('generated.inline.0758_failed_to_add_link_202f4443'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteLink = async (linkId: string) => {
    setIsLoading(true);
    try {
      await waitForClientApply(deleteLinkAction({ id: linkId }));

      toast.success(translateText('generated.inline.0759_link_deleted_successfully_6135a6f8'));
      return { success: true };
    } catch (error) {
      console.error('Failed to delete link:', error);
      toast.error(translateText('generated.inline.0760_failed_to_delete_link_e0419b8b'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    links,
    addLink,
    deleteLink,
    isLoading: isLoading || isQuerying,
  };
}
