import type { ComponentProps } from 'react';

import { Switch } from '@/features/shared/ui/ui/switch';

export function InlineSwitch(props: ComponentProps<typeof Switch>) {
  return <Switch data-slot="inline-switch" {...props} />;
}
