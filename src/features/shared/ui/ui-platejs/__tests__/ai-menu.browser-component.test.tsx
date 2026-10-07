import { render, screen, waitFor } from '@testing-library/react';
import { Component, StrictMode, useState, type ReactNode } from 'react';
import { createPlateEditor, Plate, ParagraphPlugin } from 'platejs/react';
import { AIChatPlugin } from '@platejs/ai/react';
import { BlockSelectionPlugin } from '@platejs/selection/react';
import { NodeApi, type TRange, type Value } from 'platejs';
import { Toolbar } from '@/features/shared/ui/layout';
import { AIToolbarButton } from '../ai-toolbar-button';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AIKit } from '@/features/shared/ui/kit-platejs/ai-kit';
import { EditorKitWithoutFixedToolbar } from '@/features/shared/ui/kit-platejs/editor-kit';
import { PlateEditor as AmendmentPlateEditor } from '@/features/shared/ui/kit-platejs/plate-editor';
import { BlockMenuKit } from '@/features/shared/ui/kit-platejs/block-menu-kit';
import { DndKit } from '@/features/shared/ui/kit-platejs/dnd-kit';
import { AiEditorTraceContext } from '@/features/shared/ui/kit-platejs/ai-editor-trace-context';
import { ParagraphElement } from '../paragraph-node';
import { Editor, EditorContainer } from '../editor';
import i18n from '@/i18n/i18n';
import '@/styles.css';

vi.hoisted(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'browser-test-key');
});

// Supply a signed-in session; the menu, plugin, SDK and transport are real.
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: { access_token: 'editor-test-token' } }),
}));

let requests: { url: string; init?: RequestInit }[];
let responses: ((response: Response) => void)[];

class TestErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <div role="alert">{this.state.error.message}</div>
    ) : (
      this.props.children
    );
  }
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  requests = [];
  responses = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    requests.push({ url: String(url), init });
    return new Promise<Response>((resolve, reject) => {
      responses.push(resolve);
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError'))
      );
    });
  });
});

afterEach(() => vi.restoreAllMocks());

function respond(text = 'Generated amendment text') {
  const events = [
    { type: 'start', messageId: `assistant-${responses.length}` },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop' },
  ];
  responses.at(-1)!(
    new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''), {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  );
}

function contextSection(name: string, requestIndex = 0) {
  const messages = JSON.parse(String(requests[requestIndex].init?.body)).messages;
  expect(messages[0].role).toBe('system');
  return messages[0].content.match(new RegExp(`<${name}>\\n([\\s\\S]*?)\\n</${name}>`))?.[1];
}

async function fixture(target?: TRange | string[], fullEditorKit = false) {
  const editor = createPlateEditor({
    plugins: fullEditorKit
      ? EditorKitWithoutFixedToolbar
      : [ParagraphPlugin.withComponent(ParagraphElement), ...AIKit, ...BlockMenuKit, ...DndKit],
    value: [
      {
        id: 'amendment-heading',
        type: 'p',
        children: [{ text: 'Einbahnstraße und Bäume in der Euckenstraße' }],
      },
      {
        id: 'middle-paragraph',
        type: 'p',
        children: [{ text: 'Unselected reasoning about traffic' }],
      },
      { id: 'last-paragraph', type: 'p', children: [{ text: 'Final paragraph about financing' }] },
    ],
  });
  render(
    <StrictMode>
      <TestErrorBoundary>
        <AiEditorTraceContext.Provider value="amendment-document">
          <Plate editor={editor}>
            <Toolbar>
              <AIToolbarButton>Ask AI selection</AIToolbarButton>
            </Toolbar>
            <EditorContainer className="mx-auto mt-12 max-w-xl" variant="demo">
              <Editor aria-label="Amendment editor" />
            </EditorContainer>
          </Plate>
        </AiEditorTraceContext.Provider>
      </TestErrorBoundary>
    </StrictMode>
  );
  async function open() {
    if (target) {
      if (Array.isArray(target)) editor.getApi(BlockSelectionPlugin).blockSelection.set(target);
      else {
        editor.tf.select(target);
        editor.tf.focus();
      }
      await userEvent.click(screen.getByRole('button', { name: 'Ask AI selection' }));
      return screen.findByRole('combobox');
    }
    await userEvent.hover(screen.getByText('Einbahnstraße und Bäume in der Euckenstraße'));
    const handle = screen.getAllByRole('button', { name: 'Drag to move' })[0];
    await userEvent.click(handle);
    await userEvent.click(handle, { button: 'right' });
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Ask AI' }));
    await waitFor(() =>
      expect(editor.getOption(BlockSelectionPlugin, 'isSelectingSome')).toBe(true)
    );
    return screen.findByRole('combobox');
  }
  return { editor, open, input: await open() };
}

it('submits typed input over a selected preset exactly once and displays the authenticated response', async () => {
  const { input, editor } = await fixture();
  await userEvent.fill(input, 'Improve');
  await waitFor(() =>
    expect(document.querySelector('[cmdk-item][aria-selected="true"]')).not.toBeNull()
  );
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].url).toBe('/api/ai/command');
  expect(requests[0].init?.method).toBe('POST');
  const headers = new Headers(requests[0].init?.headers);
  expect(headers.get('Authorization')).toBe('Bearer editor-test-token');
  expect(headers.get('X-AI-Document-Id')).toBe('amendment-document');
  expect(JSON.parse(String(requests[0].init?.body)).messages.at(-1)).toEqual({
    role: 'user',
    content: 'Improve',
  });
  expect(contextSection('Document')).toContain('Unselected reasoning about traffic');
  expect(contextSection('Document')).toContain('Final paragraph about financing');
  expect(contextSection('Selection')).toBe('Einbahnstraße und Bäume in der Euckenstraße');
  await screen.findByText('Thinking...');
  expect(editor.getOption(AIChatPlugin, 'chat').status).toBe('submitted');
  respond();
  await screen.findByText('Generated amendment text');
  await waitFor(() => expect(editor.getOption(AIChatPlugin, 'chat').status).toBe('ready'));
  expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
  await screen.findByRole('option', { name: 'Replace selection' });
  await screen.findByRole('option', { name: 'Insert below' });
  expect(requests).toHaveLength(1);
});

it('submits a free prompt when every command is filtered out', async () => {
  const { input } = await fixture();
  const prompt = 'Erstelle einen Text zu dieser Überschrift für einen Antrag auf einem Parteitag';
  await userEvent.fill(input, prompt);
  await waitFor(() => expect(document.querySelectorAll('[cmdk-item]')).toHaveLength(0));
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(JSON.parse(String(requests[0].init?.body)).messages.at(-1).content).toBe(prompt);
  expect(contextSection('Selection')).toBe('Einbahnstraße und Bäume in der Euckenstraße');
  respond();
  await screen.findByText('Generated amendment text');
  expect(requests).toHaveLength(1);
});

it('keeps empty-input presets, regeneration, cancellation and resetting connected to the SDK', async () => {
  const { editor, input, open } = await fixture();
  input.focus();
  await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
  expect(requests).toHaveLength(0);
  await userEvent.fill(input, '   ');
  await userEvent.keyboard('{Enter}');
  expect(requests).toHaveLength(0);
  await userEvent.clear(input);
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(JSON.parse(String(requests[0].init?.body)).messages.at(-1).content).toBe(
    'Improve the writing'
  );
  respond('First answer');
  await screen.findByText('First answer');
  await userEvent.click(screen.getByRole('option', { name: 'Try again' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(contextSection('Document', 1)).not.toContain('First answer');
  expect(contextSection('Selection', 1)).toBe(contextSection('Selection'));
  respond('Second answer');
  await screen.findByText('Second answer');
  await userEvent.fill(screen.getByRole('combobox'), 'Another prompt');
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(contextSection('Document', 2)).not.toContain('Second answer');
  expect(contextSection('Selection', 2)).toBe(contextSection('Selection'));
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(requests[2].init?.signal?.aborted).toBe(true));
  await waitFor(() => expect(editor.getOption(AIChatPlugin, 'chat').status).toBe('ready'));
  const reopened = await open();
  expect((reopened as HTMLInputElement).value).toBe('');
  expect(editor.getOption(AIChatPlugin, 'chat').messages).toEqual([]);
});

it('sends only the marked words as the target while retaining the entire document for context', async () => {
  const text = 'Einbahnstraße und Bäume in der Euckenstraße';
  const start = text.indexOf('Bäume');
  const { editor, input } = await fixture({
    anchor: { path: [0, 0], offset: start },
    focus: { path: [0, 0], offset: start + 'Bäume'.length },
  });
  await userEvent.fill(input, 'Explain this word');
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(contextSection('Document')).toContain('Final paragraph about financing');
  expect(contextSection('Selection')).toBe('Bäume');
  expect(contextSection('Block')).toBe(text);
  respond('Explanation of the marked word');
  await screen.findByText('Explanation of the marked word');
  await userEvent.click(await screen.findByRole('option', { name: 'Replace selection' }));
  await waitFor(() => expect(editor.getOption(AIChatPlugin, 'open')).toBe(false));
  expect(NodeApi.string(editor.children[0])).toBe(
    'Einbahnstraße und Explanation of the marked word in der Euckenstraße'
  );
});

it('excludes intervening unselected blocks from a non-adjacent block target', async () => {
  const { input } = await fixture(['amendment-heading', 'last-paragraph']);
  await userEvent.fill(input, 'Compare these paragraphs');
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(contextSection('Document')).toContain('Unselected reasoning about traffic');
  expect(contextSection('Selection')).toBe(
    'Einbahnstraße und Bäume in der Euckenstraße\n\nFinal paragraph about financing'
  );
  respond('Comparison of the two selected paragraphs');
  await screen.findByText('Comparison of the two selected paragraphs');
});

it('renders a live multi-chunk markdown response without a recursive update while the input is unmounted', async () => {
  const { editor, input } = await fixture(undefined, true);
  // Match an amendment with an existing Slate cursor as well as the hovered block selection.
  editor.tf.select([0], { edge: 'end' });
  await userEvent.fill(input, 'Write a structured amendment');
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(requests).toHaveLength(1));
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
  });
  const encoder = new TextEncoder();
  const event = (value: unknown) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
  responses[0](new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }));
  event({ type: 'start', messageId: 'streamed-answer' });
  event({ type: 'text-start', id: 'live-text' });
  event({ type: 'text-delta', id: 'live-text', delta: '# Antrag\n\nDie Stadt ' });
  await screen.findByText('Antrag');
  expect(screen.queryByRole('combobox')).toBeNull();
  event({ type: 'text-delta', id: 'live-text', delta: 'soll die **Euckenstraße' });
  await screen.findByText(/soll die/);
  event({
    type: 'text-delta',
    id: 'live-text',
    delta: '** als Einbahnstraße gestalten.\n\n- Mehr ',
  });
  await screen.findByText(/Mehr/);
  event({ type: 'text-delta', id: 'live-text', delta: 'Bäume pflanzen\n- Fußwege verbessern\n\n' });
  await screen.findByText('Fußwege verbessern');
  event({ type: 'text-delta', id: 'live-text', delta: 'Begründung des Antrags.' });
  await screen.findByText('Begründung des Antrags.');
  event({ type: 'text-end', id: 'live-text' });
  event({ type: 'finish', finishReason: 'stop' });
  controller.close();
  await waitFor(() => expect(editor.getOption(AIChatPlugin, 'chat').status).toBe('ready'));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(requests).toHaveLength(1);
});

it('streams a response in the controlled amendment editor with discussion and mode providers', async () => {
  function AmendmentFixture() {
    const [value, setValue] = useState<Value>([
      {
        id: 'heading',
        type: 'h1',
        children: [{ text: 'Einbahnstraße und Bäume in der Euckenstraße' }],
      },
      { id: 'reason', type: 'p', children: [{ text: 'Unselected reasoning about traffic' }] },
    ]);
    return (
      <AmendmentPlateEditor
        value={value}
        onChange={setValue}
        documentId="amendment-document"
        currentUser={{ id: 'author', name: 'Author' }}
        users={{ author: { id: 'author', name: 'Author', avatarUrl: '' } }}
        discussions={[]}
        currentMode="edit"
        showSettingsDialog={false}
        showFixedToolbar={false}
      />
    );
  }
  render(
    <StrictMode>
      <TestErrorBoundary>
        <AmendmentFixture />
      </TestErrorBoundary>
    </StrictMode>
  );
  const heading = screen.getByText('Einbahnstraße und Bäume in der Euckenstraße');
  await userEvent.click(heading);
  await userEvent.hover(heading);
  const handle = screen.getAllByRole('button', { name: 'Drag to move' })[0];
  await userEvent.click(handle);
  await userEvent.click(handle, { button: 'right' });
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Ask AI' }));
  await userEvent.fill(await screen.findByRole('combobox'), 'Write a new amendment');
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(requests).toHaveLength(1));
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  responses[0](
    new Response(
      new ReadableStream({
        start(value) {
          controller = value;
        },
      }),
      {
        headers: { 'Content-Type': 'text/event-stream' },
      }
    )
  );
  const event = (value: unknown) =>
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`));
  event({ type: 'start', messageId: 'controlled-answer' });
  event({ type: 'text-start', id: 'live-text' });
  event({ type: 'text-delta', id: 'live-text', delta: 'Die Stadt soll ' });
  await screen.findByText('Die Stadt soll');
  event({ type: 'text-delta', id: 'live-text', delta: 'mehr Bäume pflanzen.' });
  await screen.findByText('Die Stadt soll mehr Bäume pflanzen.');
  event({ type: 'text-end', id: 'live-text' });
  event({ type: 'finish', finishReason: 'stop' });
  controller.close();
  await screen.findByRole('combobox');
  expect(screen.queryByRole('alert')).toBeNull();
  await userEvent.click(screen.getByRole('option', { name: 'Replace selection' }));
  await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
  expect(screen.queryByText('Einbahnstraße und Bäume in der Euckenstraße')).toBeNull();
  await screen.findByText('Die Stadt soll mehr Bäume pflanzen.');
  await screen.findByText('Unselected reasoning about traffic');
});

it('keeps static answer rendering independent from interactive parent navigation subscriptions', async () => {
  const { editor, input } = await fixture();
  await userEvent.fill(input, 'Draft a new text');
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(requests).toHaveLength(1));
  const navigation = vi.spyOn(editor.api.navigation, 'activeTarget');
  respond('An isolated static preview');
  await screen.findByText('An isolated static preview');
  expect(navigation).not.toHaveBeenCalled();
});

it.each(['Replace selection', 'Insert below'])(
  'manually applies a free-prompt answer with %s',
  async action => {
    const { editor, input } = await fixture();
    await userEvent.fill(input, 'Draft a different amendment');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(requests).toHaveLength(1));
    respond('The generated replacement');
    await screen.findByText('The generated replacement');
    await userEvent.click(await screen.findByRole('option', { name: action }));
    await waitFor(() => expect(editor.getOption(AIChatPlugin, 'open')).toBe(false));
    const paragraphs = editor.children.map(NodeApi.string);
    expect(paragraphs).toEqual(
      action === 'Replace selection'
        ? [
            'The generated replacement',
            'Unselected reasoning about traffic',
            'Final paragraph about financing',
          ]
        : [
            'Einbahnstraße und Bäume in der Euckenstraße',
            'The generated replacement',
            'Unselected reasoning about traffic',
            'Final paragraph about financing',
          ]
    );
  }
);
