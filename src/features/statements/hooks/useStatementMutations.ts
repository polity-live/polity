import { useState } from 'react';
import { useStatementActions } from '@/zero/statements/useStatementActions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { deriveStatementMediaType } from '@/zero/statements/content';

/**
 * Hook for statement mutations.
 * Server-side mutator overrides own cross-domain timeline side effects.
 */
export function useStatementMutations() {
  const {
    createStatement: create,
    updateStatement: update,
    deleteStatement: remove,
    createSupportVote,
    updateSupportVote,
    deleteSupportVote,
    createSurvey,
    deleteSurvey,
    createSurveyOption,
    deleteSurveyOption,
    createSurveyVote,
    deleteSurveyVote,
  } = useStatementActions();
  const [isLoading, setIsLoading] = useState(false);

  const createStatement = async (
    text: string | null,
    options: {
      groupId?: string | null;
      imageUrl?: string | null;
      isStory?: boolean;
      title?: string | null;
      videoUrl?: string | null;
      visibility?: 'public' | 'authenticated' | 'private';
    } = {}
  ) => {
    const { groupId, imageUrl, isStory = false, title, videoUrl, visibility = 'public' } = options;
    setIsLoading(true);
    try {
      const statementId = crypto.randomUUID();
      const mediaType = deriveStatementMediaType(imageUrl, videoUrl);

      const createResult = create({
        id: statementId,
        title: title?.trim() || null,
        text: text?.trim() || null,
        group_id: groupId ?? null,
        image_url: imageUrl ?? null,
        media_type: mediaType,
        is_story: isStory,
        expires_at: null,
        video_url: videoUrl ?? null,
        visibility,
      });
      await waitForClientApply(createResult);

      return { success: true, statementId };
    } catch (error) {
      console.error('Failed to create statement:', error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatement = async (
    statementId: string,
    text: string | null,
    options: {
      imageUrl?: string | null;
      isStory?: boolean;
      title?: string | null;
      videoUrl?: string | null;
      visibility?: 'public' | 'authenticated' | 'private';
    } = {}
  ) => {
    const { imageUrl, isStory, title, videoUrl, visibility } = options;
    setIsLoading(true);
    try {
      const updateResult = update({
        id: statementId,
        text: text?.trim() || null,
        ...(title !== undefined && { title: title?.trim() || null }),
        ...(imageUrl !== undefined && { image_url: imageUrl }),
        ...(videoUrl !== undefined && { video_url: videoUrl }),
        ...(imageUrl !== undefined || videoUrl !== undefined
          ? { media_type: deriveStatementMediaType(imageUrl, videoUrl) }
          : {}),
        ...(isStory !== undefined && { is_story: isStory, expires_at: null }),
        ...(visibility !== undefined && { visibility }),
      });
      await waitForClientApply(updateResult);

      return { success: true };
    } catch (error) {
      console.error('Failed to update statement:', error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteStatement = async (statementId: string) => {
    setIsLoading(true);
    try {
      await waitForClientApply(remove(statementId));
      return { success: true };
    } catch (error) {
      console.error('Failed to delete statement:', error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createStatement,
    updateStatement,
    deleteStatement,
    createSupportVote,
    updateSupportVote,
    deleteSupportVote,
    createSurvey,
    deleteSurvey,
    createSurveyOption,
    deleteSurveyOption,
    createSurveyVote,
    deleteSurveyVote,
    isLoading,
  };
}
