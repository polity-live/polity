import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function assertStableActionWiring(files: string[], minimumActions: number) {
  let actionCount = 0;

  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const matches = [...source.matchAll(/data-action-id="(timeline\.[a-z0-9.-]+)"/g)];
    actionCount += matches.length;

    for (const match of matches) {
      const actionId = match[1];
      const wiringWindow = source.slice(match.index, match.index + 1_200);
      expect(actionId, `${file} must use domain.surface.verb.variant semantics`).toMatch(
        /^timeline(?:\.[a-z0-9-]+){2,}$/
      );
      expect(
        /onClick|onCheckedChange|onValueChange|href=|to=|actionId=|url=|value=/.test(wiringWindow),
        `${file}#${actionId} must remain adjacent to its handler or destination`
      ).toBe(true);
    }
  }

  expect(actionCount).toBeGreaterThanOrEqual(minimumActions);
}

describe('timeline UI accountability wiring', () => {
  it('wires universal timeline action controls to stable user intentions', () => {
    assertStableActionWiring(
      [
        'src/features/timeline/ui/cards/ActionBar.tsx',
        'src/features/timeline/ui/cards/TimelineCardBase.tsx',
        'src/features/timeline/ui/cards/QuickComment.tsx',
        'src/features/timeline/ui/cards/QuickCommentView.tsx',
        'src/features/timeline/ui/cards/ReasonTooltipView.tsx',
      ],
      20
    );
  });

  it('wires timeline filtering, mode, header, and rail controls to stable user intentions', () => {
    assertStableActionWiring(
      [
        'src/features/timeline/ui/TimelineFilterPanel.tsx',
        'src/features/timeline/ui/TimelineHeader.tsx',
        'src/features/timeline/ui/TimelineModeToggle.tsx',
        'src/features/timeline/ui/CivicTimelineRail.tsx',
        'src/features/timeline/ui/AccessibilityComponents.tsx',
        'src/features/timeline/ui/MasonryGridView.tsx',
        'src/features/timeline/ui/ModernTimelineView.tsx',
      ],
      17
    );
  });

  it('wires timeline card consumers to stable navigation and handler intentions', () => {
    assertStableActionWiring(
      [
        'src/features/timeline/ui/cards/ActionTimelineCard.tsx',
        'src/features/timeline/ui/cards/AmendmentTimelineCardView.tsx',
        'src/features/timeline/ui/cards/BlogTimelineCardView.tsx',
        'src/features/timeline/ui/cards/ElectionTimelineCard.tsx',
        'src/features/timeline/ui/cards/EventTimelineCardView.tsx',
        'src/features/timeline/ui/cards/GroupTimelineCardView.tsx',
        'src/features/timeline/ui/cards/ImageTimelineCard.tsx',
        'src/features/timeline/ui/cards/MeetupTimelineCard.tsx',
        'src/features/timeline/ui/cards/PaymentTimelineCard.tsx',
        'src/features/timeline/ui/cards/StatementTimelineCard.tsx',
        'src/features/timeline/ui/cards/TodoTimelineCardView.tsx',
        'src/features/timeline/ui/cards/UserTimelineCardView.tsx',
        'src/features/timeline/ui/cards/VideoTimelineCardView.tsx',
        'src/features/timeline/ui/cards/VoteTimelineCard.tsx',
      ],
      55
    );
  });
});
