import type { ReactNode } from 'react';

import { PageHeader } from '@/features/shared/ui/layout';
import { Tabs, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { cn } from '@/features/shared/utils/utils';

export interface SettingsTab<TValue extends string = string> {
  value: TValue;
  label: ReactNode;
  disabled?: boolean;
}

interface SettingsPageProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SettingsPage({
  title,
  description,
  children,
  className,
  contentClassName,
}: SettingsPageProps) {
  return (
    <div
      data-slot="settings-page"
      className={cn(
        '[&_[data-slot=card]]:border-border/60 mx-auto w-full max-w-5xl space-y-6 pb-6 [&_[data-slot=card-content]]:p-4 [&_[data-slot=card-content]]:pt-0 sm:[&_[data-slot=card-content]]:p-5 sm:[&_[data-slot=card-content]]:pt-0 [&_[data-slot=card-header]]:p-4 sm:[&_[data-slot=card-header]]:p-5 [&_[data-slot=card]]:shadow-none',
        className
      )}
    >
      <PageHeader title={title} description={description} />
      <div className={cn('min-w-0', contentClassName)}>{children}</div>
    </div>
  );
}

interface SettingsTabsProps<TValue extends string> {
  tabs: readonly SettingsTab<TValue>[];
  value: TValue;
  onValueChange?: (value: TValue) => void;
  children: ReactNode;
  className?: string;
  listClassName?: string;
}

export function SettingsTabs<TValue extends string>({
  tabs,
  value,
  onValueChange,
  children,
  className,
  listClassName,
}: SettingsTabsProps<TValue>) {
  return (
    <Tabs
      value={value}
      onValueChange={nextValue => onValueChange?.(nextValue as TValue)}
      className={cn('min-w-0 space-y-6', className)}
    >
      <div className="relative min-w-0">
        <TabsList
          className={cn(
            'scrollbar-hide border-border/60 bg-muted/35 h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg p-1 shadow-none',
            listClassName
          )}
        >
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={tab.disabled}
              className="min-h-9 shrink-0 rounded-md px-3 data-[state=active]:shadow-none"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}

interface SettingsActionBarProps {
  children: ReactNode;
  className?: string;
}

export function SettingsActionBar({ children, className }: SettingsActionBarProps) {
  return (
    <div
      data-slot="settings-action-bar"
      className={cn(
        'bg-background/95 supports-[backdrop-filter]:bg-background/80 border-border/70 sticky bottom-3 z-20 rounded-xl border p-3 shadow-lg backdrop-blur',
        className
      )}
    >
      {children}
    </div>
  );
}
