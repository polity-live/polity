import {
  FormControlLabel,
  FormControlRadioGroup,
  FormControlRadioGroupItem,
} from '@/features/shared/ui/form';
import { getEventTypeTranslationKey } from '@/features/events/logic/getEventTypeTranslationKey';
import { useTranslation } from '@/features/shared/hooks/use-translation';

type EventType = 'delegate_assembly' | 'general_assembly' | 'open' | 'on_invite' | 'meeting';

interface EventTypeInputProps {
  value: EventType;
  onChange: (eventType: EventType) => void;
}

export function EventTypeInput({ value, onChange }: EventTypeInputProps) {
  const { t } = useTranslation();

  const options: { value: EventType; descriptionKey: string }[] = [
    { value: 'delegate_assembly', descriptionKey: 'delegateAssemblyDesc' },
    { value: 'general_assembly', descriptionKey: 'generalAssemblyDesc' },
    { value: 'open', descriptionKey: 'openDesc' },
    { value: 'meeting', descriptionKey: 'meetingDesc' },
    { value: 'on_invite', descriptionKey: 'onInviteDesc' },
  ];

  return (
    <div className="space-y-3">
      <FormControlLabel>{t('pages.create.event.eventType')}</FormControlLabel>
      <FormControlRadioGroup value={value} onValueChange={v => onChange(v as EventType)}>
        <div className="space-y-2">
          {options.map(opt => (
            <FormControlLabel
              key={opt.value}
              htmlFor={`event-type-${opt.value}`}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                value === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <FormControlRadioGroupItem
                value={opt.value}
                id={`event-type-${opt.value}`}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">
                  {t(`pages.create.event.eventTypes.${getEventTypeTranslationKey(opt.value)}`)}
                </div>
                <div className="text-muted-foreground text-xs">
                  {t(`pages.create.event.eventTypes.${opt.descriptionKey}`)}
                </div>
              </div>
            </FormControlLabel>
          ))}
        </div>
      </FormControlRadioGroup>
    </div>
  );
}
