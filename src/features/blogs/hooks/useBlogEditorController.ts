import { useEffect, useState } from 'react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useBlogState } from '@/zero/blogs/useBlogState';
import { waitForClientApply } from '@/zero/mutate-with-server-check';

interface UseBlogEditorControllerOptions {
  blogId: string;
}

export function useBlogEditorController({ blogId }: UseBlogEditorControllerOptions) {
  const { blog } = useBlogState({ blogId });
  const { updateBlog } = useBlogActions();
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (blog?.content) {
      setContent(blog.content as string);
    }
  }, [blog]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await waitForClientApply(
        updateBlog({
          id: blogId,
          content,
        })
      );
      toast.success(
        translateText('generated.inline.0265_blog_content_saved_successfully_53103bde')
      );
    } catch (error) {
      console.error('Error saving blog content:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    blogTitle: blog?.title,
    content,
    isLoaded: Boolean(blog),
    isSaving,
    onContentChange: setContent,
    onSave: handleSave,
  };
}
