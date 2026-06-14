'use client';

import { VersionControl as EditorVersionControl } from '@/features/editor/ui/VersionControl';
import { notifyVersionCreated } from '@/features/notifications/utils/notification-helpers.ts';
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
  const handleVersionCreated = async ({ versionNumber }: { versionNumber: number }) => {
    if (!amendmentId) {
      return;
    }

    await notifyVersionCreated({
      senderId: currentUserId,
      amendmentId,
      amendmentTitle: amendmentTitle || 'Untitled Amendment',
      version: `v.${versionNumber}`,
    });
  };

  return (
    <EditorVersionControl
      entityType="amendment"
      entityId={documentId}
      currentContent={currentContent}
      currentUserId={currentUserId}
      onRestoreVersion={onRestoreVersion}
      amendmentId={amendmentId}
      amendmentTitle={amendmentTitle}
      onVersionCreated={handleVersionCreated}
    />
  );
}
