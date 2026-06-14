'use client';

import { ModeSelector as EditorModeSelector } from '@/features/editor/ui/ModeSelector';
import type { EditorMode } from '@/features/editor/types';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { toast } from '@/features/shared/ui/ui/sonner';

interface ModeSelectorProps {
  blogId: string;
  currentMode: EditorMode | string;
  isOwnerOrCollaborator: boolean;
}

export function ModeSelector({ blogId, currentMode, isOwnerOrCollaborator }: ModeSelectorProps) {
  const { t } = useTranslation();
  const { updateBlog } = useBlogActions();

  const handleModeChange = async (newMode: EditorMode) => {
    await updateBlog({
      id: blogId,
      editing_mode: newMode,
    });

    toast.success(t('features.blogs.modeSelector.title'));
  };

  return (
    <EditorModeSelector
      entityType="blog"
      entityId={blogId}
      currentMode={currentMode}
      isOwnerOrCollaborator={isOwnerOrCollaborator}
      onModeChange={handleModeChange}
    />
  );
}
