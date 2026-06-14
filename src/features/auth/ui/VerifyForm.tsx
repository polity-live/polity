'use client';

import { useVerifyFormController } from '@/features/auth/hooks/useVerifyFormController';
import { VerifyFormView } from './VerifyFormView';

export function VerifyForm() {
  const viewProps = useVerifyFormController();
  return <VerifyFormView {...viewProps} />;
}
