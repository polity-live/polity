import { cn } from '@/features/shared/utils/utils.ts';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('civic-shimmer rounded-md', className)} {...props} />;
}

export { Skeleton };
