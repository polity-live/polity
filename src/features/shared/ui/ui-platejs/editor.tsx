import * as React from 'react';

import type { VariantProps } from 'class-variance-authority';
import type { PlateContentProps, RenderPlaceholderProps } from 'platejs/react';

import { cva } from 'class-variance-authority';
import { PlateContainer, PlateContent } from 'platejs/react';

import { cn } from '@/features/shared/utils/utils.ts';
import { getPlateSurfaceClasses } from '@/features/shared/theme';

const editorContainerVariants = cva(
  'relative w-full cursor-text overflow-y-auto caret-primary select-text selection:bg-brand/25 focus-visible:outline-none [&_.slate-selection-area]:z-50 [&_.slate-selection-area]:border [&_.slate-selection-area]:border-brand/25 [&_.slate-selection-area]:bg-brand/15',
  {
    defaultVariants: {
      variant: 'default',
    },
    variants: {
      variant: {
        comment: cn(
          'flex flex-wrap justify-between gap-1 px-1 py-0.5 text-sm',
          'rounded-md border-[1.5px] border-transparent bg-transparent',
          'has-[[data-slate-editor]:focus]:border-ring has-[[data-slate-editor]:focus]:ring-2 has-[[data-slate-editor]:focus]:ring-ring/30',
          'has-aria-disabled:border-input has-aria-disabled:bg-muted'
        ),
        default: 'h-full',
        demo: 'h-[650px]',
        select: cn(
          'group rounded-md border border-input bg-card ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          'has-data-readonly:w-fit has-data-readonly:cursor-default has-data-readonly:border-transparent has-data-readonly:focus-within:[box-shadow:none]'
        ),
      },
    },
  }
);

export function EditorContainer({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof editorContainerVariants>) {
  return (
    <PlateContainer
      className={cn(
        'ignore-click-outside/toolbar',
        variant === 'default' && getPlateSurfaceClasses('editor'),
        editorContainerVariants({ variant }),
        className
      )}
      {...props}
    />
  );
}

const editorVariants = cva(
  cn(
    'group/editor',
    'relative w-full cursor-text overflow-x-hidden break-words whitespace-pre-wrap select-text',
    'rounded-md ring-offset-background focus-visible:outline-none',
    'placeholder:text-muted-foreground **:data-slate-placeholder:!top-1/2 **:data-slate-placeholder:-translate-y-1/2',
    '[&_strong]:font-bold'
  ),
  {
    defaultVariants: {
      variant: 'default',
    },
    variants: {
      disabled: {
        true: 'cursor-not-allowed opacity-50',
      },
      focused: {
        true: 'ring-2 ring-ring ring-offset-2',
      },
      variant: {
        ai: 'w-full px-0 text-base md:text-sm',
        aiChat:
          'max-h-[min(70vh,320px)] w-full max-w-[700px] overflow-y-auto px-3 py-2 text-base md:text-sm',
        comment: cn('rounded-none border-none bg-transparent text-sm'),
        default: 'size-full px-4 pt-4 pb-72 text-base md:px-[max(64px,calc(50%-350px))]',
        demo: 'size-full px-4 pt-4 pb-72 text-base md:px-[max(64px,calc(50%-350px))]',
        fullWidth: 'size-full px-4 pt-4 pb-72 text-base md:px-24',
        none: '',
        select: 'px-3 py-2 text-base data-readonly:w-fit',
      },
    },
  }
);

export type EditorProps = PlateContentProps & VariantProps<typeof editorVariants>;

function AccessibleEditorPlaceholder({ attributes, children }: RenderPlaceholderProps) {
  return (
    <span
      {...attributes}
      style={{
        ...attributes.style,
        color: 'var(--muted-foreground)',
        opacity: 1,
      }}
    >
      {children}
    </span>
  );
}

export const Editor = React.forwardRef<HTMLDivElement, EditorProps>(
  (
    {
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      className,
      disabled,
      focused,
      renderPlaceholder = AccessibleEditorPlaceholder,
      variant,
      ...props
    },
    ref
  ) => {
    const placeholderLabel =
      typeof props.placeholder === 'string' && props.placeholder.trim()
        ? props.placeholder
        : undefined;
    return (
      <PlateContent
        ref={ref}
        aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : placeholderLabel)}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          editorVariants({
            disabled,
            focused,
            variant,
          }),
          className
        )}
        disabled={disabled}
        disableDefaultStyles
        renderPlaceholder={renderPlaceholder}
        {...props}
      />
    );
  }
);

Editor.displayName = 'Editor';
