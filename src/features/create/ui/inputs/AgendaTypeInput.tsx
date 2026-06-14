import { ChoiceCardField } from '@/features/shared/ui/form';
import { Mic, Vote, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type AgendaType = 'election' | 'vote' | 'speech' | 'discussion';

interface AgendaTypeInputProps {
  value: AgendaType;
  onChange: (type: AgendaType) => void;
  label?: string;
}

const AGENDA_TYPE_OPTIONS: { value: AgendaType; icon: LucideIcon }[] = [
  { value: 'election', icon: Vote },
  { value: 'vote', icon: Vote },
  { value: 'speech', icon: Mic },
  { value: 'discussion', icon: MessageSquare },
];

export function AgendaTypeInput({ value, onChange, label = 'Type' }: AgendaTypeInputProps) {
  return (
    <ChoiceCardField
      id="agenda-type"
      label={label}
      value={value}
      onValueChange={onChange}
      grid="four"
      options={AGENDA_TYPE_OPTIONS.map(option => ({
        value: option.value,
        icon: option.icon,
        label: option.value,
      }))}
    />
  );
}
