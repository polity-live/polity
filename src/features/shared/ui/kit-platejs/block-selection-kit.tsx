import { BlockSelectionPlugin } from '@platejs/selection/react';
import { getPluginTypes, KEYS } from 'platejs';
import { useEffect } from 'react';
import { createPlatePlugin, usePluginOption, type PlateElementProps } from 'platejs/react';
import { useTranslation } from 'react-i18next';

import { BlockSelection } from '@/features/shared/ui/ui-platejs/block-selection.tsx';

function BlockSelectionShadowInputAccessibility() {
  const shadowInputRef = usePluginOption(BlockSelectionPlugin, 'shadowInputRef');
  const { t } = useTranslation();

  useEffect(() => {
    const labelShadowInput = () => {
      const input = shadowInputRef?.current;
      if (input) {
        input.setAttribute('aria-label', t('plateJs.toolbar.blockSelectionInput'));
      }
    };

    labelShadowInput();
    const observer = new MutationObserver(labelShadowInput);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [shadowInputRef, t]);

  return null;
}

const BlockSelectionAccessibilityPlugin = createPlatePlugin({
  key: 'blockSelectionAccessibility',
  render: {
    afterEditable: BlockSelectionShadowInputAccessibility,
  },
});

export const BlockSelectionKit = [
  BlockSelectionPlugin.configure(({ editor }) => ({
    options: {
      enableContextMenu: true,
      isSelectable: element => {
        return !getPluginTypes(editor, [KEYS.column, KEYS.codeLine, KEYS.table, KEYS.td]).includes(
          element.type
        );
      },
    },
    render: {
      belowRootNodes: props => {
        if (!props.attributes.className?.includes('slate-selectable')) return null;

        return <BlockSelection {...(props as unknown as PlateElementProps)} />;
      },
    },
  })),
  BlockSelectionAccessibilityPlugin,
];
