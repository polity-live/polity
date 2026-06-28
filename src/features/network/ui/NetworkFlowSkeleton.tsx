import { Skeleton } from '@/features/shared/ui/ui/skeleton';

interface NetworkFlowSkeletonProps {
  label: string;
}

export function NetworkFlowSkeleton({ label }: NetworkFlowSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="bg-background relative h-[32rem] min-h-[24rem] w-full overflow-hidden rounded-lg border p-4"
      data-slot="network-flow-skeleton"
    >
      <span className="sr-only">{label}</span>
      <div className="bg-background/80 absolute top-4 left-4 z-10 space-y-2 rounded-md border p-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
      <Skeleton className="absolute top-24 left-[16%] size-16 rounded-full" />
      <Skeleton className="absolute top-40 left-[42%] size-20 rounded-full" />
      <Skeleton className="absolute top-24 right-[18%] size-14 rounded-full" />
      <Skeleton className="absolute bottom-24 left-[28%] size-14 rounded-full" />
      <Skeleton className="absolute right-[30%] bottom-20 size-16 rounded-full" />
      <Skeleton className="absolute top-[38%] left-[26%] h-2 w-[30%] rotate-12 rounded-full" />
      <Skeleton className="absolute top-[35%] right-[22%] h-2 w-[24%] -rotate-12 rounded-full" />
      <Skeleton className="absolute bottom-[31%] left-[36%] h-2 w-[25%] rotate-[-18deg] rounded-full" />
      <div className="bg-background/80 absolute right-4 bottom-4 space-y-2 rounded-md border p-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}
