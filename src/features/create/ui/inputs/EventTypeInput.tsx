import { ChoiceCardField } from '@/features/shared/ui/form';
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
    <ChoiceCardField
      id="event-type"
      label={t('pages.create.event.eventType')}
      value={value}
      onValueChange={onChange}
      options={options.map(option => ({
        value: option.value,
        label: t(`pages.create.event.eventTypes.${getEventTypeTranslationKey(option.value)}`),
        description: t(`pages.create.event.eventTypes.${option.descriptionKey}`),
      }))}
    />
  );
}
