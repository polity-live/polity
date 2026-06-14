import { useEditorReadOnly } from 'platejs/react';
import { useTranslation } from 'react-i18next';

import { FloatingToolbarButtonsView } from './FloatingToolbarButtonsView';
export function FloatingToolbarButtons() {
  const readOnly = useEditorReadOnly();
  const { t } = useTranslation();
  return <FloatingToolbarButtonsView readOnly={readOnly} t={t} />;
}
