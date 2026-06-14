'use client';

import { cn } from '@/features/shared/utils/utils.ts';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className={cn('text-primary animate-spin', sizeClasses[size])} />
        {text && <p className="text-muted-foreground animate-pulse text-sm">{text}</p>}
      </div>
    </div>
  );
}

export function PageLoadingSpinner() {
  const { t } = useTranslation();

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <LoadingSpinner size="lg" text={t('loading.page')} />
    </div>
  );
}
