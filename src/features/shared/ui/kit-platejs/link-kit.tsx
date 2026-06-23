import { LinkRules } from '@platejs/link';
import { LinkPlugin } from '@platejs/link/react';

import { LinkElement } from '@/features/shared/ui/ui-platejs/link-node.tsx';
import { LinkFloatingToolbar } from '@/features/shared/ui/ui-platejs/link-toolbar.tsx';

import { isAutoformatRuleEnabled } from './autoformat-kit.tsx';

export const LinkKit = [
  LinkPlugin.configure({
    inputRules: [
      LinkRules.markdown({ enabled: isAutoformatRuleEnabled }),
      LinkRules.autolink({ enabled: isAutoformatRuleEnabled, variant: 'paste' }),
      LinkRules.autolink({ enabled: isAutoformatRuleEnabled, variant: 'space' }),
      LinkRules.autolink({ enabled: isAutoformatRuleEnabled, variant: 'break' }),
    ],
    render: {
      node: LinkElement,
      afterEditable: () => <LinkFloatingToolbar />,
    },
  }),
];
