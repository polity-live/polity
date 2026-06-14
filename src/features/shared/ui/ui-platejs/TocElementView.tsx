import { cva } from 'class-variance-authority';
import { PlateElement } from 'platejs/react';

import { Button } from '@/features/shared/ui/ui/button.tsx';

const headingItemVariants = cva(
  'block h-auto w-full cursor-pointer truncate rounded-none px-0.5 py-1.5 text-left font-medium text-muted-foreground underline decoration-[0.5px] underline-offset-4 hover:bg-accent hover:text-muted-foreground',
  {
    variants: {
      depth: {
        1: 'pl-0.5',
        2: 'pl-[26px]',
        3: 'pl-[50px]',
      },
    },
  }
);

export interface TocElementViewProps {
  props: any;
  t: any;
  state: any;
  btnProps: any;
  headingList: any;
}

export function TocElementView({ props, t, btnProps, headingList }: TocElementViewProps) {
  return (
    <PlateElement {...props} className="mb-1 p-0">
      <div contentEditable={false}>
        {headingList.length > 0 ? (
          headingList.map((item: any) => (
            <Button
              key={item.id}
              variant="ghost"
              className={headingItemVariants({
                depth: item.depth as 1 | 2 | 3,
              })}
              onClick={e => btnProps.onClick(e, item, 'smooth')}
              aria-current
            >
              {item.title}
            </Button>
          ))
        ) : (
          <div className="text-sm text-gray-500">
            {t('plateJs.toolbar.tableOfContents.createHeading')}
          </div>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}
