'use client';

import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Label } from '@/features/shared/ui/ui/label.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip.tsx';
import { Info, Check, MessageSquare, Mic, Vote, Users, ShieldCheck } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

type AgendaItemType = 'election' | 'vote' | 'speech' | 'discussion' | 'accreditation';

interface TypeOption {
  value: AgendaItemType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const typeOptions: TypeOption[] = [
  {
    value: 'discussion',
    label: translateText('generated.inline.0519_discussion_8fb937b6'),
    description: translateText('generated.inline.0520_open_discussion_or_q_a_session_88c93ed7'),
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    value: 'speech',
    label: translateText('generated.inline.0521_speech_d00d8594'),
    description: translateText('generated.inline.0522_presentation_or_address_1a285ed2'),
    icon: <Mic className="h-4 w-4" />,
  },
  {
    value: 'election',
    label: translateText('generated.inline.0523_election_217da2dc'),
    description: translateText('generated.inline.0524_vote_for_roles_or_candidates_58f7c048'),
    icon: <Users className="h-4 w-4" />,
  },
  {
    value: 'vote',
    label: translateText('generated.inline.0498_vote_64f87291'),
    description: translateText('generated.inline.0525_vote_on_a_proposal_or_amendment_af19c393'),
    icon: <Vote className="h-4 w-4" />,
  },
  {
    value: 'accreditation',
    label: translateText('generated.inline.0526_accreditation_f89dc2b3'),
    description: translateText('generated.inline.0527_confirm_attendance_of_participants_311c6fe4'),
    icon: <ShieldCheck className="h-4 w-4" />,
  },
];

interface TypeSelectorProps {
  value: AgendaItemType;
  onChange: (value: AgendaItemType) => void;
  label?: string;
  showTooltip?: boolean;
}

export function TypeSelector({
  value,
  onChange,
  label = 'Type',
  showTooltip = true,
}: TypeSelectorProps) {
  const selectedOption = typeOptions.find(opt => opt.value === value);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        {showTooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="text-muted-foreground h-4 w-4 cursor-help" />
            </TooltipTrigger>
            <TooltipContent variant="rich">
              <p className="text-sm">{selectedOption?.description}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {typeOptions.map(option => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? 'default' : 'outline'}
            onClick={() => onChange(option.value)}
            data-create-option={option.value}
            className="flex items-center gap-2"
          >
            {value === option.value ? <Check className="h-4 w-4" /> : option.icon}
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
