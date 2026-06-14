import { translate as translateText } from '@/features/shared/hooks/use-translation';

import type { FlowEditorEdge, FlowEditorNode } from '../types';

const defaultNodeStyle = { background: '#bbdefb', padding: 10, borderRadius: 5, width: 180 };
const voteNodeStyle = { background: '#ffe0b2', padding: 10, borderRadius: 5, width: 180 };

export function createInitialFlowEditorNodes(): FlowEditorNode[] {
  return [
    {
      id: '1',
      data: { label: translateText('generated.inline.0118_proposal_submission_386e2a6a') },
      style: defaultNodeStyle,
      position: { x: 250, y: 0 },
    },
    {
      id: '2',
      data: { label: translateText('generated.inline.0119_initial_review_cec95fcf') },
      style: defaultNodeStyle,
      position: { x: 250, y: 100 },
    },
    {
      id: '3',
      data: { label: translateText('generated.inline.0120_committee_assignment_8bc00fbc') },
      style: voteNodeStyle,
      position: { x: 250, y: 200 },
    },
    {
      id: '4',
      data: { label: translateText('generated.inline.0121_committee_review_2fc4ec57') },
      style: defaultNodeStyle,
      position: { x: 100, y: 300 },
    },
    {
      id: '5',
      data: { label: translateText('generated.inline.0122_budget_analysis_6db26dd5') },
      style: defaultNodeStyle,
      position: { x: 400, y: 300 },
    },
    {
      id: '6',
      data: { label: translateText('generated.inline.0123_committee_vote_ea9e0ee3') },
      style: voteNodeStyle,
      position: { x: 250, y: 400 },
    },
    {
      id: '7',
      data: { label: translateText('generated.inline.0124_council_agenda_c7d1ce55') },
      style: defaultNodeStyle,
      position: { x: 250, y: 500 },
    },
    {
      id: '8',
      data: { label: translateText('generated.inline.0125_public_hearing_6f510605') },
      style: defaultNodeStyle,
      position: { x: 250, y: 600 },
    },
    {
      id: '9',
      data: { label: translateText('generated.inline.0126_council_vote_3947dff9') },
      style: voteNodeStyle,
      position: { x: 250, y: 700 },
    },
    {
      id: '10',
      data: { label: translateText('generated.inline.0127_mayor_signature_c164c480') },
      style: { background: '#c8e6c9', padding: 10, borderRadius: 5, width: 180 },
      position: { x: 250, y: 800 },
    },
    {
      id: '11',
      data: { label: translateText('generated.inline.0128_implementation_8781d615') },
      style: defaultNodeStyle,
      position: { x: 250, y: 900 },
    },
  ];
}

export function createInitialFlowEditorEdges(): FlowEditorEdge[] {
  return [
    createDefaultEdge('e1-2', '1', '2'),
    createDefaultEdge('e2-3', '2', '3'),
    createDefaultEdge(
      'e3-4',
      '3',
      '4',
      translateText('generated.inline.0129_policy_review_674319c2')
    ),
    createDefaultEdge(
      'e3-5',
      '3',
      '5',
      translateText('generated.inline.0130_budget_impact_d1e9449e')
    ),
    createDefaultEdge('e4-6', '4', '6'),
    createDefaultEdge('e5-6', '5', '6'),
    createDefaultEdge(
      'e6-7',
      '6',
      '7',
      translateText('generated.inline.0131_approved_by_committee_bd1a81e8')
    ),
    createDefaultEdge('e7-8', '7', '8'),
    createDefaultEdge('e8-9', '8', '9'),
    createDefaultEdge('e9-10', '9', '10', translateText('generated.inline.0078_passed_271d60f4')),
    createDefaultEdge('e10-11', '10', '11', translateText('generated.inline.0132_signed_6e3665d8')),
  ];
}

export function createDefaultEdge(
  id: string,
  source: string,
  target: string,
  label?: string
): FlowEditorEdge {
  return {
    id,
    source,
    target,
    label,
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  };
}
