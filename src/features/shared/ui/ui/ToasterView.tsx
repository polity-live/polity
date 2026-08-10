import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function ToasterView({ theme, toastOptions, ...props }: ToasterProps) {
  return (
    <Sonner
      theme={theme}
      className="toaster group pointer-events-none"
      closeButton
      swipeDirections={[]}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            'group toast pointer-events-auto !touch-auto !select-text group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-[var(--shadow-floating)] group-[.toaster]:rounded-lg',
          description:
            'pointer-events-auto !touch-auto !select-text group-[.toast]:text-muted-foreground',
          content: 'pointer-events-auto min-w-0 flex-1 !touch-auto !select-text',
          actionButton:
            'pointer-events-auto group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'pointer-events-auto group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton:
            'pointer-events-auto !static !order-last !ml-3 !h-5 !w-5 !shrink-0 !self-start !transform-none group-[.toast]:border-border/60 group-[.toast]:bg-background/80 group-[.toast]:text-muted-foreground hover:text-foreground',
          success: '!text-success',
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export type { ToasterProps };
