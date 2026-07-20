'use client';

import { useResetPasswordFormController } from '@/features/auth/hooks/useResetPasswordFormController';
import { ResetPasswordFormView } from './ResetPasswordFormView';

export function ResetPasswordForm() {
  return <ResetPasswordFormView {...useResetPasswordFormController()} />;
}
