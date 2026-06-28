'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Loading fallback component shown during actual page transitions
 */
function PageLoadingFallback({ className = '' }: { className?: string }) {
  const { t } = useTranslation();

  return <PageSkeleton label={t('loading.page')} className={className} />;
}

/**
 * Page wrapper component that uses React Suspense for natural loading states
 * Only shows loading when React actually suspends (during real navigation/compilation)
 */
export function PageWrapper({ children, className = '' }: PageWrapperProps) {
  return (
    <Suspense fallback={<PageLoadingFallback className={className} />}>
      <div className={className}>{children}</div>
    </Suspense>
  );
}
