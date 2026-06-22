import {
  CalendarIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
  EyeIcon,
  GavelIcon,
  PenIcon,
  PencilLineIcon,
  Vote,
  XCircleIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { getEntityToneClasses, getSemanticToneClasses } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils.ts';
import {
  AMENDMENT_EDITING_MODE_ORDER,
  MANUALLY_SELECTABLE_MODES,
  isAutomaticEventMode,
  type EditingMode,
  type NonTerminalEditingMode,
} from '@/zero/amendments/editing-mode-policy';

import { Badge } from '@/features/shared/ui/ui/badge';
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/features/shared/ui/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';

export type { EditingMode } from '@/zero/amendments/editing-mode-policy';

export type SelectableEditingMode = NonTerminalEditingMode;

type Translate = (
  key: string,
  paramsOrFallback?: string | Record<string, string | number | undefined | null>,
  fallback?: string
) => string;

interface EditingModeOption {
  colorClass: string;
  description: string;
  Icon: LucideIcon;
  label: string;
  value: EditingMode;
}

export const SYSTEM_MANAGED_EVENT_MODE_TOOLTIP = 'System verwaltet diesen Status.';
export const EVENT_PHASE_LOCKED_MODE_TOOLTIP =
  'Dieser Status ist während der Event-Phase gesperrt. Der Antrag wird jetzt vom Event-Ablauf gesteuert.';

const DISABLED_MODE_REASON_LABELS: Record<string, { fallback: string; key: string }> = {
  'branch-readonly': {
    key: 'features.amendments.workflowDisabledReasons.branchReadonly',
    fallback: 'Diese Branch ist abgeschlossen und kann nicht mehr geändert werden.',
  },
  'event-controlled': {
    key: 'features.amendments.workflowDisabledReasons.eventControlled',
    fallback: 'Dieser Status wird automatisch durch den Event-Ablauf gesetzt.',
  },
  'internal-window-closed': {
    key: 'features.amendments.workflowDisabledReasons.internalWindowClosed',
    fallback:
      'Der interne Modus kann nach Start des ersten Prozess-Agenda-Punkts nicht mehr manuell geändert werden.',
  },
};

const MODE_ICON_MAP: Record<EditingMode, LucideIcon> = {
  edit: PenIcon,
  view: EyeIcon,
  suggest_internal: PencilLineIcon,
  suggest_event: CalendarIcon,
  vote_internal: Vote,
  event_final_closing_vote: GavelIcon,
  passed: CheckCircle2Icon,
  rejected: XCircleIcon,
};

const MODE_LABEL_KEYS: Record<EditingMode, { fallback: string; key: string }> = {
  edit: {
    key: 'features.amendments.workflow.collaborativeEditing',
    fallback: 'Collaborative Editing',
  },
  view: {
    key: 'features.amendments.workflow.viewing',
    fallback: 'Viewing',
  },
  suggest_internal: {
    key: 'features.amendments.workflow.internalSuggesting',
    fallback: 'Internal Suggestions',
  },
  suggest_event: {
    key: 'features.amendments.workflow.eventSuggesting',
    fallback: 'Event Suggesting',
  },
  vote_internal: {
    key: 'features.amendments.workflow.internalVoting',
    fallback: 'Internal Voting Mode',
  },
  event_final_closing_vote: {
    key: 'features.amendments.workflow.eventVoting',
    fallback: 'Event Final Closing Vote',
  },
  passed: {
    key: 'features.amendments.workflow.passed',
    fallback: 'Passed',
  },
  rejected: {
    key: 'features.amendments.workflow.rejected',
    fallback: 'Rejected',
  },
};

const MODE_DESCRIPTION_KEYS: Record<EditingMode, { fallback: string; key: string }> = {
  edit: {
    key: 'features.amendments.workflowDescriptions.collaborativeEditing',
    fallback: 'All collaborators can edit directly',
  },
  view: {
    key: 'features.amendments.workflowDescriptions.viewing',
    fallback: 'Read-only mode',
  },
  suggest_internal: {
    key: 'features.amendments.workflowDescriptions.internalSuggesting',
    fallback: 'Collaborators can submit suggestions',
  },
  suggest_event: {
    key: 'features.amendments.workflowDescriptions.eventSuggesting',
    fallback: 'Event participants can submit suggestions',
  },
  vote_internal: {
    key: 'features.amendments.workflowDescriptions.internalVoting',
    fallback: 'Collaborators vote on change requests',
  },
  event_final_closing_vote: {
    key: 'features.amendments.workflowDescriptions.eventVoting',
    fallback: 'Final event vote is active and event suggestions are locked',
  },
  passed: {
    key: 'features.amendments.workflowDescriptions.passed',
    fallback: 'Amendment was accepted',
  },
  rejected: {
    key: 'features.amendments.workflowDescriptions.rejected',
    fallback: 'Amendment was rejected',
  },
};

const MODE_COLOR_CLASSES: Record<EditingMode, string> = {
  edit: getEntityToneClasses('amendment').dot,
  view: getSemanticToneClasses('neutral').dot,
  suggest_internal: getSemanticToneClasses('accent').dot,
  suggest_event: getEntityToneClasses('event').dot,
  vote_internal: getEntityToneClasses('vote').dot,
  event_final_closing_vote: getEntityToneClasses('event').dot,
  passed: getSemanticToneClasses('success').dot,
  rejected: getSemanticToneClasses('danger').dot,
};

export function getEditingModeOption(mode: EditingMode, t: Translate): EditingModeOption {
  const labelConfig = MODE_LABEL_KEYS[mode];

  return {
    colorClass: MODE_COLOR_CLASSES[mode],
    description: t(MODE_DESCRIPTION_KEYS[mode].key, MODE_DESCRIPTION_KEYS[mode].fallback),
    Icon: MODE_ICON_MAP[mode],
    label: t(labelConfig.key, labelConfig.fallback),
    value: mode,
  };
}

export function getSelectableEditingModeOptions(t: Translate): EditingModeOption[] {
  return MANUALLY_SELECTABLE_MODES.map(mode => getEditingModeOption(mode, t));
}

function formatDisabledModeReason(reason: string | undefined, t: Translate) {
  if (!reason) return undefined;
  const label = DISABLED_MODE_REASON_LABELS[reason];
  return label ? t(label.key, label.fallback) : reason;
}

export function EditingModeBadge({
  className,
  mode,
  showIcon = false,
  variant = 'secondary',
}: {
  className?: string;
  mode: EditingMode;
  showIcon?: boolean;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}) {
  const { t } = useTranslation();
  const option = getEditingModeOption(mode, t);

  return (
    <Badge variant={variant} className={cn(showIcon && 'gap-1.5', className)}>
      {showIcon ? <option.Icon className="h-3.5 w-3.5" /> : null}
      {option.label}
    </Badge>
  );
}

export function EditingModeMenuItems({
  disabled = false,
  disabledModeReasons,
  modes,
  onValueChange,
  showDescriptions = true,
  showAutomaticEventModes = true,
  value,
}: {
  disabled?: boolean;
  disabledModeReasons?: Partial<Record<SelectableEditingMode, string>>;
  modes?: readonly SelectableEditingMode[];
  onValueChange: (value: SelectableEditingMode) => void;
  showDescriptions?: boolean;
  showAutomaticEventModes?: boolean;
  value: SelectableEditingMode;
}) {
  const { t } = useTranslation();
  const [openTooltipMode, setOpenTooltipMode] = useState<SelectableEditingMode | null>(null);
  const renderedModes =
    modes ??
    (showAutomaticEventModes
      ? (AMENDMENT_EDITING_MODE_ORDER as readonly SelectableEditingMode[])
      : (MANUALLY_SELECTABLE_MODES as readonly SelectableEditingMode[]));
  const options = renderedModes.map(mode => getEditingModeOption(mode, t));
  const isEventPhaseActive = isAutomaticEventMode(value);

  const handleValueChange = (nextValue: string) => {
    const nextMode = nextValue as SelectableEditingMode;

    if (
      disabled ||
      isEventPhaseActive ||
      isAutomaticEventMode(nextMode) ||
      disabledModeReasons?.[nextMode]
    ) {
      return;
    }

    onValueChange(nextMode);
  };

  return (
    <DropdownMenuRadioGroup value={value} onValueChange={handleValueChange}>
      {options.map(option => {
        const mode = option.value as SelectableEditingMode;
        const isSystemManaged = isAutomaticEventMode(mode);
        const disabledReason = formatDisabledModeReason(disabledModeReasons?.[mode], t);
        const isCurrentMode = mode === value;
        const helpText = isSystemManaged
          ? SYSTEM_MANAGED_EVENT_MODE_TOOLTIP
          : isEventPhaseActive
            ? EVENT_PHASE_LOCKED_MODE_TOOLTIP
            : disabledReason;
        const isItemDisabled =
          disabled || isEventPhaseActive || isSystemManaged || Boolean(disabledReason);

        return (
          <DropdownMenuRadioItem
            key={option.value}
            value={option.value}
            aria-disabled={isItemDisabled}
            aria-current={isCurrentMode ? 'true' : undefined}
            onSelect={event => {
              if (isItemDisabled) {
                event.preventDefault();
              }
            }}
            className={cn(
              'items-start gap-3 pl-8',
              isItemDisabled && !isCurrentMode && 'text-muted-foreground opacity-60',
              isItemDisabled && isCurrentMode && 'bg-muted/60 text-foreground opacity-90'
            )}
          >
            <div
              className={cn(
                'mt-1 h-2.5 w-2.5 rounded-full',
                isItemDisabled ? getSemanticToneClasses('neutral').dot : option.colorClass
              )}
            />
            <option.Icon className="mt-0.5 h-4 w-4" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{option.label}</div>
              {showDescriptions ? (
                <p className="text-muted-foreground text-xs">{option.description}</p>
              ) : null}
              {disabledReason ? (
                <p className="text-muted-foreground mt-1 text-xs">{disabledReason}</p>
              ) : null}
            </div>
            {helpText ? (
              <Tooltip
                open={openTooltipMode === mode}
                onOpenChange={open => setOpenTooltipMode(open ? mode : null)}
              >
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={helpText}
                    title={helpText}
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring ml-auto rounded-sm p-1 outline-hidden focus-visible:ring-2"
                    onPointerDown={event => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      setOpenTooltipMode(current => (current === mode ? null : mode));
                    }}
                  >
                    <CircleHelpIcon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">{helpText}</TooltipContent>
              </Tooltip>
            ) : null}
          </DropdownMenuRadioItem>
        );
      })}
    </DropdownMenuRadioGroup>
  );
}
