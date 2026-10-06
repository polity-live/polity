// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import {
  createFrameNode,
  embedNodeSchema,
  mediaNodeSchema,
  type StudioNode,
} from '../../logic/document-v3';
import { StudioCanonicalProperties } from '../StudioCanonicalProperties';

function harness(initial: StudioNode) {
  const changed = vi.fn();
  let current = initial;
  function Harness() {
    const [node, setNode] = useState(initial);
    return (
      <StudioCanonicalProperties
        node={node}
        tr={key => key}
        update={change => {
          const next = structuredClone(node);
          change(next);
          current = next;
          changed(next);
          setNode(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { changed, value: () => current, user: userEvent.setup() };
}
it.each([
  ['X', 'x', '45'],
  ['Y', 'y', '73'],
  ['width', 'width', '240'],
  ['height', 'height', '130'],
  ['rotation', 'rotation', '35'],
] as const)(
  'edits the %s geometry using keyboard focus while rejecting empty and out-of-range values',
  async (label, key, value) => {
    const state = harness(createFrameNode('custom'));
    const input = screen.getByLabelText(label) as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
    const before = state.value().transform[key];
    await state.user.clear(input);
    expect(input.value).toBe(String(before));
    expect(state.value().transform[key]).toBe(before);
    await state.user.keyboard(`{Control>}a{/Control}${value}`);
    expect(state.value().transform[key]).toBe(Number(value));
    fireEvent.change(input, { target: { value: '1000001' } });
    expect(state.value().transform[key]).toBe(Number(value));
    fireEvent.change(input, { target: { value: '-1000001' } });
    expect(state.value().transform[key]).toBe(Number(value));
    expect(document.activeElement).toBe(input);
  }
);
it.each([
  ['opacity', '0.6', 'style', 'opacity'],
  ['strokeWidth', '12', 'style', 'strokeWidth'],
  ['order', '8', 'root', 'zIndex'],
] as const)(
  'edits the %s value using keyboard focus and preserves valid state after invalid input',
  async (label, value, scope, key) => {
    const state = harness(createFrameNode('custom'));
    const input = screen.getByLabelText(label) as HTMLInputElement;
    const before = input.value;
    input.focus();
    expect(document.activeElement).toBe(input);
    await state.user.clear(input);
    expect(input.value).toBe(before);
    await state.user.keyboard(`{Control>}a{/Control}${value}`);
    const result =
      scope === 'style'
        ? state.value().style[key as 'opacity' | 'strokeWidth']
        : state.value().zIndex;
    expect(result).toBe(Number(value));
    const valid = structuredClone(state.value());
    for (const invalid of ['1000001', '-1000001', ''])
      fireEvent.change(input, { target: { value: invalid } });
    expect(state.value()).toEqual(valid);
    if (label === 'order') {
      fireEvent.change(input, { target: { value: '1.5' } });
      expect(state.value()).toEqual(valid);
    }
  }
);
it('edits a name using keyboard selection and ignores a blank name', async () => {
  const state = harness(createFrameNode('custom'));
  const input = screen.getByLabelText('name') as HTMLInputElement;
  input.focus();
  expect(document.activeElement).toBe(input);
  await state.user.keyboard('{Control>}a{/Control}');
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  await state.user.keyboard('Changed frame');
  expect(state.value().name).toBe('Changed frame');
  expect(input.selectionStart).toBe(input.selectionEnd);
  await state.user.clear(input);
  expect(state.value().name).toBe('Changed frame');
});
it.each(['locked', 'clipContent'] as const)(
  'toggles %s in both directions by keyboard and retains focus',
  async label => {
    const state = harness(createFrameNode('custom'));
    const checkbox = screen.getByRole('checkbox', { name: label });
    checkbox.focus();
    expect(document.activeElement).toBe(checkbox);
    const original = checkbox.getAttribute('aria-checked');
    await state.user.keyboard(' ');
    expect(checkbox.getAttribute('aria-checked')).not.toBe(original);
    expect(state.value()[label as 'locked']).toBe(original !== 'true');
    await state.user.keyboard(' ');
    expect(checkbox.getAttribute('aria-checked')).toBe(original);
    expect(document.activeElement).toBe(checkbox);
  }
);
it.each(['color', 'border'] as const)(
  'activates the %s picker by keyboard and applies native selections without retaining theme bindings',
  async label => {
    const initial = createFrameNode('custom');
    initial.style.stroke = null;
    initial.style.fillBinding = 'primary';
    initial.style.strokeBinding = 'primary';
    const state = harness(initial);
    const input = screen.getByLabelText(label) as HTMLInputElement;
    const nativeActivation = vi.fn();
    input.addEventListener('click', nativeActivation);
    input.focus();
    expect(document.activeElement).toBe(input);
    await state.user.keyboard('{Enter}');
    expect(nativeActivation).toHaveBeenCalledOnce();
    expect(input.value).toBe(label === 'color' ? '#ffffff' : '#000000');
    fireEvent.change(input, { target: { value: '#123456' } });
    expect(state.value().style[label === 'color' ? 'fill' : 'stroke']).toBe('#123456');
    expect(state.value().style[label === 'color' ? 'fillBinding' : 'strokeBinding']).toBeNull();
    fireEvent.change(input, { target: { value: '#ffffff' } });
    expect(input.value).toBe('#ffffff');
    expect(document.activeElement).toBe(input);
  }
);
it('edits media descriptions by keyboard, changes image fitting and toggles video muting', async () => {
  const initial = mediaNodeSchema.parse({
    ...createFrameNode('custom'),
    type: 'media',
    mediaType: 'video',
    assetId: crypto.randomUUID(),
  });
  const state = harness(initial);
  const alt = screen.getByLabelText('text') as HTMLInputElement;
  alt.focus();
  expect(document.activeElement).toBe(alt);
  await state.user.type(alt, 'Accessible clip');
  expect(state.value()).toMatchObject({ alt: 'Accessible clip' });
  await state.user.clear(alt);
  expect(state.value()).toMatchObject({ alt: '' });
  const fit = screen.getByLabelText('fit');
  fit.focus();
  expect(document.activeElement).toBe(fit);
  await state.user.keyboard('{ArrowDown}');
  await state.user.selectOptions(fit, 'cover');
  expect(state.value()).toMatchObject({ fit: 'cover' });
  await state.user.selectOptions(fit, 'contain');
  expect(state.value()).toMatchObject({ fit: 'contain' });
  const muted = screen.getByRole('checkbox', { name: 'muted' });
  muted.focus();
  await state.user.keyboard(' ');
  expect(state.value()).toMatchObject({ muted: false });
  await state.user.keyboard(' ');
  expect(state.value()).toMatchObject({ muted: true });
  expect(document.activeElement).toBe(muted);
});
it('edits embed content by keyboard without changing node geometry', async () => {
  const initial = embedNodeSchema.parse({
    ...createFrameNode('custom'),
    type: 'embed',
    provider: 'formula',
    value: 'Before',
  });
  const state = harness(initial);
  const input = screen.getByLabelText('embedContent');
  input.focus();
  expect(document.activeElement).toBe(input);
  await state.user.clear(input);
  await state.user.type(input, 'After');
  expect(state.value()).toMatchObject({ value: 'After', transform: initial.transform });
  expect(document.activeElement).toBe(input);
});
it('ignores stale type-specific edits after a collaborator replaces the node type', () => {
  const frame = createFrameNode('custom');
  const media = mediaNodeSchema.parse({
    ...frame,
    type: 'media',
    mediaType: 'video',
    assetId: crypto.randomUUID(),
  });
  const embed = embedNodeSchema.parse({
    ...frame,
    type: 'embed',
    provider: 'code',
    value: 'Before',
  });
  const change = vi.fn();
  const ui = render(<StudioCanonicalProperties node={frame} tr={key => key} update={change} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'clipContent' }));
  change.mock.lastCall?.[0](media);
  expect(media).not.toHaveProperty('clipContent');
  ui.rerender(<StudioCanonicalProperties node={media} tr={key => key} update={change} />);
  for (const [label, value] of [
    ['text', 'Description'],
    ['fit', 'cover'],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    change.mock.lastCall?.[0](frame);
  }
  fireEvent.click(screen.getByRole('checkbox', { name: 'muted' }));
  change.mock.lastCall?.[0](frame);
  expect(frame).not.toHaveProperty('alt');
  expect(frame).not.toHaveProperty('fit');
  expect(frame).not.toHaveProperty('muted');
  ui.rerender(<StudioCanonicalProperties node={embed} tr={key => key} update={change} />);
  fireEvent.change(screen.getByLabelText('embedContent'), { target: { value: 'After' } });
  change.mock.lastCall?.[0](frame);
  expect(frame).not.toHaveProperty('value');
  for (const mediaType of ['audio', 'file'] as const) {
    const node = { ...media, mediaType };
    ui.rerender(<StudioCanonicalProperties node={node} tr={key => key} update={change} />);
    expect(screen.queryByLabelText('fit')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'muted' }) !== null).toBe(mediaType === 'audio');
  }
});
