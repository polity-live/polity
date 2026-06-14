import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { CommentThread } from '@/features/shared/ui/comments';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { DialogShell } from '@/features/shared/ui/dialog';
import { EmptyState, InlineNotice } from '@/features/shared/ui/feedback';
import { FormActions, TextField } from '@/features/shared/ui/form';
import {
  ActionToolbar,
  PageHeader,
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
  Section,
  StatsBar,
} from '@/features/shared/ui/layout';
import { StatusBadge } from '@/features/shared/ui/status';
import { TypeaheadCombobox } from '@/features/shared/ui/typeahead';
import { Button } from '@/features/shared/ui/ui/button';

interface DemoRow {
  id: string;
  title: string;
  status: string;
}

const rows: DemoRow[] = [
  { id: '1', title: 'Budget motion', status: 'approved' },
  { id: '2', title: 'Housing amendment', status: 'pending' },
];

const columns: ColumnDef<DemoRow>[] = [
  { accessorKey: 'title', header: 'Title' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: info => (
      <StatusBadge status={String(info.getValue())}>{String(info.getValue())}</StatusBadge>
    ),
  },
];

function SharedCompositionsPreview() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | undefined>();

  return (
    <div className="max-w-5xl space-y-8 p-6">
      <PageHeader
        title="Shared compositions"
        description="Neutral app building blocks with stable props."
        actions={
          <ActionToolbar>
            <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          </ActionToolbar>
        }
      />

      <StatsBar
        items={[
          { value: 12, label: 'Members' },
          { value: 4, label: 'Votes' },
          { value: 2, label: 'Pending' },
        ]}
      />

      <Section title="Panels and feedback">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel>
            <PanelHeader>
              <PanelTitle>Panel title</PanelTitle>
            </PanelHeader>
            <PanelContent>
              <InlineNotice variant="info" title="Heads up">
                This notice uses the shared feedback tone API.
              </InlineNotice>
            </PanelContent>
          </Panel>
          <EmptyState title="No items" description="The shared empty state can carry an action." />
        </div>
      </Section>

      <Section title="Forms and typeahead">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Title" value="General assembly" onValueChange={() => undefined} />
          <TypeaheadCombobox
            items={[{ id: 'group-1', entityType: 'group', label: 'Civic Group' }]}
            value={selectedItem}
            onChange={item => setSelectedItem(item?.id)}
            placeholder="Search entities"
          />
        </div>
        <FormActions submitLabel="Save" cancelLabel="Cancel" className="mt-4" />
      </Section>

      <Section title="Data">
        <DataTable columns={columns} data={rows} pagination={{ enabled: false }} />
      </Section>

      <Section title="Comments">
        <CommentThread
          comments={[]}
          onAddComment={async () => undefined}
          onVote={async () => undefined}
          emptyState={<p className="text-muted-foreground py-8 text-center text-sm">No comments</p>}
        />
      </Section>

      <DialogShell
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Shared dialog"
        description="DialogShell is the canonical dialog composition."
        footer={<Button onClick={() => setDialogOpen(false)}>Done</Button>}
      >
        <p className="text-sm">Dialog content stays supplied by the caller.</p>
      </DialogShell>
    </div>
  );
}

const meta: Meta<typeof SharedCompositionsPreview> = {
  component: SharedCompositionsPreview,
  title: 'Components/Shared/Compositions',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SharedCompositionsPreview>;

export const Default: Story = {};
