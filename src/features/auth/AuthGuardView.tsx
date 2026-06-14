import { featureThemeClassName } from '@/features/shared/theme';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface AuthGuardViewProps {
  children: ReactNode;
  fallback?: ReactNode;
  isReady: boolean;
  isAllowed: boolean;
}

export function AuthGuardView({ children, fallback, isReady, isAllowed }: AuthGuardViewProps) {
  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className={featureThemeClassName('authAuthGuardInfoLoadingIcon')} />
          <p className="text-muted-foreground text-sm">
            {translateText('generated.inline.0219_loading_b04ba49f')}
          </p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return fallback || null;
  }

  return <>{children}</>;
}
