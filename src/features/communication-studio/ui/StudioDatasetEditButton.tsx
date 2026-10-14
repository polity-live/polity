import { useTranslation } from 'react-i18next';

export function StudioDatasetEditButton({
  disabled,
  onEdit,
}: {
  disabled: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-action-id="communication-studio.dataset.edit.open"
      className="w-full rounded-md border px-3 py-2 text-sm"
      disabled={disabled}
      onClick={onEdit}
    >
      {t('plateJs.dataView.editTitle')}
    </button>
  );
}
