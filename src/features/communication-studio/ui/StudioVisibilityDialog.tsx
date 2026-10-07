import { useState } from 'react';
import { useStudioClient } from '@/zero/communication-studio/useStudioClient';
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
  const studio = useStudioClient();
  const { t } = useTranslation();
  const [value, setValue] = useState<CreateVisibility>(visibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await studio.setVisibility({ id: projectId, visibility: value });
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
          <Button
            data-action-id="studio.project.visibility.cancel"
            data-action-kind="interaction"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            data-action-id="studio.project.visibility.submit"
            disabled={busy}
            onClick={() => void save()}
          >
            {t('common.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
