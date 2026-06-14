'use client';

import { useForgotPasswordFormController } from '@/features/auth/hooks/useForgotPasswordFormController';
import { ForgotPasswordFormView } from './ForgotPasswordFormView';

export function ForgotPasswordForm() {
  const viewProps = useForgotPasswordFormController();
  return <ForgotPasswordFormView {...viewProps} />;
}
