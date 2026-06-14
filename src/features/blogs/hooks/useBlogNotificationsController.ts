import { useBlogState } from '@/zero/blogs/useBlogState';

interface UseBlogNotificationsControllerProps {
  blogId: string;
}

export function useBlogNotificationsController({ blogId }: UseBlogNotificationsControllerProps) {
  const { blog } = useBlogState({ blogId });

  return {
    entityName: blog?.title || 'Blog',
  };
}
