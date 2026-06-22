import { cn } from '@/features/shared/utils/utils';
import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl, getEditingModeOption } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';
import { MessageSquare, Vote, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { AutomaticEventEditingMode } from '@/zero/amendments/editing-mode-policy';

interface EditingModeSelectorViewProps {
  currentMode?: AutomaticEventEditingMode | null;
  onModeChange: (newMode: AutomaticEventEditingMode) => Promise<void>;
}

const modes = [
  {
    value: 'suggest_event' as const,
    icon: MessageSquare,
    color: featureThemeClassName('agendaAgendaVoteSectionAccentBackground'),
  },
  {
    value: 'event_final_closing_vote' as const,
    icon: Vote,
    color: featureThemeClassName('agendaAgendaVoteSectionWarningBackground'),
  },
];

export function EditingModeSelectorView({
  currentMode,
  onModeChange,
}: EditingModeSelectorViewProps) {
  const { t } = useTranslation();
  const modeOptions = modes.map(mode => ({
    ...mode,
    label: getEditingModeOption(mode.value, t).label,
  }));
  const currentModeConfig = modeOptions.find(mode => mode.value === currentMode) ?? modeOptions[0];
  const Icon = currentModeConfig.icon;

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
        {modeOptions.map(mode => {
          const ModeIcon = mode.icon;
          const isActive = mode.value === currentMode;

          return (
            <DropdownMenuItem
              key={mode.value}
              onClick={() => void onModeChange(mode.value)}
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
                    {isActive ? (
                      <BadgeControl variant="secondary" size="xs">
                        {t('features.amendments.modeSelector.active')}
                      </BadgeControl>
                    ) : null}
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
