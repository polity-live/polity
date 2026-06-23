import { BlockquoteRules, HeadingRules, HorizontalRuleRules } from '@platejs/basic-nodes';
import {
  BlockquotePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  HorizontalRulePlugin,
} from '@platejs/basic-nodes/react';
import { ParagraphPlugin } from 'platejs/react';

import { BlockquoteElement } from '@/features/shared/ui/ui-platejs/blockquote-node.tsx';
import { H1Element, H2Element, H3Element } from '@/features/shared/ui/ui-platejs/heading-node.tsx';
import { HrElement } from '@/features/shared/ui/ui-platejs/hr-node.tsx';
import { ParagraphElement } from '@/features/shared/ui/ui-platejs/paragraph-node.tsx';

import { isAutoformatRuleEnabled } from './autoformat-kit.tsx';

export const BasicBlocksKit = [
  ParagraphPlugin.withComponent(ParagraphElement),
  H1Plugin.configure({
    inputRules: [HeadingRules.markdown({ enabled: isAutoformatRuleEnabled })],
    node: {
      component: H1Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: 'mod+alt+1' } },
  }),
  H2Plugin.configure({
    inputRules: [HeadingRules.markdown({ enabled: isAutoformatRuleEnabled })],
    node: {
      component: H2Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: 'mod+alt+2' } },
  }),
  H3Plugin.configure({
    inputRules: [HeadingRules.markdown({ enabled: isAutoformatRuleEnabled })],
    node: {
      component: H3Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: 'mod+alt+3' } },
  }),
  BlockquotePlugin.configure({
    inputRules: [BlockquoteRules.markdown({ enabled: isAutoformatRuleEnabled })],
    node: { component: BlockquoteElement },
    shortcuts: { toggle: { keys: 'mod+shift+period' } },
  }),
  HorizontalRulePlugin.configure({
    inputRules: [
      HorizontalRuleRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '-' }),
      HorizontalRuleRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '_' }),
    ],
    node: { component: HrElement },
  }),
];
