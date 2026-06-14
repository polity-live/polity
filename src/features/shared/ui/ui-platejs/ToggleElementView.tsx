import { ChevronRight } from 'lucide-react';
import { PlateElement } from 'platejs/react';

import { Button } from '@/features/shared/ui/ui/button.tsx';

export interface ToggleElementViewProps {
  props: any;
  element: any;
  state: any;
  buttonProps: any;
  open: any;
}

export function ToggleElementView({ props, buttonProps, open }: ToggleElementViewProps) {
  return (
    <PlateElement {...props} className="pl-6">
      <Button
        size="icon"
        variant="ghost"
        className="text-muted-foreground hover:bg-accent absolute top-0 -left-0.5 size-6 cursor-pointer items-center justify-center rounded-md p-px transition-colors select-none [&_svg]:size-4"
        contentEditable={false}
        {...buttonProps}
      >
        <ChevronRight
          className={
            open
              ? 'rotate-90 transition-transform duration-75'
              : 'rotate-0 transition-transform duration-75'
          }
        />
      </Button>
      {props.children}
    </PlateElement>
  );
}
