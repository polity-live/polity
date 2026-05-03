import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const unauthorizedSearchSchema = z.object({
  reason: z.enum(['login-required', 'private']).optional(),
});

export const Route = createFileRoute('/unauthorized')({
  validateSearch: unauthorizedSearchSchema,
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  const { t } = useTranslation();
  const { reason } = Route.useSearch();

  if (reason === 'private') {
    return (
      <AccessDenied
        title={t('errors.accessDenied.reasons.private.title')}
        description={t('errors.accessDenied.reasons.private.description')}
      />
    );
  }

  if (reason === 'login-required') {
    return (
      <AccessDenied
        title={t('errors.accessDenied.reasons.loginRequired.title')}
        description={t('errors.accessDenied.reasons.loginRequired.description')}
      />
    );
  }

  return <AccessDenied />;
}
