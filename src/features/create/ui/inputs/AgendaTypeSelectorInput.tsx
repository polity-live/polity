import { TypeSelector } from '@/features/shared/ui/form';
import { TooltipProvider } from '@/features/shared/ui/ui/tooltip';

type AgendaItemType = 'election' | 'vote' | 'speech' | 'discussion' | 'accreditation';

interface AgendaTypeSelectorInputProps {
  delegateAssignment: boolean;
  type: AgendaItemType;
  lockedTitle: string;
  lockedDescription: string;
  onTypeChange: (type: AgendaItemType) => void;
}

export function AgendaTypeSelectorInput({
  delegateAssignment,
  type,
  lockedTitle,
  lockedDescription,
  onTypeChange,
}: AgendaTypeSelectorInputProps) {
  if (delegateAssignment) {
    return (
      <div className="bg-muted/30 rounded-2xl border p-4">
        <p className="text-sm font-medium">{lockedTitle}</p>
        <p className="text-muted-foreground text-sm">{lockedDescription}</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <TypeSelector value={type} onChange={onTypeChange} />
    </TooltipProvider>
  );
}
