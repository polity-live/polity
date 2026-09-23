import { useState } from 'react';
import { studioRequest } from '@/zero/communication-studio/useStudioApi';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import type { CreateVisibility } from '@/features/create/logic/createVisibility';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';

export function StudioVisibilityDialog({
  projectId,
  visibility,
  open,
  onOpenChange,
}: {
  projectId: string;
  visibility: CreateVisibility;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState<CreateVisibility>(visibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await studioRequest('visibility', { id: projectId, visibility: value });
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pages.create.common.visibility')}</DialogTitle>
        </DialogHeader>
        <VisibilityInput
          value={value}
          onChange={setValue}
          label={t('pages.create.common.visibility')}
        />
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            {t('common.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
