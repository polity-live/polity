import type { ReactNode } from 'react';

import { FloatingActionBar } from '@/features/shared/ui/form/SettingsLayout';
import { cn } from '@/features/shared/utils/utils';

interface OnboardingStepShellProps {
  actions: ReactNode;
  children: ReactNode;
  actionBarClassName?: string;
  className?: string;
  contentClassName?: string;
}

export function OnboardingStepShell({
  actions,
  children,
  actionBarClassName,
  className,
  contentClassName,
}: OnboardingStepShellProps) {
  return (
    <div
      data-slot="onboarding-step-shell"
      className={cn('flex h-full min-h-0 flex-col', className)}
    >
      <div
        data-slot="onboarding-step-content"
        className={cn(
          'min-h-0 flex-1 scrollbar-thin overflow-y-auto overscroll-contain pb-3',
          contentClassName
        )}
      >
        {children}
      </div>

      <FloatingActionBar
        dataSlot="onboarding-action-bar"
        className={cn(
          'static bottom-auto mt-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] flex-none',
          actionBarClassName
        )}
      >
        {actions}
      </FloatingActionBar>
    </div>
  );
}
