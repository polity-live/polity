import { useResolvedBlogRedirectController } from '../hooks/useResolvedBlogRedirectController';
import { ResolvedBlogRedirectView } from './ResolvedBlogRedirectView';

interface ResolvedBlogRedirectProps {
  blogId: string;
  target?: 'detail' | 'notifications';
}

export function ResolvedBlogRedirect({ blogId, target = 'detail' }: ResolvedBlogRedirectProps) {
  const viewProps = useResolvedBlogRedirectController({ blogId, target });

  return <ResolvedBlogRedirectView {...viewProps} />;
}
