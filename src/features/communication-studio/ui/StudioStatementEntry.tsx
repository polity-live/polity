import { useTranslation } from '@/features/shared/hooks/use-translation';
export function StudioStatementEntry({
  groupId,
  form,
}: {
  groupId?: string | null;
  form: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  if (!import.meta.env.DEV && import.meta.env.VITE_STUDIO_ENABLED !== 'true') return null;
  return (
    <button
      type="button"
      className="rounded-md border px-3 py-2 text-sm"
      onClick={() => {
        sessionStorage.setItem('studio:statement-return', JSON.stringify(form));
        window.location.assign(groupId ? `/group/${groupId}/studio` : '/studio');
      }}
    >
      {t('features.studio.title')}
    </button>
  );
}
