import type { ComponentProps } from 'react';

import { Checkbox } from '@/features/shared/ui/ui/checkbox';

export function InlineCheckbox(props: ComponentProps<typeof Checkbox>) {
  return <Checkbox data-slot="inline-checkbox" {...props} />;
}
