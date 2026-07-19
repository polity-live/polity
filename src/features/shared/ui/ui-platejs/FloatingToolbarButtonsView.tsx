import {
  BoldIcon,
  Code2Icon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
  WandSparklesIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';

import { AIToolbarButton } from './ai-toolbar-button.tsx';
import { CommentToolbarButton } from './comment-toolbar-button.tsx';
import { InlineEquationToolbarButton } from './equation-toolbar-button.tsx';
import { LinkToolbarButton } from './link-toolbar-button.tsx';
import { MarkToolbarButton } from './mark-toolbar-button.tsx';
import { MoreToolbarButton } from './more-toolbar-button.tsx';
import { SuggestionToolbarButton } from './suggestion-toolbar-button.tsx';
import { ToolbarGroup } from '@/features/shared/ui/layout';
import { TurnIntoToolbarButton } from './turn-into-toolbar-button.tsx';
import { editorShortcuts } from './editor-shortcuts';
export interface FloatingToolbarButtonsViewProps {
  readOnly: any;
  t: any;
}

export function FloatingToolbarButtonsView({ readOnly, t }: FloatingToolbarButtonsViewProps) {
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

            <MarkToolbarButton
              nodeType={KEYS.bold}
              tooltip={t('plateJs.toolbar.bold')}
              tooltipShortcut={editorShortcuts.bold}
            >
              <BoldIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.italic}
              tooltip={t('plateJs.toolbar.italic')}
              tooltipShortcut={editorShortcuts.italic}
            >
              <ItalicIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.underline}
              tooltip={t('plateJs.toolbar.underline')}
              tooltipShortcut={editorShortcuts.underline}
            >
              <UnderlineIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.strikethrough}
              tooltip={t('plateJs.toolbar.strikethrough')}
              tooltipShortcut={editorShortcuts.strikethrough}
            >
              <StrikethroughIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.code}
              tooltip={t('plateJs.toolbar.code')}
              tooltipShortcut={editorShortcuts.code}
            >
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
