import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defaultBrand, elementSchema } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import type { RichTextNode, StudioPlateElement } from '../../logic/document-v3';
import { StudioInlineTextEditor } from '../StudioInlineTextEditor';
import { StudioTextEditor, type StudioTextSelectionEditor } from '../StudioTextEditor';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: () => 'Edit text' }),
  translate: (key: string) => key,
}));

afterEach(cleanup);

function paragraph(text: string, properties: Record<string, unknown> = {}) {
  return { id: crypto.randomUUID(), type: 'p' as const, children: [{ text }], ...properties };
}

function inlineNode(content?: StudioPlateElement[]): RichTextNode {
  const document = createStudioTemplateDocumentV5('single', 'Formatting', defaultBrand);
  const node = document.nodes.find(node => node.type === 'richText')! as RichTextNode;
  return {
    ...node,
    content: content ?? [
      { ...paragraph('Alpha'), children: [{ id: crypto.randomUUID(), text: 'Alpha' }] },
    ],
  };
}

it.each(['native', 'legacy'] as const)(
  'applies and removes toolbar marks to the actual selected %s editor text',
  async kind => {
    let toolbar: StudioTextSelectionEditor | null = null;
    const register = (editor: StudioTextSelectionEditor | null) => {
      toolbar = editor;
    };
    const changed = vi.fn();
    const rendered = render(
      kind === 'native' ? (
        <StudioInlineTextEditor node={inlineNode()} onChange={changed} register={register} />
      ) : (
        <StudioTextEditor
          element={elementSchema.parse({
            id: crypto.randomUUID(),
            type: 'text',
            x: 0,
            y: 0,
            width: 400,
            height: 100,
            text: 'Alpha',
          })}
          onChange={changed}
          register={register}
        />
      )
    );
    const editable = screen.getByRole('textbox', { name: 'Edit text' });
    await userEvent.click(editable);
    await waitFor(() => expect(document.activeElement).toBe(editable));
    await userEvent.keyboard('{Home}{Shift>}{End}{/Shift}');
    await waitFor(() => expect(window.getSelection()?.toString()).toBe('Alpha'));
    await act(async () => {
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    });
    await act(async () => {
      toolbar!.mark('bold', true);
      toolbar!.mark('italic', true);
      toolbar!.setMark('underline', true);
      toolbar!.setMark('strikethrough', true);
      toolbar!.setMark('color', '#112233');
      toolbar!.setMark('fontSize', 24);
      toolbar!.setMark('fontFamily', 'Inter');
    });
    await waitFor(() => expect(changed).toHaveBeenCalled());
    const content = () =>
      kind === 'native' ? changed.mock.lastCall![0] : changed.mock.lastCall![0].richText;
    expect(content()[0].children[0]).toMatchObject({
      text: 'Alpha',
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
      color: '#112233',
      fontSize: 24,
      fontFamily: 'Inter',
    });
    await act(async () => {
      toolbar!.mark('bold', false);
      toolbar!.mark('italic', null);
      toolbar!.setMark('underline', null);
      toolbar!.mark('color', '#445566');
      toolbar!.paragraph('align', 'center');
      toolbar!.paragraph('list', 'number');
    });
    await waitFor(() => expect(content()[0]).toMatchObject({ align: 'center', list: 'number' }));
    expect(content()[0].children[0]).toMatchObject({ bold: false, color: '#445566' });
    expect(content()[0].children[0].italic).toBeUndefined();
    expect(content()[0].children[0].underline).toBeUndefined();
    expect(editable.querySelector('[data-slate-node="element"]')).toHaveStyle({
      display: 'list-item',
      listStyleType: 'decimal',
    });
    await act(async () => {
      toolbar!.paragraph('list', 'bullet');
    });
    await waitFor(() =>
      expect(editable.querySelector('[data-slate-node="element"]')).toHaveStyle({
        listStyleType: 'disc',
      })
    );
    rendered.unmount();
    expect(toolbar).toBeNull();
  }
);

it('publishes native typing with stable node identities, links, highlight and external content updates', async () => {
  let toolbar: StudioTextSelectionEditor | null = null;
  const register = (editor: StudioTextSelectionEditor | null) => {
    toolbar = editor;
  };
  const changed = vi.fn();
  const node = inlineNode();
  node.style.fill = null;
  node.content[0].children[0] = {
    id: crypto.randomUUID(),
    text: 'Alpha',
    highlight: true,
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
  };
  const rendered = render(
    <StudioInlineTextEditor node={node} onChange={changed} register={register} />
  );
  const editable = screen.getByRole('textbox', { name: 'Edit text' });
  expect(editable).toHaveStyle({ color: '#12362D' });
  expect(editable.querySelector('[data-slate-leaf="true"]')).toHaveStyle({
    backgroundColor: '#FFF0A8',
  });
  await userEvent.click(editable);
  await userEvent.keyboard('{Control>}a{/Control}');
  await act(async () => {
    toolbar!.mark('url', 'https://polity.live');
  });
  await waitFor(() => expect(changed.mock.lastCall![0][0].url).toBe('https://polity.live'));
  const updated = structuredClone(node);
  updated.content = [
    {
      id: crypto.randomUUID(),
      type: 'p',
      children: [{ id: crypto.randomUUID(), text: 'Remote', backgroundColor: '#112233' }],
    },
  ];
  rendered.rerender(
    <StudioInlineTextEditor node={updated} onChange={changed} register={register} />
  );
  await waitFor(() => expect(editable).toHaveTextContent('Remote'));
  await userEvent.click(editable);
  await userEvent.keyboard('{End}X{Enter}Second');
  await waitFor(() => expect(changed.mock.lastCall![0]).toHaveLength(2));
  const saved = changed.mock.lastCall![0] as StudioPlateElement[];
  expect(
    saved.map(block => block.children.map(child => ('text' in child ? child.text : '')).join(''))
  ).toEqual(['RemoteX', 'Second']);
  expect(
    saved.every(
      block =>
        typeof block.id === 'string' && block.children.every(child => typeof child.id === 'string')
    )
  ).toBe(true);
});

it.each(['top', 'middle', 'bottom'] as const)(
  'renders legacy %s alignment and preserves explicit false marks across remote and typed changes',
  async verticalAlign => {
    const changed = vi.fn();
    const register = vi.fn();
    const element = elementSchema.parse({
      id: crypto.randomUUID(),
      type: 'text',
      x: 0,
      y: 0,
      width: 400,
      height: 100,
      text: 'Plain\nSecond',
      bold: true,
      italic: true,
      verticalAlign,
    });
    const rendered = render(
      <StudioTextEditor element={element} onChange={changed} register={register} />
    );
    const editable = screen.getByRole('textbox', { name: 'Edit text' });
    expect(editable).toHaveStyle({
      justifyContent:
        verticalAlign === 'middle'
          ? 'center'
          : verticalAlign === 'bottom'
            ? 'flex-end'
            : 'flex-start',
    });
    const remote = {
      ...element,
      text: 'Remote',
      richText: [
        paragraph('Remote', {
          children: [
            { text: 'Remote', bold: false, italic: false, underline: true, strikethrough: true },
          ],
        }),
      ],
    };
    rendered.rerender(<StudioTextEditor element={remote} onChange={changed} register={register} />);
    await waitFor(() => expect(editable).toHaveTextContent('Remote'));
    expect(editable.querySelector('[data-slate-leaf="true"]')).toHaveStyle({
      fontWeight: 'normal',
      fontStyle: 'normal',
    });
    rendered.rerender(
      <StudioTextEditor
        element={{ ...element, text: 'Plain again', richText: [] }}
        onChange={changed}
        register={register}
      />
    );
    await waitFor(() => expect(editable).toHaveTextContent('Plain again'));
    await userEvent.click(editable);
    await userEvent.keyboard('{End}X{Enter}New');
    await waitFor(() => expect(changed.mock.lastCall![0].text).toBe('Plain againX\nNew'));
    const ids = changed.mock.lastCall![0].richText.map((block: { id: string }) => block.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id: string) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
  }
);

it.each(['native', 'legacy'] as const)(
  'keeps %s toolbar actions usable after DOM selection moves outside or to another editor',
  async kind => {
    let toolbar: StudioTextSelectionEditor | null = null;
    const register = (editor: StudioTextSelectionEditor | null) => {
      toolbar = editor;
    };
    const element = elementSchema.parse({
      id: crypto.randomUUID(),
      type: 'text',
      x: 0,
      y: 0,
      width: 400,
      height: 100,
      text: 'Target',
    });
    render(
      <>
        <button>Outside</button>
        <StudioInlineTextEditor node={inlineNode()} onChange={vi.fn()} register={vi.fn()} />
        {kind === 'native' ? (
          <StudioInlineTextEditor
            node={inlineNode([
              { ...paragraph('Target'), children: [{ id: crypto.randomUUID(), text: 'Target' }] },
            ])}
            onChange={vi.fn()}
            register={register}
          />
        ) : (
          <StudioTextEditor element={element} onChange={vi.fn()} register={register} />
        )}
      </>
    );
    const editors = screen.getAllByRole('textbox', { name: 'Edit text' });
    await userEvent.click(editors[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Outside' }));
    window.getSelection()!.removeAllRanges();
    await act(async () => {
      toolbar!.mark('bold', true);
    });
    await userEvent.click(editors[0]);
    await userEvent.keyboard('{Control>}a{/Control}');
    await act(async () => {
      toolbar!.paragraph('align', 'right');
    });
    expect(editors[1]).toHaveTextContent('Target');
    expect(editors[0]).toHaveTextContent('Alpha');
  }
);
