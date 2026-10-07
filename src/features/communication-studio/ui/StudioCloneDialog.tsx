import { useState, type RefObject } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useNavigate } from '@tanstack/react-router';
import { queries } from '@/zero/queries';
import { useStudioClient } from '@/zero/communication-studio/useStudioClient';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import type { CreateVisibility } from '@/features/create/logic/createVisibility';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';

export function StudioCloneDialog({
  sourceId,
  open,
  onOpenChange,
  beforeClone,
  restoreFocusRef,
}: {
  sourceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beforeClone?: () => Promise<unknown>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const studio = useStudioClient();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [groups] = useQuery(queries.studio.manageGroups());
  const [groupId, setGroupId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<CreateVisibility>('private');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const clone = async () => {
    setBusy(true);
    setError('');
    try {
      await beforeClone?.();
      const result = await studio.duplicate({
        id: sourceId,
        groupId,
        visibility,
      });
      onOpenChange(false);
      if (groupId)
        await navigate({
          to: '/group/$id/studio/$projectId',
          params: { id: groupId, projectId: result.id },
        });
      else await navigate({ to: '/studio/$projectId', params: { projectId: result.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('features.studio.cloneFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={
          restoreFocusRef
            ? event => {
                event.preventDefault();
                restoreFocusRef.current?.focus();
              }
            : undefined
        }
      >
        <DialogHeader>
          <DialogTitle>{t('features.studio.cloneProject')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span>{t('features.studio.cloneDestination')}</span>
            <select
              data-action-id="studio.project.clone.destination"
              className="bg-background w-full rounded-md border px-3 py-2"
              value={groupId ?? ''}
              onChange={event => setGroupId(event.target.value || null)}
            >
              <option value="">{t('features.studio.personalStudio')}</option>
              {(groups ?? []).map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <VisibilityInput
            value={visibility}
            onChange={setVisibility}
            label={t('pages.create.common.visibility')}
          />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            data-action-id="studio.project.clone.cancel"
            data-action-kind="interaction"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            data-action-id="studio.project.clone.submit"
            disabled={busy}
            onClick={() => void clone()}
          >
            {t('features.studio.cloneProject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
