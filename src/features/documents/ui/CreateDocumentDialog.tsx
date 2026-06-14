import { useState } from 'react';

import { CreateDocumentDialogView } from './CreateDocumentDialogView';

interface CreateDocumentDialogProps {
  groupId: string;
  groupName?: string;
  onCreateDocument: (title: string) => Promise<void>;
  isCreating?: boolean;
}

export function CreateDocumentDialog({
  groupName,
  onCreateDocument,
  isCreating = false,
}: CreateDocumentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) return;

    await onCreateDocument(title);
    setTitle('');
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isCreating) {
      handleCreate();
    }
  };

  return (
    <CreateDocumentDialogView
      groupName={groupName}
      isCreating={isCreating}
      isOpen={isOpen}
      onCreate={handleCreate}
      onKeyDown={handleKeyDown}
      onOpenChange={setIsOpen}
      onTitleChange={setTitle}
      title={title}
    />
  );
}
