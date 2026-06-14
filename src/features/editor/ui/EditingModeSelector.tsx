'use client';

import { cn } from '@/features/shared/utils/utils';
import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';
import { MessageSquare, Vote, ChevronDown } from 'lucide-react';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

interface EditingModeSelectorProps {
  amendmentId: string;
  currentMode?: string | null;
}

const modes = [
  {
    value: 'suggest_event' as const,
    label: translateText('generated.inline.0090_event_suggesting_6e3bb22b'),
    icon: MessageSquare,
    color: featureThemeClassName('agendaAgendaVoteSectionAccentBackground'),
  },
  {
    value: 'vote_event' as const,
    label: translateText('generated.inline.0091_event_voting_4b62fa3e'),
    icon: Vote,
    color: featureThemeClassName('agendaAgendaVoteSectionWarningBackground'),
  },
];

export function EditingModeSelector({ amendmentId, currentMode }: EditingModeSelectorProps) {
  const { t } = useTranslation();
  const { updateEditingMode } = useAmendmentActions();

  const currentModeConfig = modes.find(m => m.value === currentMode) ?? modes[0];
  const Icon = currentModeConfig.icon;

  const handleModeChange = async (newMode: string) => {
    if (newMode === currentMode) return;
    await updateEditingMode(amendmentId, newMode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium">{currentModeConfig.label}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuSeparator />
        {modes.map(mode => {
          const ModeIcon = mode.icon;
          const isActive = mode.value === currentMode;

          return (
            <DropdownMenuItem
              key={mode.value}
              onClick={() => handleModeChange(mode.value)}
              className={isActive ? 'bg-accent' : ''}
            >
              <div className="flex w-full items-start gap-3">
                <div
                  className={cn(
                    featureThemeClassName('editorEditingModeSelectorContrastText'),
                    mode.color,
                    isActive && featureThemeClassName('editorEditingModeSelectorThemedRing')
                  )}
                >
                  <ModeIcon className="h-3 w-3" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{mode.label}</span>
                    {isActive && (
                      <BadgeControl variant="secondary" size="xs">
                        {t('features.amendments.modeSelector.active')}
                      </BadgeControl>
                    )}
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
