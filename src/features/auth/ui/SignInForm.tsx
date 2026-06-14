'use client';

import { useSignInFormController } from '@/features/auth/hooks/useSignInFormController';
import { SignInFormView } from './SignInFormView';

export function SignInForm() {
  const viewProps = useSignInFormController();
  return <SignInFormView {...viewProps} />;
}
