import { featureThemeClassName, featureThemeValue } from '@/features/shared/theme';
import type { Edge, Node } from '@xyflow/react';
import {
  NETWORK_CONNECTION_DIRECTION_COLORS,
  buildNetworkRelationshipEdge,
} from '@/features/network/logic/networkEdgeHelpers';
import {
  getGroupNodeDisplayLabel,
  getGroupNodeStyle,
} from '@/features/network/ui/networkVisualHelpers';
import type { EditableRightsLabelEdgeData } from '@/features/network/types/networkEdge.types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const landingText = (key: string) => translateText(`pages.home.publicLanding.${key}`);

export interface LandingNetworkEventData {
  id: string;
  title: string;
  description: string;
  startDate: number;
  location: string;
}

export interface LandingNetworkNodeData extends Record<string, unknown> {
  label: string;
  kind: 'group' | 'event';
  event?: LandingNetworkEventData;
}

export type LandingNetworkNode = Node<LandingNetworkNodeData>;
export type LandingNetworkEdge = Edge<EditableRightsLabelEdgeData>;

function withNodeSize<TNode extends LandingNetworkNode>(
  node: TNode,
  size: { width: number; height: number }
): TNode {
  return {
    ...node,
    width: size.width,
    height: size.height,
    initialWidth: size.width,
    initialHeight: size.height,
    measured: size,
  };
}

const eventNodeStyle = {
  width: 190,
  border: featureThemeClassName('publiclandingLandingNetworkPreviewThemedStyle'),
  borderRadius: '10px',
  background: featureThemeValue('publiclandingLandingNetworkPreviewTealColor'),
  color: featureThemeValue('publiclandingLandingNetworkPreviewTealColorAlpha'),
  fontSize: 12,
  fontWeight: 700,
  padding: '10px 12px',
  textAlign: 'center' as const,
  boxShadow: featureThemeClassName('publiclandingLandingNetworkPreviewThemedStyleAlpha'),
  cursor: 'pointer',
};

export const landingNetworkNodes: LandingNetworkNode[] = [
  withNodeSize(
    {
      id: 'state-party',
      position: { x: 10, y: 35 },
      data: {
        kind: 'group',
        label: getGroupNodeDisplayLabel(landingText('network.nodes.stateParty'), 'parent'),
      },
      style: getGroupNodeStyle('parent', { width: 175 }),
    },
    { width: 175, height: 44 }
  ),
  withNodeSize(
    {
      id: 'local-branch',
      position: { x: 0, y: 230 },
      data: {
        kind: 'group',
        label: getGroupNodeDisplayLabel(landingText('network.nodes.localBranch'), 'current'),
      },
      style: getGroupNodeStyle('current', { width: 190 }),
    },
    { width: 190, height: 46 }
  ),
  withNodeSize(
    {
      id: 'policy-committee',
      position: { x: 305, y: 118 },
      data: {
        kind: 'group',
        label: getGroupNodeDisplayLabel(landingText('network.nodes.policyCommittee'), 'child'),
      },
      style: getGroupNodeStyle('child', { width: 190 }),
    },
    { width: 190, height: 44 }
  ),
  withNodeSize(
    {
      id: 'party-congress',
      position: { x: 600, y: 35 },
      data: {
        kind: 'group',
        label: getGroupNodeDisplayLabel(
          landingText('network.nodes.partyCongress'),
          'sibling-elected'
        ),
      },
      style: getGroupNodeStyle('sibling-elected', { width: 180 }),
    },
    { width: 180, height: 44 }
  ),
  withNodeSize(
    {
      id: 'parliamentary-group',
      position: { x: 600, y: 245 },
      data: {
        kind: 'group',
        label: getGroupNodeDisplayLabel(
          landingText('network.nodes.parliamentaryGroup'),
          'sibling-parliament'
        ),
      },
      style: getGroupNodeStyle('sibling-parliament', { width: 200 }),
    },
    { width: 200, height: 44 }
  ),
  withNodeSize(
    {
      id: 'committee-hearing',
      position: { x: 925, y: 95 },
      data: {
        kind: 'event',
        label: landingText('network.nodes.publicCommitteeHearing'),
        event: {
          id: 'committee-hearing',
          title: landingText('network.nodes.publicCommitteeHearing'),
          description: landingText('network.nodes.hearingDescription'),
          startDate: Date.UTC(2026, 5, 18, 8, 30),
          location: landingText('network.nodes.hearingLocation'),
        },
      },
      style: eventNodeStyle,
    },
    { width: 190, height: 56 }
  ),
  withNodeSize(
    {
      id: 'caucus-meeting',
      position: { x: 930, y: 300 },
      data: {
        kind: 'event',
        label: landingText('network.nodes.parliamentaryGroupMeeting'),
        event: {
          id: 'caucus-meeting',
          title: landingText('network.nodes.parliamentaryGroupMeeting'),
          description: landingText('network.nodes.meetingDescription'),
          startDate: Date.UTC(2026, 5, 20, 13, 0),
          location: landingText('network.nodes.meetingLocation'),
        },
      },
      style: eventNodeStyle,
    },
    { width: 190, height: 60 }
  ),
];

export const landingNetworkEdges: LandingNetworkEdge[] = [
  buildNetworkRelationshipEdge({
    edgeId: 'state-local-rights',
    sourceId: 'state-party',
    targetId: 'local-branch',
    sourceGroupId: 'state-party',
    targetGroupId: 'local-branch',
    structuralType: 'parent',
    sourceName: landingText('network.nodes.stateParty'),
    targetName: landingText('network.nodes.localBranch'),
    rights: ['informationRight', 'activeVotingRight'],
    rightRelationshipKinds: {
      informationRight: 'active',
      activeVotingRight: 'active',
    },
    rightEdgeDirections: {
      informationRight: 'bidirectional',
      activeVotingRight: 'backward',
    },
    fallbackStrokeColor: NETWORK_CONNECTION_DIRECTION_COLORS.bidirectional,
    graphRootGroupId: 'state-party',
    currentGroupId: 'local-branch',
    previewCurrentGroupId: 'local-branch',
  }),
  buildNetworkRelationshipEdge({
    edgeId: 'branch-committee-rights',
    sourceId: 'local-branch',
    targetId: 'policy-committee',
    sourceGroupId: 'local-branch',
    targetGroupId: 'policy-committee',
    structuralType: 'sibling',
    sourceName: landingText('network.nodes.localBranch'),
    targetName: landingText('network.nodes.policyCommittee'),
    rights: ['amendmentRight', 'rightToSpeak', 'informationRight'],
    rightRelationshipKinds: {
      amendmentRight: 'active',
      rightToSpeak: 'outgoing',
      informationRight: 'active',
    },
    rightEdgeDirections: {
      amendmentRight: 'forward',
      rightToSpeak: 'forward',
      informationRight: 'bidirectional',
    },
    fallbackStrokeColor: NETWORK_CONNECTION_DIRECTION_COLORS.outgoing,
    graphRootGroupId: 'state-party',
    currentGroupId: 'local-branch',
    previewCurrentGroupId: 'local-branch',
  }),
  buildNetworkRelationshipEdge({
    edgeId: 'committee-congress-rights',
    sourceId: 'policy-committee',
    targetId: 'party-congress',
    sourceGroupId: 'policy-committee',
    targetGroupId: 'party-congress',
    structuralType: 'child',
    sourceName: landingText('network.nodes.policyCommittee'),
    targetName: landingText('network.nodes.partyCongress'),
    rights: ['amendmentRight', 'passiveVotingRight'],
    rightRelationshipKinds: {
      amendmentRight: 'active',
      passiveVotingRight: 'active',
    },
    rightEdgeDirections: {
      amendmentRight: 'forward',
      passiveVotingRight: 'bidirectional',
    },
    fallbackStrokeColor: NETWORK_CONNECTION_DIRECTION_COLORS.outgoing,
    graphRootGroupId: 'state-party',
    currentGroupId: 'local-branch',
    previewCurrentGroupId: 'local-branch',
  }),
  buildNetworkRelationshipEdge({
    edgeId: 'congress-parliament-rights',
    sourceId: 'party-congress',
    targetId: 'parliamentary-group',
    sourceGroupId: 'party-congress',
    targetGroupId: 'parliamentary-group',
    structuralType: 'sibling',
    sourceName: landingText('network.nodes.partyCongress'),
    targetName: landingText('network.nodes.parliamentaryGroup'),
    rights: ['activeVotingRight', 'informationRight'],
    rightRelationshipKinds: {
      activeVotingRight: 'active',
      informationRight: 'active',
    },
    rightEdgeDirections: {
      activeVotingRight: 'forward',
      informationRight: 'bidirectional',
    },
    fallbackStrokeColor: NETWORK_CONNECTION_DIRECTION_COLORS.outgoing,
    graphRootGroupId: 'state-party',
    currentGroupId: 'local-branch',
    previewCurrentGroupId: 'local-branch',
  }),
  buildNetworkRelationshipEdge({
    edgeId: 'parliament-hearing-rights',
    sourceId: 'parliamentary-group',
    targetId: 'committee-hearing',
    sourceGroupId: 'parliamentary-group',
    targetGroupId: 'committee-hearing',
    structuralType: 'sibling',
    sourceName: landingText('network.nodes.parliamentaryGroup'),
    targetName: landingText('network.nodes.publicCommitteeHearing'),
    rights: ['rightToSpeak', 'informationRight'],
    rightRelationshipKinds: {
      rightToSpeak: 'active',
      informationRight: 'incoming',
    },
    rightEdgeDirections: {
      rightToSpeak: 'forward',
      informationRight: 'bidirectional',
    },
    fallbackStrokeColor: NETWORK_CONNECTION_DIRECTION_COLORS.bidirectional,
    strokeDasharray: '6 4',
    graphRootGroupId: 'state-party',
    currentGroupId: 'local-branch',
    previewCurrentGroupId: 'local-branch',
  }),
  buildNetworkRelationshipEdge({
    edgeId: 'parliament-caucus-rights',
    sourceId: 'parliamentary-group',
    targetId: 'caucus-meeting',
    sourceGroupId: 'parliamentary-group',
    targetGroupId: 'caucus-meeting',
    structuralType: 'sibling',
    sourceName: landingText('network.nodes.parliamentaryGroup'),
    targetName: landingText('network.nodes.parliamentaryGroupMeeting'),
    rights: ['activeVotingRight', 'amendmentRight'],
    rightRelationshipKinds: {
      activeVotingRight: 'active',
      amendmentRight: 'active',
    },
    rightEdgeDirections: {
      activeVotingRight: 'bidirectional',
      amendmentRight: 'forward',
    },
    fallbackStrokeColor: NETWORK_CONNECTION_DIRECTION_COLORS.bidirectional,
    strokeDasharray: '6 4',
    graphRootGroupId: 'state-party',
    currentGroupId: 'local-branch',
    previewCurrentGroupId: 'local-branch',
  }),
];

export const landingNetworkAlwaysVisibleNodeIds = landingNetworkNodes.map(node => node.id);
