/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Toolbar } from '@/features/shared/ui/layout';
import { ExportToolbarButtonView } from '../ExportToolbarButtonView';

describe('ExportToolbarButtonView', () => {
  afterEach(() => {
    cleanup();
  });

  const renderExportMenu = () => {
    const exportToWord = vi.fn(() => Promise.resolve());

    render(
      <Toolbar>
        <ExportToolbarButtonView
          open
          onOpenChange={vi.fn()}
          labels={{
            export: 'Export',
            html: 'Export as HTML',
            pdf: 'Export as PDF',
            image: 'Export as Image',
            markdown: 'Export as Markdown',
            word: 'Export as Word',
          }}
          exportToHtml={vi.fn(() => Promise.resolve())}
          exportToPdf={vi.fn(() => Promise.resolve())}
          exportToImage={vi.fn(() => Promise.resolve())}
          exportToMarkdown={vi.fn(() => Promise.resolve())}
          exportToWord={exportToWord}
        />
      </Toolbar>
    );

    return { exportToWord };
  };

  it('shows Word next to the existing export formats', () => {
    renderExportMenu();

    expect(screen.getByRole('menuitem', { name: 'Export as HTML' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Export as PDF' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Export as Image' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Export as Markdown' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Export as Word' })).toBeTruthy();
  });

  it('calls the Word export handler', () => {
    const { exportToWord } = renderExportMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Export as Word' }));

    expect(exportToWord).toHaveBeenCalledTimes(1);
  });
});
