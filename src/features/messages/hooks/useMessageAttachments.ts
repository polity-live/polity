import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUploadFile } from '@/features/file-upload/hooks/use-upload-file';
import { buildAgendaItemsByEventId } from '@/features/search/logic/searchFiltering';
import { mapMosaicToContentItems } from '@/features/search/logic/searchMappers';
import { useSearchData } from '@/features/search/hooks/useSearchData';
import type { SearchContentItem, SearchResultItem } from '@/features/search/types/search.types';
import type { AiAttachmentEntity, AiChatAttachment } from '@/lib/ai/schemas';
import { useVoteState } from '@/zero/votes/useVoteState';
import {
  buildAssistantAttachmentOption,
  buildVoteSearchItem,
  type AssistantAttachmentOption,
} from '../logic/assistantComposer';
import { buildUploadAttachment } from '../logic/uploadAttachmentCard';

function dedupeAttachments(attachments: readonly AiChatAttachment[]): AiChatAttachment[] {
  const uniqueAttachments = new Map<string, AiChatAttachment>();

  for (const attachment of attachments) {
    uniqueAttachments.set(`${attachment.entityType}:${attachment.entityId}`, attachment);
  }

  return [...uniqueAttachments.values()];
}

export function useMessageAttachments(resetKey?: string) {
  const { data } = useSearchData();
  const { votesWithDetails } = useVoteState({ includeVotesWithDetails: true });
  const { uploadFile, isUploading, uploadingFile } = useUploadFile();
  const [selectedAttachments, setSelectedAttachments] = useState<AiChatAttachment[]>([]);

  const agendaItemsByEventId = useMemo(
    () =>
      buildAgendaItemsByEventId(
        (data?.agendaItems ?? []) as Parameters<typeof buildAgendaItemsByEventId>[0]
      ),
    [data?.agendaItems]
  );

  const mosaicResults = useMemo<SearchResultItem[]>(
    () => [
      ...(data?.$users ?? []).map(item => ({ ...item, _type: 'user' as const })),
      ...(data?.groups ?? []).map(item => ({ ...item, _type: 'group' as const })),
      ...(data?.statements ?? []).map(item => ({ ...item, _type: 'statement' as const })),
      ...(data?.blogs ?? []).map(item => ({ ...item, _type: 'blog' as const })),
      ...(data?.amendments ?? []).map(item => ({ ...item, _type: 'amendment' as const })),
      ...(data?.events ?? []).map(item => ({ ...item, _type: 'event' as const })),
      ...(data?.todos ?? []).map(item => ({ ...item, _type: 'todo' as const })),
      ...(data?.elections ?? []).map(item => ({ ...item, _type: 'election' as const })),
    ],
    [
      data?.$users,
      data?.groups,
      data?.statements,
      data?.blogs,
      data?.amendments,
      data?.events,
      data?.todos,
      data?.elections,
    ]
  );

  const searchItems = useMemo<SearchContentItem[]>(() => {
    const baseItems = mapMosaicToContentItems(mosaicResults, agendaItemsByEventId);
    const voteItems = votesWithDetails.map(buildVoteSearchItem);
    return [...baseItems, ...voteItems];
  }, [agendaItemsByEventId, mosaicResults, votesWithDetails]);

  const attachmentOptions = useMemo(
    () =>
      searchItems
        .map(buildAssistantAttachmentOption)
        .filter((option): option is AssistantAttachmentOption => option !== null),
    [searchItems]
  );

  const attachmentCardDataByKey = useMemo(() => {
    const cardData = new Map<string, string>();

    for (const option of attachmentOptions) {
      if (option.attachment.card_data_json) {
        cardData.set(option.key, option.attachment.card_data_json);
      }
    }

    return cardData;
  }, [attachmentOptions]);

  useEffect(() => {
    setSelectedAttachments([]);
  }, [resetKey]);

  const addAttachment = useCallback((option: AssistantAttachmentOption) => {
    setSelectedAttachments(currentAttachments =>
      dedupeAttachments([...currentAttachments, option.attachment])
    );
  }, []);

  const removeAttachment = useCallback((entityType: AiAttachmentEntity, entityId: string) => {
    setSelectedAttachments(currentAttachments =>
      currentAttachments.filter(
        attachment => attachment.entityType !== entityType || attachment.entityId !== entityId
      )
    );
  }, []);

  const clearAttachments = useCallback(() => {
    setSelectedAttachments([]);
  }, []);

  const addUploadedFiles = useCallback(
    async (files: readonly File[]): Promise<AiChatAttachment[]> => {
      const uploadedAttachments: AiChatAttachment[] = [];

      for (const file of files) {
        try {
          const uploadedFile = await uploadFile(file);
          uploadedAttachments.push(buildUploadAttachment(uploadedFile));
        } catch (error) {
          console.error('Failed to upload chat attachment:', error);
        }
      }

      if (uploadedAttachments.length > 0) {
        setSelectedAttachments(currentAttachments =>
          dedupeAttachments([...currentAttachments, ...uploadedAttachments])
        );
      }

      return uploadedAttachments;
    },
    [uploadFile]
  );

  const resolveAttachmentCardData = useCallback(
    (entityType: AiAttachmentEntity, entityId: string): string | null =>
      attachmentCardDataByKey.get(`${entityType}:${entityId}`) ?? null,
    [attachmentCardDataByKey]
  );

  return {
    selectedAttachments,
    attachmentOptions,
    resolveAttachmentCardData,
    addAttachment,
    removeAttachment,
    clearAttachments,
    addUploadedFiles,
    isUploadingAttachments: isUploading,
    uploadingAttachmentName: uploadingFile?.name ?? null,
  };
}
