import { differenceInMinutes, format, formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useStatementDetail } from './useStatementDetail';
import { useStatementEditDialog } from './useStatementEditDialog';

interface UseStatementDetailModelOptions {
  statementId: string;
}

export function useStatementDetailModel({ statementId }: UseStatementDetailModelOptions) {
  const { t } = useTranslation();
  const editDialog = useStatementEditDialog();
  const detail = useStatementDetail({ id: statementId });

  if (detail.isLoading) {
    return {
      status: 'loading' as const,
      labels: {
        loading: t('features.statements.detail.loading'),
      },
    };
  }

  if (!detail.statement) {
    return {
      status: 'not-found' as const,
      labels: {
        notFound: t('features.statements.detail.notFound'),
        notFoundDescription: t('features.statements.detail.notFoundDescription'),
      },
    };
  }

  if (!detail.canAccess) {
    return {
      status: 'access-denied' as const,
    };
  }

  const statement = detail.statement;
  const author = statement.user;
  const group = statement.group;
  const hashtags = extractHashtagTags(statement.statement_hashtags);
  const authorName = author
    ? `${author.first_name ?? ''} ${author.last_name ?? ''}`.trim() || author.handle || 'Unknown'
    : 'Unknown';

  const locale = t('locale') === 'de' ? de : enUS;
  const createdAt = statement.created_at ? new Date(statement.created_at) : null;
  const timeDisplay = (() => {
    if (!createdAt) return null;
    const minutesAgo = differenceInMinutes(new Date(), createdAt);
    if (minutesAgo < 30) return formatDistanceToNow(createdAt, { addSuffix: true, locale });
    return format(createdAt, 'PPp', { locale });
  })();

  const handlePrepareEdit = () => {
    editDialog.prepareEdit({
      text: statement.text,
      imageUrl: statement.image_url,
      videoUrl: statement.video_url,
      visibility: statement.visibility,
      surveyQuestion: detail.survey?.question,
      surveyOptions: detail.survey?.options,
    });
    detail.handleEditOpen();
  };

  const handleConfirmDelete = async () => {
    editDialog.setDeleteOpen(false);
    await detail.handleDelete();
  };

  const handleAddSurveyOption = () => {
    editDialog.setEditSurveyOptions([...editDialog.editSurveyOptions, '']);
  };

  const handleSurveyOptionChange = (index: number, value: string) => {
    const nextOptions = [...editDialog.editSurveyOptions];
    nextOptions[index] = value;
    editDialog.setEditSurveyOptions(nextOptions);
  };

  const handleRemoveSurvey = async () => {
    await detail.handleDeleteSurvey();
    editDialog.resetSurvey();
  };

  const handleSaveEdit = async () => {
    await detail.handleUpdate(editDialog.editText.trim(), {
      imageUrl: editDialog.editImageUrl || null,
      videoUrl: editDialog.editVideoUrl || null,
      visibility: editDialog.editVisibility,
    });

    const validOptions = editDialog.editSurveyOptions.filter(option => option.trim());
    if (editDialog.editSurveyQuestion.trim() && validOptions.length >= 2) {
      await detail.handleSaveSurvey(
        editDialog.editSurveyQuestion,
        editDialog.editSurveyOptions,
        editDialog.editSurveyDuration
      );
    }
  };

  return {
    status: 'ready' as const,
    author,
    authorName,
    comments: detail.comments,
    computedCommentCount: detail.computedCommentCount,
    computedDownvotes: detail.computedDownvotes,
    computedUpvotes: detail.computedUpvotes,
    currentVoteValue: detail.currentVoteValue,
    editDialog,
    group,
    hashtags,
    isEditOpen: detail.isEditOpen,
    isOwner: detail.isOwner,
    labels: {
      addOption: t('features.statements.survey.addOption'),
      addSurvey: t('features.statements.survey.addSurvey'),
      authorByline: t('features.statements.view.by', { author: authorName }),
      cancel: t('common.actions.cancel'),
      charsRemaining: t('features.statements.charsRemaining', {
        count: 280 - editDialog.editText.length,
      }),
      comments: t('features.statements.comments.title'),
      delete: t('common.actions.delete'),
      deleteAction: t('features.statements.actions.delete'),
      deleteConfirmDescription: t('features.statements.actions.deleteConfirmDescription'),
      deleteConfirmTitle: t('features.statements.actions.deleteConfirmTitle'),
      duration: t('features.statements.survey.duration'),
      edit: t('features.statements.actions.edit'),
      formText: t('features.statements.form.text'),
      option: t('features.statements.survey.option'),
      question: t('features.statements.survey.question'),
      removeSurvey: t('features.statements.survey.remove'),
      save: t('common.actions.save'),
    },
    statement,
    statementId,
    survey: detail.survey,
    timeDisplay,
    userId: detail.userId,
    onAddComment: detail.handleAddComment,
    onAddSurveyOption: handleAddSurveyOption,
    onCloseEdit: detail.handleEditClose,
    onCommentVote: detail.handleCommentVote,
    onConfirmDelete: handleConfirmDelete,
    onDeleteOpenChange: editDialog.setDeleteOpen,
    onPrepareEdit: handlePrepareEdit,
    onRemoveSurvey: handleRemoveSurvey,
    onSaveEdit: handleSaveEdit,
    onSurveyDurationChange: editDialog.setEditSurveyDuration,
    onSurveyOptionChange: handleSurveyOptionChange,
    onSurveyQuestionChange: editDialog.setEditSurveyQuestion,
    onSurveyRetract: detail.handleSurveyRetract,
    onSurveyVote: detail.handleSurveyVote,
    onUpdateEditImageUrl: editDialog.setEditImageUrl,
    onUpdateEditText: editDialog.setEditText,
    onUpdateEditVideoUrl: editDialog.setEditVideoUrl,
    onUpdateEditVisibility: editDialog.setEditVisibility,
    onVote: detail.handleVote,
  };
}

export type StatementDetailModel = ReturnType<typeof useStatementDetailModel>;
