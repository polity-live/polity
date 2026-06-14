import type { SlateElementProps } from 'platejs';

import { SlateElement } from 'platejs';

import { cn } from '@/features/shared/utils/utils.ts';

export function HrElementStatic(props: SlateElementProps) {
  return (
    <SlateElement {...props}>
      <div className="cursor-text py-6" contentEditable={false}>
        <hr className={cn('bg-muted h-0.5 rounded-sm border-none bg-clip-content')} />
      </div>
      {props.children}
    </SlateElement>
  );
}
