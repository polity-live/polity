import { createFileRoute } from '@tanstack/react-router';

import { ResetPasswordForm } from '@/features/auth/ui/ResetPasswordForm';

export const Route = createFileRoute('/auth/reset-password')({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
