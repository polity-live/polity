import type { ComponentType, CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';

type IconComponent = ComponentType<{ className?: string }>;

interface FeedSplitLayoutProps extends HTMLAttributes<HTMLDivElement> {
  style?: CSSProperties;
}

export function FeedSplitLayout({ className, style, ...props }: FeedSplitLayoutProps) {
  return (
    <div
      data-slot="feed-split-layout"
      style={style}
      className={cn(
        'flex min-h-0 flex-col gap-4 md:grid md:grid-cols-3 md:[grid-template-rows:minmax(0,1fr)]',
        className
      )}
      {...props}
    />
  );
}

function FeedPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <Card
      data-slot="feed-panel"
      className={cn('flex min-h-0 flex-col overflow-hidden', className)}
      {...props}
    />
  );
}

function FeedToolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="feed-toolbar"
      className={cn(
        'bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 mb-6 border-b pb-4 backdrop-blur',
        className
      )}
      {...props}
    />
  );
}

function FeedList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="feed-list" className={cn('space-y-3', className)} {...props} />;
}

interface FeedStatePanelProps {
  icon?: IconComponent;
  title?: ReactNode;
  description?: ReactNode;
  isLoading?: boolean;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}

function FeedStatePanel({
  icon: Icon,
  title,
  description,
  isLoading,
  children,
  className,
  contentClassName,
}: FeedStatePanelProps) {
  const StateIcon = isLoading ? Loader2 : Icon;

  return (
    <Card data-slot="feed-state-panel" className={className}>
      <CardContent
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center',
          contentClassName
        )}
      >
        {StateIcon ? (
          <StateIcon
            className={cn('text-muted-foreground mb-4 h-12 w-12', isLoading && 'animate-spin')}
          />
        ) : null}
        {title ? <p className="text-lg font-semibold">{title}</p> : null}
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        {children}
      </CardContent>
    </Card>
  );
}

export { FeedList, FeedPanel, FeedStatePanel, FeedToolbar };
