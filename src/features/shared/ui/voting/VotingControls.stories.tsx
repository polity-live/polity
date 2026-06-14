import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, Trophy } from 'lucide-react';

import {
  SelectedVoteBadge,
  VoteChoiceButtons,
  VotingPhaseBadge,
  VotingResultBadge,
  VotingUnavailableMessage,
} from './VotingControls';

function VotingControlsPreview() {
  const labels = {
    accept: 'Accept',
    reject: 'Reject',
    abstain: 'Abstain',
  };

  return (
    <div className="max-w-xl space-y-6 p-6">
      <VoteChoiceButtons labels={labels} onVote={() => undefined} />
      <div className="flex flex-wrap gap-2">
        <SelectedVoteBadge vote="accept" labels={{ ...labels, prefix: 'Your vote' }} />
        <VotingPhaseBadge phase="indication" />
        <VotingPhaseBadge phase="final_vote" />
        <VotingPhaseBadge phase="closed" />
      </div>
      <div className="flex flex-wrap gap-2">
        <VotingResultBadge status="passed" tone="success" label="Passed" Icon={Check} />
        <VotingResultBadge
          status="elected"
          tone="success"
          label="Elected"
          Icon={Trophy}
          winnerName="Riley Morgan"
          percentage={62}
        />
      </div>
      <VotingUnavailableMessage>No voting rights for this agenda item.</VotingUnavailableMessage>
    </div>
  );
}

const meta: Meta<typeof VotingControlsPreview> = {
  component: VotingControlsPreview,
  title: 'Components/Shared/VotingControls',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof VotingControlsPreview>;

export const Default: Story = {};
