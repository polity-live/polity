/* @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';
import {
  AssistantChatStreamDecoder,
  buildToolCallPreview,
} from '@/features/messages/logic/assistantStream';

function AssistantToolFlow() {
  const [text, setText] = useState('');
  const [tool, setTool] = useState<string | null>(null);
  const [decision, setDecision] = useState('pending');
  const consume = () => {
    const decoder = new AssistantChatStreamDecoder();
    const events = decoder.push(
      '{"type":"text-delta","text":"Draft ready"}\n{"type":"tool-call","toolName":"archiveDataset","args":{"id":"dataset-1"}}\n'
    );
    setText(events.find(event => event.type === 'text-delta')?.text ?? '');
    const call = events.find(event => event.type === 'tool-call');
    setTool(call?.type === 'tool-call' ? buildToolCallPreview(call.toolName, call.args) : null);
  };
  return (
    <section>
      <button type="button" onClick={consume}>
        Receive assistant stream
      </button>
      <output aria-label="assistant text">{text}</output>
      {tool ? (
        <div>
          <p>{tool}</p>
          <button type="button" onClick={() => setDecision('confirmed')}>
            Confirm tool
          </button>
          <button type="button" onClick={() => setDecision('rejected')}>
            Reject tool
          </button>
        </div>
      ) : null}
      <output aria-label="tool decision">{decision}</output>
    </section>
  );
}

afterEach(cleanup);

describe('assistant tools component flow', () => {
  it('streams text and exposes a parsed tool call for confirmation', () => {
    renderComponentFlow(<AssistantToolFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'Receive assistant stream' }));
    expect(screen.getByLabelText('assistant text').textContent).toBe('Draft ready');
    expect(screen.getByText('archiveDataset(id: "dataset-1")')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm tool' }));
    expect(screen.getByLabelText('tool decision').textContent).toBe('confirmed');
  });

  it('rejects a streamed tool without applying its effect', () => {
    renderComponentFlow(<AssistantToolFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'Receive assistant stream' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject tool' }));
    expect(screen.getByLabelText('tool decision').textContent).toBe('rejected');
    expect(screen.getByLabelText('assistant text').textContent).toBe('Draft ready');
  });
});
