import { PlateLeaf } from 'platejs/react';

import { cn } from '@/features/shared/utils/utils.ts';
export interface CommentLeafViewProps {
  props: any;
  children: any;
  leaf: any;
  api: any;
  setOption: any;
  hoverId: any;
  activeId: any;
  isOverlapping: any;
  currentId: any;
  isActive: any;
  isHover: any;
}

export function CommentLeafView({
  props,
  children,
  setOption,
  isOverlapping,
  currentId,
  isActive,
  isHover,
}: CommentLeafViewProps) {
  return (
    <PlateLeaf
      {...props}
      className={cn(
        'border-b-highlight/[.36] bg-highlight/[.13] border-b-2 transition-colors duration-200',
        (isHover || isActive) && 'border-b-highlight bg-highlight/25',
        isOverlapping && 'border-b-highlight/[.7] bg-highlight/25 border-b-2',
        (isHover || isActive) && isOverlapping && 'border-b-highlight bg-highlight/45'
      )}
      attributes={{
        ...props.attributes,
        onClick: () => setOption('activeId', currentId ?? null),
        onMouseEnter: () => setOption('hoverId', currentId ?? null),
        onMouseLeave: () => setOption('hoverId', null),
      }}
    >
      {children}
    </PlateLeaf>
  );
}
