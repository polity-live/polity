import * as React from 'react';

import { cn } from '@/features/shared/utils/utils.ts';

function ButtonGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="button-group"
      role="group"
      className={cn(
        'inline-flex w-fit items-center rounded-md shadow-xs [&>*]:rounded-none [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md [&>*:not(:first-child)]:-ml-px',
        className
      )}
      {...props}
    />
  );
}

export { ButtonGroup };
