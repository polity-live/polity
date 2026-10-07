import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Toolbar } from '@/features/shared/ui/layout';
import { StudioPanel } from '../StudioPanel';

it('renders the closed toolbar on the server without allocating a DOM portal or exposing panel content', () => {
  const html = renderToString(
    createElement(
      Toolbar,
      null,
      createElement(StudioPanel, {
        label: 'Layers',
        panelKey: 'layers',
        children: 'Private panel content',
      })
    )
  );
  expect(html).toContain('Layers');
  expect(html).toContain('data-state="closed"');
  expect(html).not.toContain('Private panel content');
});
