import { useState } from 'react';
import { useStatementActions } from '@/zero/statements/useStatementActions';
import { serverConfirmed } from '@/zero/mutate-with-server-check';

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
    text: string,
    options: {
      groupId?: string | null;
      imageUrl?: string | null;
      videoUrl?: string | null;
      visibility?: 'public' | 'authenticated' | 'private';
    } = {}
  ) => {
    const { groupId, imageUrl, videoUrl, visibility = 'public' } = options;
    setIsLoading(true);
    try {
      const statementId = crypto.randomUUID();

      const createResult = create({
        id: statementId,
        text,
        group_id: groupId ?? null,
        image_url: imageUrl ?? null,
        video_url: videoUrl ?? null,
        visibility,
      });
      await serverConfirmed(createResult);

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
    text: string,
    options: {
      imageUrl?: string | null;
      videoUrl?: string | null;
      visibility?: 'public' | 'authenticated' | 'private';
    } = {}
  ) => {
    const { imageUrl, videoUrl, visibility } = options;
    setIsLoading(true);
    try {
      const updateResult = update({
        id: statementId,
        text,
        ...(imageUrl !== undefined && { image_url: imageUrl }),
        ...(videoUrl !== undefined && { video_url: videoUrl }),
        ...(visibility !== undefined && { visibility }),
      });
      await serverConfirmed(updateResult);

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
      await remove(statementId);
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
