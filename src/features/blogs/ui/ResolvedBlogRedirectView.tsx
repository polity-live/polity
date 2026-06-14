import { Navigate } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GlobalLoadingAnimation } from '@/features/shared/ui/feedback';

type ResolvedBlogRedirectViewProps =
  | { status: 'loading' }
  | {
      status: 'group';
      to: '/group/$id/blog/$entryId' | '/group/$id/blog/$entryId/notifications';
      params: { id: string; entryId: string };
    }
  | {
      status: 'user';
      to: '/user/$id/blog/$entryId' | '/user/$id/blog/$entryId/notifications';
      params: { id: string; entryId: string };
    }
  | { status: 'denied' };

export function ResolvedBlogRedirectView(props: ResolvedBlogRedirectViewProps) {
  if (props.status === 'loading') {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (props.status === 'group' || props.status === 'user') {
    return <Navigate to={props.to} params={props.params} replace />;
  }

  return <AccessDenied />;
}
