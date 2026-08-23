'use client';

import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/features/shared/ui/ui/hover-card.tsx';
import { Label } from '@/features/shared/ui/ui/label.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Check, CircleHelp, Globe, Lock, Users } from 'lucide-react';

type Visibility = 'public' | 'authenticated' | 'private';

interface VisibilityOption {
  value: Visibility;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface VisibilitySelectorProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
  label?: string;
  showTooltip?: boolean;
}

export function VisibilitySelector({
  value,
  onChange,
  label,
  showTooltip = true,
}: VisibilitySelectorProps) {
  const { t } = useTranslation();
  const visibilityOptions: VisibilityOption[] = [
    {
      value: 'public',
      label: t('common.visibility.public'),
      description: t('common.visibility.descriptions.public'),
      icon: <Globe className="h-4 w-4" />,
    },
    {
      value: 'authenticated',
      label: t('common.visibility.authenticated'),
      description: t('common.visibility.descriptions.authenticated'),
      icon: <Users className="h-4 w-4" />,
    },
    {
      value: 'private',
      label: t('common.visibility.private'),
      description: t('common.visibility.descriptions.private'),
      icon: <Lock className="h-4 w-4" />,
    },
  ];
  const resolvedLabel = label ?? t('common.visibility.label');

  const content = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label>{resolvedLabel}</Label>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {visibilityOptions.map(option => (
          <div key={option.value} className="relative min-w-0">
            <Button
              type="button"
              variant={value === option.value ? 'default' : 'outline'}
              onClick={() => onChange(option.value)}
              data-create-option={option.value}
              aria-pressed={value === option.value}
              className={
                showTooltip
                  ? 'flex w-full min-w-0 items-center gap-2 pr-9'
                  : 'flex w-full min-w-0 items-center gap-2'
              }
            >
              {value === option.value ? <Check className="h-4 w-4" /> : option.icon}
              <span className="min-w-0 truncate">{option.label}</span>
            </Button>
            {showTooltip && (
              <HoverCard openDelay={150}>
                <HoverCardTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={option.description}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 rounded-md"
                    onClick={event => event.preventDefault()}
                    onMouseDown={event => event.preventDefault()}
                  >
                    <CircleHelp className="h-4 w-4" />
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent side="top" className="w-56 p-3 text-sm">
                  <p>{option.description}</p>
                </HoverCardContent>
              </HoverCard>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return content;
}
