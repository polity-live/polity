'use client';

import { useLoginFormController } from '@/features/auth/hooks/useLoginFormController';
import { LoginFormView } from './LoginFormView';

export function LoginForm() {
  const viewProps = useLoginFormController();
  return <LoginFormView {...viewProps} />;
}
