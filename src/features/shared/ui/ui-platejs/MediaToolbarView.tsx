import type { ComponentProps, ReactNode } from 'react';
import type { WithRequiredKey } from 'platejs';

import { FloatingMedia as FloatingMediaPrimitive } from '@platejs/media/react';
import { cva } from 'class-variance-authority';
import { Link, Trash2Icon } from 'lucide-react';

import { CaptionButton } from './caption.tsx';
import { Button, buttonVariants } from '@/features/shared/ui/ui/button.tsx';
import { Popover, PopoverAnchor, PopoverContent } from '@/features/shared/ui/ui/popover.tsx';
import { Separator } from '@/features/shared/ui/ui/separator.tsx';

const inputVariants = cva(
  'flex h-[28px] w-full rounded-md border-none bg-transparent px-1.5 py-1 text-base placeholder:text-muted-foreground focus-visible:ring-transparent focus-visible:outline-none md:text-sm'
);

interface MediaToolbarViewProps {
  children: ReactNode;
  plugin: WithRequiredKey;
  readOnly: boolean;
  isOpen: boolean;
  isEditing: boolean;
  removeButtonProps: ComponentProps<typeof Button>;
  labels: {
    embedLinkPlaceholder: string;
    editLink: string;
    caption: string;
  };
}

export function MediaToolbarView({
  children,
  plugin,
  readOnly,
  isOpen,
  isEditing,
  removeButtonProps,
  labels,
}: MediaToolbarViewProps) {
  if (readOnly) return <>{children}</>;

  return (
    <Popover open={isOpen} modal={false}>
      <PopoverAnchor>{children}</PopoverAnchor>

      <PopoverContent className="w-auto p-1" onOpenAutoFocus={event => event.preventDefault()}>
        {isEditing ? (
          <div className="flex w-[330px] flex-col">
            <div className="flex items-center">
              <div className="text-muted-foreground flex items-center pr-1 pl-2">
                <Link className="size-4" />
              </div>

              <FloatingMediaPrimitive.UrlInput
                className={inputVariants()}
                placeholder={labels.embedLinkPlaceholder}
                options={{ plugin }}
              />
            </div>
          </div>
        ) : (
          <div className="box-content flex items-center">
            <FloatingMediaPrimitive.EditButton
              className={buttonVariants({ size: 'sm', variant: 'ghost' })}
            >
              {labels.editLink}
            </FloatingMediaPrimitive.EditButton>

            <CaptionButton size="sm" variant="ghost">
              {labels.caption}
            </CaptionButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <Button size="sm" variant="ghost" {...removeButtonProps}>
              <Trash2Icon />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
