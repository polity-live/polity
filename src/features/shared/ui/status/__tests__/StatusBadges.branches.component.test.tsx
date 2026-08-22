/* @vitest-environment jsdom */

import * as React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  BadgeControl,
  CountBadge,
  EntityBadge,
  PhaseBadge,
  PriorityBadge,
  PriorityIcon,
  RelationshipBadge,
  RightBadgeBase,
  RoleBadge,
  SemanticBadge,
  StateBadge,
  StatusBadge,
  StatusBadgeWithDot,
  StatusDotIndicator,
  StatusPillFrame,
  TodoPriorityBadge,
  TodoPriorityIcon,
  TokenBadge,
  VisibilityBadge,
} from '../StatusBadges';

afterEach(cleanup);

function badgeClass(text: string) {
  const element = screen.getByText(text);
  return element.closest('[data-slot="badge"]')?.className ?? element.className;
}

describe('StatusBadges branch contracts', () => {
  it.each([
    ['approved', '--badge-success'],
    ['pending', '--badge-warning'],
    ['failed', '--badge-danger'],
    ['published', '--badge-info'],
    [null, '--badge-neutral'],
  ] as const)('maps status %s to its semantic tone', (status, token) => {
    render(<StatusBadge status={status}>{String(status)}</StatusBadge>);
    expect(badgeClass(String(status))).toContain(token);
  });

  it('supports explicit tones, outline variants, classes, and tooltip titles', () => {
    const { container } = render(
      <>
        <StatusBadge status="failed" tone="outline" className="custom" title="Explanation">
          Explicit
        </StatusBadge>
        <StatusBadge status="active">Untitled</StatusBadge>
      </>
    );
    expect(badgeClass('Explicit')).toContain('custom');
    expect(screen.getByText('Explicit').getAttribute('data-slot')).toBe('tooltip-trigger');
    expect(screen.getByText('Untitled')).toBeTruthy();
    expect(container.querySelector('[data-radix-popper-content-wrapper]')).toBeNull();
  });

  it('covers entity, role, count, visibility, and phase wrappers', () => {
    render(
      <>
        <EntityBadge entityType="event">Entity</EntityBadge>
        <EntityBadge tone="danger">Explicit entity</EntityBadge>
        <RoleBadge>Default role</RoleBadge>
        <RoleBadge tone="success">Explicit role</RoleBadge>
        <CountBadge count={0} />
        <CountBadge count="many" label="people" tone="info" />
        <VisibilityBadge value="private">Private</VisibilityBadge>
        <VisibilityBadge value="public">Public</VisibilityBadge>
        <VisibilityBadge value="private" tone="danger">
          Override visibility
        </VisibilityBadge>
        <PhaseBadge value="completed">Completed phase</PhaseBadge>
        <PhaseBadge value="draft" tone="accent">
          Override phase
        </PhaseBadge>
      </>
    );

    expect(badgeClass('Entity')).toContain('--entity-event-bg');
    expect(badgeClass('Explicit entity')).toContain('--badge-danger');
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('people')).toBeTruthy();
    expect(badgeClass('Private')).toContain('--badge-warning');
    expect(badgeClass('Public')).toContain('--badge-info');
  });

  it('maps every priority icon and badge path', () => {
    const { container } = render(
      <>
        <PriorityIcon value="urgent" className="urgent-icon" />
        <PriorityIcon value="high" />
        <PriorityIcon value="medium" />
        <PriorityIcon value={null} />
        <PriorityBadge value="urgent" showIcon>
          Urgent
        </PriorityBadge>
        <PriorityBadge value="high">High</PriorityBadge>
        <PriorityBadge value="medium">Medium</PriorityBadge>
        <PriorityBadge value="low">Low</PriorityBadge>
        <PriorityBadge value={null}>Unset</PriorityBadge>
        <PriorityBadge value="low" tone="info">
          Override priority
        </PriorityBadge>
        <TodoPriorityBadge priority="medium" showIcon />
        <TodoPriorityBadge priority="low" />
        <TodoPriorityIcon priority="high" />
      </>
    );

    expect(container.querySelector('.urgent-icon')).toBeTruthy();
    expect(badgeClass('Urgent')).toContain('--badge-danger');
    expect(badgeClass('Medium')).toContain('--badge-warning');
    expect(badgeClass('Low')).toContain('--badge-neutral');
    expect(badgeClass('Override priority')).toContain('--badge-info');
  });

  it.each([
    ['parent', '--badge-success'],
    ['child', '--badge-info'],
    ['sibling', '--badge-accent'],
    [null, 'border-border'],
  ] as const)('maps relationship %s', (value, token) => {
    render(<RelationshipBadge value={value}>{String(value)}</RelationshipBadge>);
    expect(badgeClass(String(value))).toContain(token);
  });

  it('covers relationship and simple wrapper overrides', () => {
    render(
      <>
        <RelationshipBadge value="parent" tone="danger">
          Override relationship
        </RelationshipBadge>
        <RightBadgeBase right="edit">edit</RightBadgeBase>
        <RightBadgeBase right="view" tone="info">
          view
        </RightBadgeBase>
        <TokenBadge>Token</TokenBadge>
        <TokenBadge tone="success">Explicit token</TokenBadge>
        <StateBadge status="active">State</StateBadge>
        <StateBadge status="failed" tone="accent">
          Explicit state
        </StateBadge>
      </>
    );

    expect(screen.getAllByText('edit')).toHaveLength(1);
    expect(screen.getByText('view')).toBeTruthy();
    expect(badgeClass('Override relationship')).toContain('--badge-danger');
  });

  it('renders dotted badges and indicators with optional tone, pulse, class, and title', () => {
    const { container } = render(
      <>
        <StatusBadgeWithDot status="active">Default dot</StatusBadgeWithDot>
        <StatusBadgeWithDot dotTone="success" dotClassName="custom-dot" pulse>
          Styled dot
        </StatusBadgeWithDot>
        <StatusDotIndicator />
        <StatusDotIndicator tone="danger" pulse className="indicator" title="Problem" />
      </>
    );

    expect(badgeClass('Styled dot')).toContain('animate-pulse');
    expect(container.querySelector('.custom-dot')).toBeTruthy();
    expect(container.querySelector('.indicator')).toBeTruthy();
  });

  it('renders all semantic badge sizes and optional adornments', () => {
    const Icon = ({ className }: { className?: string }) => <i className={className}>icon</i>;
    render(
      <>
        <SemanticBadge label="Extra small" leading="lead" Icon={Icon} pulse />
        <SemanticBadge label="Small" size="sm" strong={false} uppercase={false} className="small" />
        <SemanticBadge label="Medium" size="md" />
      </>
    );

    expect(screen.getByText('lead')).toBeTruthy();
    expect(screen.getByText('icon')).toBeTruthy();
    expect(screen.getByText('Small').parentElement?.className).not.toContain('font-bold');
    expect(screen.getByText('Medium').parentElement?.className).toContain('text-sm');
  });

  it('renders pill frames with default and explicit tones', () => {
    render(
      <>
        <StatusPillFrame>Default frame</StatusPillFrame>
        <StatusPillFrame tone="success" className="frame">
          Success frame
        </StatusPillFrame>
      </>
    );
    expect(badgeClass('Success frame')).toContain('frame');
  });

  it('covers every BadgeControl layout option', () => {
    const { container } = render(
      <>
        <BadgeControl>Default control</BadgeControl>
        <BadgeControl tone="info" size="tiny" shape="pill" textStyle="mono">
          Tiny
        </BadgeControl>
        <BadgeControl tone="success" size="xs" textTransform="uppercase" pulse>
          XS
        </BadgeControl>
        <BadgeControl tone="warning" size="sm" textTransform="capitalize" borderStyle="dashed">
          Small control
        </BadgeControl>
        <BadgeControl tone="danger" size="md">
          Medium control
        </BadgeControl>
        <BadgeControl tone="accent" size="dot" aria-label="dot control" />
        <BadgeControl tone="primary">Primary control</BadgeControl>
        <BadgeControl tone="dangerPale">Pale danger control</BadgeControl>
        <BadgeControl tone="warningPale">Pale warning control</BadgeControl>
        <StatusDotIndicator tone="event" className="event-dot" />
      </>
    );

    expect(badgeClass('Default control')).toContain('rounded-md');
    expect(badgeClass('Tiny')).toContain('rounded-full');
    expect(badgeClass('XS')).toContain('uppercase');
    expect(badgeClass('Small control')).toContain('border-dashed');
    expect(badgeClass('Medium control')).toContain('text-base');
    expect(screen.getByLabelText('dot control').className).toContain('rounded-md');
    expect(badgeClass('Primary control')).toContain('bg-primary');
    expect(badgeClass('Pale danger control')).toContain('--badge-danger-bg');
    expect(badgeClass('Pale warning control')).toContain('--badge-warning-bg');
    expect(container.querySelector('.event-dot')?.className).toContain('--entity-event-base');
  });
});
