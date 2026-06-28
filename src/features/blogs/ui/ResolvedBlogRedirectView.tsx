import { Navigate } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import type { CreateRecoveryDraft } from '@/features/create/logic/createFinalization';
import { CreateRecoveryState } from '@/features/create/ui/CreateRecoveryState';
import { PageSkeleton } from '@/features/shared/ui/feedback';

type ResolvedBlogRedirectViewProps =
  | { status: 'loading' }
  | { status: 'recovery'; draft: CreateRecoveryDraft }
  | {
      status: 'group';
      to:
        | '/group/$id/blog/$entryId'
        | '/group/$id/blog/$entryId/notifications'
        | '/group/$id/blog/$entryId/edit';
      params: { id: string; entryId: string };
    }
  | {
      status: 'user';
      to:
        | '/user/$id/blog/$entryId'
        | '/user/$id/blog/$entryId/notifications'
        | '/user/$id/blog/$entryId/edit';
      params: { id: string; entryId: string };
    }
  | { status: 'denied' };

export function ResolvedBlogRedirectView(props: ResolvedBlogRedirectViewProps) {
  if (props.status === 'loading') {
    return <PageSkeleton />;
  }

  if (props.status === 'recovery') {
    return <CreateRecoveryState draft={props.draft} />;
  }

  if (props.status === 'group' || props.status === 'user') {
    return <Navigate to={props.to} params={props.params} replace />;
  }

  return <AccessDenied />;
}
