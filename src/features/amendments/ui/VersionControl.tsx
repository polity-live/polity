'use client';

import { VersionControl as EditorVersionControl } from '@/features/editor/ui/VersionControl';
import type { Value } from 'platejs';

interface VersionControlProps {
  documentId: string;
  currentContent: Value;
  currentUserId: string;
  onRestoreVersion: (content: Value) => void;
  amendmentId?: string;
  amendmentTitle?: string;
}

export function VersionControl({
  documentId,
  currentContent,
  currentUserId,
  onRestoreVersion,
  amendmentId,
  amendmentTitle,
}: VersionControlProps) {
  return (
    <EditorVersionControl
      entityType="amendment"
      entityId={documentId}
      currentContent={currentContent}
      currentUserId={currentUserId}
      onRestoreVersion={onRestoreVersion}
      amendmentId={amendmentId}
      amendmentTitle={amendmentTitle}
    />
  );
}
