import {
  BoldIcon,
  Code2Icon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
  WandSparklesIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorReadOnly } from 'platejs/react';
import { useTranslation } from 'react-i18next';

import { AIToolbarButton } from './ai-toolbar-button.tsx';
import { CommentToolbarButton } from './comment-toolbar-button.tsx';
import { InlineEquationToolbarButton } from './equation-toolbar-button.tsx';
import { LinkToolbarButton } from './link-toolbar-button.tsx';
import { MarkToolbarButton } from './mark-toolbar-button.tsx';
import { MoreToolbarButton } from './more-toolbar-button.tsx';
import { SuggestionToolbarButton } from './suggestion-toolbar-button.tsx';
import { ToolbarGroup } from '@/features/shared/ui/layout';
import { TurnIntoToolbarButton } from './turn-into-toolbar-button.tsx';

export function FloatingToolbarButtons() {
  const readOnly = useEditorReadOnly();
  const { t } = useTranslation();

  return (
    <>
      {!readOnly && (
        <>
          <ToolbarGroup>
            <AIToolbarButton tooltip={t('plateJs.toolbar.aiCommands')}>
              <WandSparklesIcon />
              {t('plateJs.toolbar.askAI')}
            </AIToolbarButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <TurnIntoToolbarButton />

            <MarkToolbarButton nodeType={KEYS.bold} tooltip={t('plateJs.toolbar.bold')}>
              <BoldIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.italic} tooltip={t('plateJs.toolbar.italic')}>
              <ItalicIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.underline} tooltip={t('plateJs.toolbar.underline')}>
              <UnderlineIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.strikethrough}
              tooltip={t('plateJs.toolbar.strikethrough')}
            >
              <StrikethroughIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.code} tooltip={t('plateJs.toolbar.code')}>
              <Code2Icon />
            </MarkToolbarButton>

            <InlineEquationToolbarButton />

            <LinkToolbarButton />
          </ToolbarGroup>
        </>
      )}

      <ToolbarGroup>
        <CommentToolbarButton />
        <SuggestionToolbarButton />

        {!readOnly && <MoreToolbarButton />}
      </ToolbarGroup>
    </>
  );
}
