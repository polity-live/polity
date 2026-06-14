import { useState } from 'react';

import { useUploadFile } from '@/features/file-upload/hooks/use-upload-file.ts';

interface UseCreateThreadDialogControllerProps {
  amendmentId: string;
  userId?: string;
  onOpenChange: (open: boolean) => void;
  onCreateThread: (
    amendmentId: string,
    title: string,
    description: string,
    userId: string,
    fileId?: string
  ) => Promise<string>;
}

export function useCreateThreadDialogController({
  amendmentId,
  userId,
  onOpenChange,
  onCreateThread,
}: UseCreateThreadDialogControllerProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { uploadFile, isUploading } = useUploadFile();

  const handleSubmit = async () => {
    if (!title.trim() || !userId) return;

    setIsSubmitting(true);
    try {
      let uploadedFileId: string | null = null;
      if (selectedFile) {
        try {
          const uploadResult = await uploadFile(selectedFile);
          uploadedFileId = uploadResult?.key ?? null;
        } catch (error) {
          console.error('Error uploading file:', error);
        }
      }

      await onCreateThread(amendmentId, title, description, userId, uploadedFileId || undefined);

      setTitle('');
      setDescription('');
      setSelectedFile(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating thread:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    description,
    isSubmitting,
    isUploading,
    selectedFile,
    title,
    onDescriptionChange: setDescription,
    onFileChange: setSelectedFile,
    onRemoveFile: () => setSelectedFile(null),
    onSubmit: handleSubmit,
    onTitleChange: setTitle,
  };
}
