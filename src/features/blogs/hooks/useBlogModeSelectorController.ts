import type { EditorMode } from '@/features/editor/types';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';

interface UseBlogModeSelectorControllerProps {
  blogId: string;
}

export function useBlogModeSelectorController({ blogId }: UseBlogModeSelectorControllerProps) {
  const { t } = useTranslation();
  const { updateBlog } = useBlogActions();

  const handleModeChange = async (newMode: EditorMode) => {
    await waitForClientApply(
      updateBlog({
        id: blogId,
        editing_mode: newMode,
      })
    );

    toast.success(t('features.blogs.modeSelector.title'));
  };

  return { handleModeChange };
}
