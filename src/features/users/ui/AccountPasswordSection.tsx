'use client';

import { useAccountPasswordSectionController } from '../hooks/useAccountPasswordSectionController';
import { AccountPasswordSectionShellView } from './AccountPasswordSectionShellView';

export function AccountPasswordSection() {
  return <AccountPasswordSectionShellView {...useAccountPasswordSectionController()} />;
}
