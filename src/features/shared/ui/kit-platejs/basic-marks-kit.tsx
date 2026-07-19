import {
  BoldRules,
  CodeRules,
  HighlightRules,
  ItalicRules,
  MarkComboRules,
  StrikethroughRules,
  SubscriptRules,
  SuperscriptRules,
  UnderlineRules,
} from '@platejs/basic-nodes';
import {
  BoldPlugin,
  CodePlugin,
  HighlightPlugin,
  ItalicPlugin,
  KbdPlugin,
  StrikethroughPlugin,
  SubscriptPlugin,
  SuperscriptPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react';

import { CodeLeaf } from '@/features/shared/ui/ui-platejs/code-node.tsx';
import { HighlightLeaf } from '@/features/shared/ui/ui-platejs/highlight-node.tsx';
import { KbdLeaf } from '@/features/shared/ui/ui-platejs/kbd-node.tsx';
import { detectKeyboardPlatform } from '@/features/shared/keyboard/keyboard-shortcut';
import { getEditorPlateHotkeys } from '@/features/shared/ui/ui-platejs/editor-shortcuts';

import { isAutoformatRuleEnabled } from './autoformat-kit.tsx';

const editorHotkeys = getEditorPlateHotkeys(detectKeyboardPlatform());

export const BasicMarksKit = [
  BoldPlugin.configure({
    shortcuts: { toggle: { keys: editorHotkeys.bold } },
    inputRules: [
      BoldRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '*' }),
      BoldRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '_' }),
      MarkComboRules.markdown({ enabled: isAutoformatRuleEnabled, variant: 'boldItalic' }),
      MarkComboRules.markdown({ enabled: isAutoformatRuleEnabled, variant: 'boldUnderline' }),
      MarkComboRules.markdown({
        enabled: isAutoformatRuleEnabled,
        variant: 'boldItalicUnderline',
      }),
      MarkComboRules.markdown({ enabled: isAutoformatRuleEnabled, variant: 'italicUnderline' }),
    ],
  }),
  ItalicPlugin.configure({
    shortcuts: { toggle: { keys: editorHotkeys.italic } },
    inputRules: [
      ItalicRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '*' }),
      ItalicRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '_' }),
    ],
  }),
  UnderlinePlugin.configure({
    shortcuts: { toggle: { keys: editorHotkeys.underline } },
    inputRules: [UnderlineRules.markdown({ enabled: isAutoformatRuleEnabled })],
  }),
  CodePlugin.configure({
    inputRules: [CodeRules.markdown({ enabled: isAutoformatRuleEnabled })],
    node: { component: CodeLeaf },
    shortcuts: { toggle: { keys: editorHotkeys.code } },
  }),
  StrikethroughPlugin.configure({
    inputRules: [StrikethroughRules.markdown({ enabled: isAutoformatRuleEnabled })],
    shortcuts: { toggle: { keys: editorHotkeys.strikethrough } },
  }),
  SubscriptPlugin.configure({
    inputRules: [SubscriptRules.markdown({ enabled: isAutoformatRuleEnabled })],
    shortcuts: { toggle: { keys: 'mod+comma' } },
  }),
  SuperscriptPlugin.configure({
    inputRules: [SuperscriptRules.markdown({ enabled: isAutoformatRuleEnabled })],
    shortcuts: { toggle: { keys: 'mod+period' } },
  }),
  HighlightPlugin.configure({
    inputRules: [
      HighlightRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '==' }),
      HighlightRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '≡' }),
    ],
    node: { component: HighlightLeaf },
    shortcuts: { toggle: { keys: 'mod+shift+h' } },
  }),
  KbdPlugin.withComponent(KbdLeaf),
];
