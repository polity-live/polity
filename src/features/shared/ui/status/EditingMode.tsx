import {
  CalendarIcon,
  CheckCircle2Icon,
  EyeIcon,
  GavelIcon,
  PenIcon,
  PencilLineIcon,
  Vote,
  XCircleIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils.ts';

import { Badge } from '@/features/shared/ui/ui/badge';
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/features/shared/ui/ui/dropdown-menu';

export type EditingMode =
  | 'edit'
  | 'view'
  | 'suggest_internal'
  | 'suggest_event'
  | 'vote_internal'
  | 'vote_event'
  | 'passed'
  | 'rejected';

const SELECTABLE_MODES: EditingMode[] = [
  'edit',
  'view',
  'suggest_internal',
  'suggest_event',
  'vote_internal',
  'vote_event',
];

const LEGACY_MODE_MAP: Record<string, EditingMode> = {
  collaborative_editing: 'edit',
  internal_suggesting: 'suggest_internal',
  internal_voting: 'vote_internal',
  viewing: 'view',
  event_suggesting: 'suggest_event',
  event_voting: 'vote_event',
  Drafting: 'edit',
  'Under Review': 'suggest_internal',
  Passed: 'passed',
  Rejected: 'rejected',
};

function normalizeEditingMode(raw: string | null | undefined): EditingMode {
  if (!raw) {
    return 'edit';
  }

  if (raw in MODE_LABEL_KEYS) {
    return raw as EditingMode;
  }

  return LEGACY_MODE_MAP[raw] ?? 'edit';
}

export type SelectableEditingMode = Exclude<EditingMode, 'passed' | 'rejected'>;

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

const MODE_ICON_MAP: Record<EditingMode, LucideIcon> = {
  edit: PenIcon,
  view: EyeIcon,
  suggest_internal: PencilLineIcon,
  suggest_event: CalendarIcon,
  vote_internal: Vote,
  vote_event: GavelIcon,
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
    fallback: 'Internal Suggesting',
  },
  suggest_event: {
    key: 'features.amendments.workflow.eventSuggesting',
    fallback: 'Event Suggesting',
  },
  vote_internal: {
    key: 'features.amendments.workflow.internalVoting',
    fallback: 'Internal Voting',
  },
  vote_event: {
    key: 'features.amendments.workflow.eventVoting',
    fallback: 'Event Voting',
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
    key: 'generated.inline.0741_alle_collaborators_k_nnen_direkt_bearbeiten_84c06ce2',
    fallback: 'All collaborators can edit directly',
  },
  view: {
    key: 'generated.inline.0743_nur_lesen_modus_054b6937',
    fallback: 'Read-only mode',
  },
  suggest_internal: {
    key: 'generated.inline.0745_collaborators_k_nnen_vorschl_ge_einreichen_7f0ea119',
    fallback: 'Collaborators can submit suggestions',
  },
  suggest_event: {
    key: 'generated.inline.0747_event_teilnehmer_k_nnen_vorschl_ge_einreichen_b811936d',
    fallback: 'Event participants can submit suggestions',
  },
  vote_internal: {
    key: 'generated.inline.0749_abstimmung_unter_collaborators_zeitbasiert_41f561b1',
    fallback: 'Time-based collaborator voting',
  },
  vote_event: {
    key: 'generated.inline.0751_event_stimmt_sequentiell_ber_nderungen_ab_d1aa6df6',
    fallback: 'Event votes sequentially on changes',
  },
  passed: {
    key: 'generated.inline.0753_amendment_wurde_angenommen_ee1c7af2',
    fallback: 'Amendment was accepted',
  },
  rejected: {
    key: 'generated.inline.0755_amendment_wurde_abgelehnt_6d6cc595',
    fallback: 'Amendment was rejected',
  },
};

const MODE_COLOR_CLASSES: Record<EditingMode, string> = {
  edit: 'bg-blue-500',
  view: 'bg-gray-500',
  suggest_internal: 'bg-purple-500',
  suggest_event: 'bg-teal-500',
  vote_internal: 'bg-orange-500',
  vote_event: 'bg-red-500',
  passed: 'bg-green-500',
  rejected: 'bg-red-700',
};

export function getEditingModeOption(
  mode: EditingMode | string | null | undefined,
  t: Translate
): EditingModeOption {
  const value = normalizeEditingMode(mode);
  const labelConfig = MODE_LABEL_KEYS[value];

  return {
    colorClass: MODE_COLOR_CLASSES[value],
    description: t(MODE_DESCRIPTION_KEYS[value].key, MODE_DESCRIPTION_KEYS[value].fallback),
    Icon: MODE_ICON_MAP[value],
    label: t(labelConfig.key, labelConfig.fallback),
    value,
  };
}

export function getSelectableEditingModeOptions(t: Translate): EditingModeOption[] {
  return SELECTABLE_MODES.map(mode => getEditingModeOption(mode, t));
}

export function EditingModeBadge({
  className,
  mode,
  showIcon = false,
  variant = 'secondary',
}: {
  className?: string;
  mode: EditingMode | string | null | undefined;
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
  modes = SELECTABLE_MODES as SelectableEditingMode[],
  onValueChange,
  showDescriptions = true,
  value,
}: {
  disabled?: boolean;
  modes?: SelectableEditingMode[];
  onValueChange: (value: SelectableEditingMode) => void;
  showDescriptions?: boolean;
  value: SelectableEditingMode;
}) {
  const { t } = useTranslation();
  const options = modes.map(mode => getEditingModeOption(mode, t));

  return (
    <DropdownMenuRadioGroup
      value={value}
      onValueChange={nextValue => onValueChange(nextValue as SelectableEditingMode)}
    >
      {options.map(option => (
        <DropdownMenuRadioItem
          key={option.value}
          value={option.value}
          disabled={disabled}
          className="items-start gap-3 pl-8"
        >
          <div className={cn('mt-1 h-2.5 w-2.5 rounded-full', option.colorClass)} />
          <option.Icon className="mt-0.5 h-4 w-4" />
          <div className="flex-1">
            <div className="font-medium">{option.label}</div>
            {showDescriptions ? (
              <p className="text-muted-foreground text-xs">{option.description}</p>
            ) : null}
          </div>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
