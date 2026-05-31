/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CreateSummaryStep } from '../CreateSummaryStep';

describe('CreateSummaryStep', () => {
  it('renders structured sections and falls back from legacy fields when needed', () => {
    const { rerender } = render(
      <CreateSummaryStep
        entityType="statement"
        badge="Statement"
        secondaryBadge="Public"
        title="Statement"
        subtitle="Support the climate plan"
        hashtags={['climate']}
        media={{
          imageUrl: 'https://example.com/statement.jpg',
          imageAlt: 'Statement image',
        }}
        sections={[
          {
            title: 'Survey',
            fields: [
              { label: 'Question', value: 'Do you agree?' },
              { label: 'Duration', value: '24' },
            ],
          },
        ]}
      />
    );

    expect(screen.queryByText('Survey')).not.toBeNull();
    expect(screen.queryByText('Do you agree?')).not.toBeNull();
    expect(screen.queryByAltText('Statement image')).not.toBeNull();

    rerender(
      <CreateSummaryStep
        entityType="todo"
        badge="Todo"
        title="Prepare agenda"
        fields={[
          { label: 'Priority', value: 'High' },
          { label: 'Visibility', value: 'Private' },
        ]}
      />
    );

    expect(screen.queryByText('Prepare agenda')).not.toBeNull();
    expect(screen.queryByText('Priority')).not.toBeNull();
    expect(screen.queryByText('High')).not.toBeNull();
    expect(screen.queryByText('Visibility')).not.toBeNull();
    expect(screen.queryByText('Private')).not.toBeNull();
  });

  it('renders grouped group review details like invites and constitutional event settings', () => {
    render(
      <CreateSummaryStep
        entityType="group"
        badge="Group"
        secondaryBadge="Base Group"
        title="Neighborhood Assembly"
        subtitle="Local organizing and planning"
        hashtags={['assembly']}
        media={{
          imageUrl: 'https://example.com/group.jpg',
          imageAlt: 'Group image',
        }}
        sections={[
          {
            title: 'Basic Info',
            fields: [
              { label: 'Email', value: 'hello@example.com' },
              { label: 'Visibility', value: 'Authenticated' },
            ],
          },
          {
            title: 'Invites',
            fields: [
              {
                label: 'Invited Members',
                value: 'Alex Rivera, Sam Park',
              },
            ],
          },
          {
            title: 'Constitutional Event',
            fields: [
              { label: 'Name', value: 'Founding General Assembly' },
              { label: 'Start', value: '2026-06-12 18:30' },
            ],
          },
        ]}
      />
    );

    expect(screen.queryByText('Neighborhood Assembly')).not.toBeNull();
    expect(screen.queryByText('hello@example.com')).not.toBeNull();
    expect(screen.queryByText('Alex Rivera, Sam Park')).not.toBeNull();
    expect(screen.queryByText('Founding General Assembly')).not.toBeNull();
    expect(screen.queryByAltText('Group image')).not.toBeNull();
  });

  it('renders event and statement review details with media, recurrence, and survey options', () => {
    const { rerender } = render(
      <CreateSummaryStep
        entityType="event"
        badge="Event"
        secondaryBadge="Delegate Assembly"
        title="Regional Planning Session"
        subtitle="Quarterly strategy meeting"
        media={{
          imageUrl: 'https://example.com/event.jpg',
          imageAlt: 'Event cover',
        }}
        sections={[
          {
            title: 'Date & Time',
            fields: [
              { label: 'Start', value: '2026-07-20 09:00' },
              { label: 'Recurs', value: 'Every 2 weeks' },
              { label: 'Amendment Deadline', value: '2026-07-15 18:00' },
            ],
          },
          {
            title: 'Location',
            fields: [
              { label: 'Location Type', value: 'Online' },
              { label: 'Meeting Link', value: 'https://example.com/planning-session' },
            ],
          },
        ]}
      />
    );

    expect(screen.queryByText('Every 2 weeks')).not.toBeNull();
    expect(screen.queryByText('2026-07-15 18:00')).not.toBeNull();
    expect(screen.queryByText('https://example.com/planning-session')).not.toBeNull();
    expect(screen.queryByAltText('Event cover')).not.toBeNull();

    rerender(
      <CreateSummaryStep
        entityType="statement"
        badge="Statement"
        secondaryBadge="Public"
        title="Statement"
        subtitle="Support the renewable transition"
        media={{
          imageUrl: 'https://example.com/statement.jpg',
          imageAlt: 'Statement cover',
          videoUrl: 'https://example.com/statement-video',
        }}
        sections={[
          {
            title: 'Survey',
            fields: [
              { label: 'Question', value: 'Do you support this plan?' },
              { label: 'Duration', value: '48' },
              { label: 'Options', value: 'Yes, No, Need more detail' },
            ],
          },
        ]}
      />
    );

    expect(screen.queryByText('Do you support this plan?')).not.toBeNull();
    expect(screen.queryByText(/Need more detail/)).not.toBeNull();
    expect(screen.queryByRole('link', { name: /statement-video/i })).not.toBeNull();
  });

  it('renders payment counterpart settings and todo assignee details', () => {
    const { rerender } = render(
      <CreateSummaryStep
        entityType="payment"
        badge="Payment"
        secondaryBadge="Expense"
        title="Venue Deposit"
        subtitle="150.00 EUR"
        sections={[
          {
            title: 'Direction',
            fields: [
              { label: 'Group', value: 'Treasury Working Group' },
              { label: 'Type', value: 'Events' },
            ],
          },
          {
            title: 'Receiver',
            fields: [
              { label: 'Entity Type', value: 'User' },
              { label: 'To Receiver', value: 'Jane Doe' },
            ],
          },
        ]}
      />
    );

    expect(screen.queryByText('Treasury Working Group')).not.toBeNull();
    expect(screen.queryByText('Jane Doe')).not.toBeNull();

    rerender(
      <CreateSummaryStep
        entityType="todo"
        badge="Todo"
        title="Prepare speaker notes"
        subtitle="Draft the final briefing notes"
        sections={[
          {
            title: 'Assignments',
            fields: [
              { label: 'Assignees', value: 'Jordan Lee, Priya Chen' },
              { label: 'Due Date', value: '2026-08-01' },
            ],
          },
        ]}
      />
    );

    expect(screen.queryByText('Prepare speaker notes')).not.toBeNull();
    expect(screen.queryByText('Jordan Lee, Priya Chen')).not.toBeNull();
    expect(screen.queryByText('2026-08-01')).not.toBeNull();
  });
});
