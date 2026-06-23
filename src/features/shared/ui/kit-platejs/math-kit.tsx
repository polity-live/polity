import { MathRules } from '@platejs/math';
import { EquationPlugin, InlineEquationPlugin } from '@platejs/math/react';

import {
  EquationElement,
  InlineEquationElement,
} from '@/features/shared/ui/ui-platejs/equation-node.tsx';

import { isAutoformatRuleEnabled } from './autoformat-kit.tsx';

export const MathKit = [
  InlineEquationPlugin.configure({
    inputRules: [MathRules.markdown({ enabled: isAutoformatRuleEnabled, variant: '$' })],
    node: { component: InlineEquationElement },
  }),
  EquationPlugin.configure({
    inputRules: [
      MathRules.markdown({ enabled: isAutoformatRuleEnabled, on: 'break', variant: '$$' }),
    ],
    node: { component: EquationElement },
  }),
];
