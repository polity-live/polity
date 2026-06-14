'use client';

import { useAccountEmailSectionController } from '@/features/users/hooks/useAccountEmailSectionController';
import { AccountEmailSectionShellView } from './AccountEmailSectionShellView';

export function AccountEmailSection() {
  const viewProps = useAccountEmailSectionController();
  return <AccountEmailSectionShellView {...viewProps} />;
}
