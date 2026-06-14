'use client';

import { VersionControl as EditorVersionControl } from '@/features/editor/ui/VersionControl';
import type { Value } from 'platejs';

interface VersionControlProps {
  blogId: string;
  currentContent: Value;
  currentUserId: string;
  onRestoreVersion: (content: Value) => void;
}

export function VersionControl({
  blogId,
  currentContent,
  currentUserId,
  onRestoreVersion,
}: VersionControlProps) {
  return (
    <EditorVersionControl
      entityType="blog"
      entityId={blogId}
      currentContent={currentContent}
      currentUserId={currentUserId}
      onRestoreVersion={onRestoreVersion}
    />
  );
}
