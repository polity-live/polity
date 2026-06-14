'use client';

import { useSignUpFormController } from '@/features/auth/hooks/useSignUpFormController';
import { SignUpFormView } from './SignUpFormView';

export function SignUpForm() {
  const viewProps = useSignUpFormController();
  return <SignUpFormView {...viewProps} />;
}
