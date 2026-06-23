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

import { isAutoformatRuleEnabled } from './autoformat-kit.tsx';

export const BasicMarksKit = [
  BoldPlugin.configure({
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
    inputRules: [
      ItalicRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '*' }),
      ItalicRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '_' }),
    ],
  }),
  UnderlinePlugin.configure({
    inputRules: [UnderlineRules.markdown({ enabled: isAutoformatRuleEnabled })],
  }),
  CodePlugin.configure({
    inputRules: [CodeRules.markdown({ enabled: isAutoformatRuleEnabled })],
    node: { component: CodeLeaf },
    shortcuts: { toggle: { keys: 'mod+e' } },
  }),
  StrikethroughPlugin.configure({
    inputRules: [StrikethroughRules.markdown({ enabled: isAutoformatRuleEnabled })],
    shortcuts: { toggle: { keys: 'mod+shift+x' } },
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
