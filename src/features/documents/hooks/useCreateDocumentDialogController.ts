import type { KeyboardEvent } from 'react';
import { useState } from 'react';

interface UseCreateDocumentDialogControllerOptions {
  onCreateDocument: (title: string) => Promise<void>;
  isCreating: boolean;
}

export function useCreateDocumentDialogController({
  onCreateDocument,
  isCreating,
}: UseCreateDocumentDialogControllerOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) return;

    await onCreateDocument(title);
    setTitle('');
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isCreating) {
      void handleCreate();
    }
  };

  return {
    isOpen,
    onCreate: handleCreate,
    onKeyDown: handleKeyDown,
    onOpenChange: setIsOpen,
    onTitleChange: setTitle,
    title,
  };
}
