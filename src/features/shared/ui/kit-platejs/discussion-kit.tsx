import type { TComment } from '@/features/shared/ui/ui-platejs/comment.tsx';

import { createPlatePlugin } from 'platejs/react';

import { BlockDiscussion } from '@/features/shared/ui/ui-platejs/block-discussion.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export interface TDiscussion {
  id: string;
  comments: TComment[];
  createdAt: Date;
  isResolved: boolean;
  userId: string;
  documentContent?: string;
  title?: string;
  crId?: string; // Format: CR-x (e.g., CR-1, CR-2, etc.)
  displayCrId?: string;
  branchDisplayNumber?: number;
  branchScopedCrNumber?: number;
  branchSequenceNumber?: number | null;
  status?: 'pending' | 'accepted' | 'rejected';
  confirmationStatus?: 'pending' | 'confirmed';
  confirmedAt?: number;
  changeRequestEntityId?: string; // UUID of the persisted change_request row
  changeRequestStatus?: string | null;
  processBranchId?: string | null;
  votesFor?: number;
  votesAgainst?: number;
  votesAbstain?: number;
  votingDeadline?: number | null;
  closeTrigger?: string | null;
  eligibleVoterCount?: number;
  votedCollaboratorCount?: number;
  resolutionMethod?: string | null;
  visibilityScope?: string | null;
  resolvedInMode?: string | null;
  votingStatus?: string | null;
  votes?: {
    id: string;
    vote: string;
    voterId: string;
  }[];
}

const discussionsData: TDiscussion[] = [
  {
    id: 'discussion1',
    title: translateText('generated.inline.0513_feedback_on_comments_feature_ba7d6c70'),
    comments: [
      {
        id: 'comment1',
        contentRich: [
          {
            children: [
              {
                text: 'Comments are a great way to provide feedback and discuss changes.',
              },
            ],
            type: 'p',
          },
        ],
        createdAt: new Date(Date.now() - 600_000),
        discussionId: 'discussion1',
        isEdited: false,
        userId: 'charlie',
      },
      {
        id: 'comment2',
        contentRich: [
          {
            children: [
              {
                text: 'Agreed! The link to the docs makes it easy to learn more.',
              },
            ],
            type: 'p',
          },
        ],
        createdAt: new Date(Date.now() - 500_000),
        discussionId: 'discussion1',
        isEdited: false,
        userId: 'bob',
      },
    ],
    createdAt: new Date(),
    documentContent: 'comments',
    isResolved: false,
    userId: 'charlie',
  },
  {
    id: 'discussion2',
    title: translateText('generated.inline.0514_overlapping_annotations_demo_fc377894'),
    comments: [
      {
        id: 'comment1',
        contentRich: [
          {
            children: [
              {
                text: 'Nice demonstration of overlapping annotations with both comments and suggestions!',
              },
            ],
            type: 'p',
          },
        ],
        createdAt: new Date(Date.now() - 300_000),
        discussionId: 'discussion2',
        isEdited: false,
        userId: 'bob',
      },
      {
        id: 'comment2',
        contentRich: [
          {
            children: [
              {
                text: 'This helps users understand how powerful the editor can be.',
              },
            ],
            type: 'p',
          },
        ],
        createdAt: new Date(Date.now() - 200_000),
        discussionId: 'discussion2',
        isEdited: false,
        userId: 'charlie',
      },
    ],
    createdAt: new Date(),
    documentContent: 'overlapping',
    isResolved: false,
    userId: 'bob',
  },
];

const avatarUrl = (seed: string) => `https://api.dicebear.com/9.x/glass/svg?seed=${seed}`;

// Default demo users for when no user data is provided
const defaultUsersData: Record<
  string,
  { id: string; avatarUrl: string; name: string; hue?: number }
> = {
  alice: {
    id: 'alice',
    avatarUrl: avatarUrl('alice6'),
    name: 'Alice',
  },
  bob: {
    id: 'bob',
    avatarUrl: avatarUrl('bob4'),
    name: 'Bob',
  },
  charlie: {
    id: 'charlie',
    avatarUrl: avatarUrl('charlie2'),
    name: 'Charlie',
  },
};

// This plugin is purely UI. It's only used to store the discussions and users data
export const discussionPlugin = createPlatePlugin({
  key: 'discussion',
  options: {
    currentUserId: 'alice',
    discussions: discussionsData,
    users: defaultUsersData,
    documentTitle: '',
    documentId: '', // Document ID for suggestion ID generation
  },
})
  .configure({
    render: { aboveNodes: BlockDiscussion },
  })
  .extendSelectors(({ getOption }) => ({
    currentUser: () => getOption('users')[getOption('currentUserId')],
    user: (id: string) => getOption('users')[id],
  }));

export const DiscussionKit = [discussionPlugin];
