import type { ReactNode } from 'react';

import {
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from '@/features/shared/ui/layout';
import { cn } from '@/features/shared/utils/utils';

interface SettingsPanelProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  variant?: 'default' | 'danger';
  className?: string;
  contentClassName?: string;
}

export function SettingsPanel({
  title,
  description,
  icon,
  action,
  children,
  variant = 'default',
  className,
  contentClassName,
}: SettingsPanelProps) {
  return (
    <Panel
      className={cn(
        'border-border/60 shadow-none',
        variant === 'danger' && 'border-destructive/50 bg-destructive/[0.025]',
        className
      )}
    >
      <PanelHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <PanelTitle className="flex items-center gap-2">
              {icon}
              {title}
            </PanelTitle>
            {description ? <PanelDescription>{description}</PanelDescription> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </PanelHeader>
      <PanelContent className={contentClassName}>{children}</PanelContent>
    </Panel>
  );
}
