const interactiveElements = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary']);

const noNativeTitleTooltip = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      forbidden:
        'Native title tooltips are not allowed on interactive elements. Use the shared Tooltip or a tooltip prop instead.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || !interactiveElements.has(node.name.name)) {
          return;
        }

        const titleAttribute = node.attributes.find(
          attribute =>
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === 'title'
        );

        if (titleAttribute) {
          context.report({ node: titleAttribute, messageId: 'forbidden' });
        }
      },
    };
  },
};

export default {
  meta: {
    name: 'polity',
  },
  rules: {
    'no-native-title-tooltip': noNativeTitleTooltip,
  },
};
