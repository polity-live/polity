import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { FormControlLabel } from '@/features/shared/ui/form';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

type AttendanceMode = 'online' | 'hybrid' | 'offline';

interface EventAttendanceModeSelectorProps {
  value: AttendanceMode;
  locked: boolean;
  onChange: (mode: AttendanceMode) => void;
  t: (key: string) => string;
}

export function EventAttendanceModeSelector({
  value,
  locked,
  onChange,
  t,
}: EventAttendanceModeSelectorProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FormControlLabel>
          {translateText('generated.inline.0327_attendance_mode_507f30a9')}
        </FormControlLabel>
        {locked ? (
          <Popover open={helpOpen} onOpenChange={setHelpOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
                aria-label={t(
                  'features.events.editPage.locationCapacity.attendanceModeLockedLabel'
                )}
                onPointerEnter={event => {
                  if (event.pointerType === 'mouse') setHelpOpen(true);
                }}
                onPointerLeave={event => {
                  if (event.pointerType === 'mouse') setHelpOpen(false);
                }}
              >
                <CircleHelp className="size-4" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 text-sm"
              onPointerEnter={event => {
                if (event.pointerType === 'mouse') setHelpOpen(true);
              }}
              onPointerLeave={event => {
                if (event.pointerType === 'mouse') setHelpOpen(false);
              }}
            >
              {t('features.events.editPage.locationCapacity.attendanceModeLockedDescription')}
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {(['online', 'hybrid', 'offline'] as const).map(mode => (
          <Button
            key={mode}
            type="button"
            variant={value === mode ? 'default' : 'outline'}
            onClick={() => onChange(mode)}
            disabled={locked}
          >
            {mode === 'online'
              ? translateText('generated.inline.0046_online_c3e839df')
              : mode === 'hybrid'
                ? translateText('generated.inline.0047_hybrid_8e01f6bc')
                : translateText('generated.inline.0048_offline_e01fa717')}
          </Button>
        ))}
      </div>
    </div>
  );
}
