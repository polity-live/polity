import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function ToasterView({ theme, toastOptions, ...props }: ToasterProps) {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      closeButton
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-[var(--shadow-floating)] group-[.toaster]:rounded-lg',
          description: 'group-[.toast]:text-muted-foreground',
          content: 'group-[.toast]:min-w-0 group-[.toast]:flex-1',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton:
            '!static !order-last !ml-3 !h-5 !w-5 !shrink-0 !self-start !transform-none group-[.toast]:border-border/60 group-[.toast]:bg-background/80 group-[.toast]:text-muted-foreground hover:text-foreground',
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export type { ToasterProps };
