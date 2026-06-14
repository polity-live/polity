import type { Meta, StoryObj } from '@storybook/react-vite';

const DisabledStatementCardStory = () => null;

const meta: Meta<typeof DisabledStatementCardStory> = {
  component: DisabledStatementCardStory,
};

export default meta;

type Story = StoryObj<typeof DisabledStatementCardStory>;

export const Disabled: Story = {
  args: {},
};
