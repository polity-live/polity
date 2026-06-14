/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFlowEditorController } from '../useFlowEditorController';
import type { FlowEditorNode } from '../../types';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: Record<string, unknown>) =>
    values?.newId ? `New proposal ${values.newId}` : key,
}));

describe('useFlowEditorController', () => {
  it('starts from the default workflow and can add a proposal node', () => {
    const { result } = renderHook(() => useFlowEditorController());

    expect(result.current.nodes).toHaveLength(11);
    expect(result.current.edges).toHaveLength(11);

    act(() => {
      result.current.addProposalNode();
    });

    expect(result.current.nodes).toHaveLength(12);
    expect(result.current.nodes.at(-1)?.data.label).toBe('New proposal 12');
  });

  it('clears selected graph items when the editor is locked', () => {
    const { result } = renderHook(() => useFlowEditorController());

    act(() => {
      result.current.onNodeClick(null, result.current.nodes[0] as FlowEditorNode);
    });

    expect(result.current.selectedNodes).toHaveLength(1);

    act(() => {
      result.current.handleInteractiveChange(false);
    });

    expect(result.current.isInteractive).toBe(false);
    expect(result.current.selectedNodes).toHaveLength(0);
    expect(result.current.selectedEdge).toBeNull();
  });
});
