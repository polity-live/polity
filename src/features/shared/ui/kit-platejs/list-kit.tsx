import { BulletedListRules, OrderedListRules, TaskListRules } from '@platejs/list';
import { ListPlugin } from '@platejs/list/react';
import { KEYS } from 'platejs';

import { IndentKit } from '@/features/shared/ui/kit-platejs/indent-kit.tsx';
import { BlockList } from '@/features/shared/ui/ui-platejs/block-list.tsx';

import { isAutoformatRuleEnabled } from './autoformat-kit.tsx';

export const ListKit = [
  ...IndentKit,
  ListPlugin.configure({
    inputRules: [
      BulletedListRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '-' }),
      BulletedListRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '*' }),
      OrderedListRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '.' }),
      OrderedListRules.markdown({ enabled: isAutoformatRuleEnabled, variant: ')' }),
      TaskListRules.markdown({ checked: false, enabled: isAutoformatRuleEnabled }),
      TaskListRules.markdown({ checked: true, enabled: isAutoformatRuleEnabled }),
    ],
    inject: {
      targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote, KEYS.codeBlock, KEYS.toggle],
    },
    render: {
      belowNodes: BlockList,
    },
  }),
];
