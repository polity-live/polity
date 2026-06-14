import { SuggestionPlugin } from '@platejs/suggestion/react';
import { useEditorPlugin, usePluginOption } from 'platejs/react';
import { useTranslation } from 'react-i18next';

import { SuggestionToolbarButtonView } from './SuggestionToolbarButtonView';
export function SuggestionToolbarButton() {
  const { setOption } = useEditorPlugin(SuggestionPlugin);
  const isSuggesting = usePluginOption(SuggestionPlugin, 'isSuggesting');
  const { t } = useTranslation();
  return <SuggestionToolbarButtonView setOption={setOption} isSuggesting={isSuggesting} t={t} />;
}
