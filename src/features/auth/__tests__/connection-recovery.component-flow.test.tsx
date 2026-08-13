/* @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EnsureUserView } from '../EnsureUserView';
import { renderComponentFlow } from '@/test/render-component-flow';

const baseProps = {
  hasUser: true,
  isLoading: false,
  retry: vi.fn(),
  signOut: vi.fn(),
};

function DraftEditor({ onMount }: { onMount?: () => void }) {
  const [draft, setDraft] = useState(() => {
    onMount?.();
    return '';
  });
  return (
    <input aria-label="draft" value={draft} onChange={event => setDraft(event.target.value)} />
  );
}

afterEach(cleanup);

describe('connection recovery flow', () => {
  it('shows an offline alert while preserving the mounted draft editor', () => {
    const view = renderComponentFlow(
      <EnsureUserView
        {...baseProps}
        connectionStatus="disconnected"
        connectionNotice="offline"
        zeroConnectionState="disconnected"
      >
        <DraftEditor />
      </EnsureUserView>
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'draft' }), {
      target: { value: 'unsaved work' },
    });

    view.rerender(
      <EnsureUserView
        {...baseProps}
        connectionStatus="disconnected"
        connectionNotice="offline"
        zeroConnectionState="disconnected"
      >
        <DraftEditor />
      </EnsureUserView>
    );

    expect(screen.getByRole('alert').getAttribute('data-connection-state')).toBe('disconnected');
    expect((screen.getByRole('textbox', { name: 'draft' }) as HTMLInputElement).value).toBe(
      'unsaved work'
    );
  });

  it('announces the reconnecting transition after a disconnect', () => {
    const view = renderComponentFlow(
      <EnsureUserView
        {...baseProps}
        connectionStatus="disconnected"
        connectionNotice="offline"
        zeroConnectionState="disconnected"
      >
        <DraftEditor />
      </EnsureUserView>
    );

    view.rerender(
      <EnsureUserView
        {...baseProps}
        connectionStatus="connecting"
        connectionNotice="reconnecting"
        zeroConnectionState="connecting"
      >
        <DraftEditor />
      </EnsureUserView>
    );

    expect(screen.getByRole('status').getAttribute('data-connection-state')).toBe('reconnecting');
  });

  it('hides the banner after reconnecting without remounting route content', () => {
    const onMount = vi.fn();
    const view = renderComponentFlow(
      <EnsureUserView
        {...baseProps}
        connectionStatus="disconnected"
        connectionNotice="offline"
        zeroConnectionState="disconnected"
      >
        <DraftEditor onMount={onMount} />
      </EnsureUserView>
    );

    view.rerender(
      <EnsureUserView
        {...baseProps}
        connectionStatus="syncing"
        connectionNotice={null}
        zeroConnectionState="connected"
      >
        <DraftEditor onMount={onMount} />
      </EnsureUserView>
    );

    expect(screen.queryByTestId('connection-status')).toBeNull();
    expect(onMount).toHaveBeenCalledOnce();
  });
});
