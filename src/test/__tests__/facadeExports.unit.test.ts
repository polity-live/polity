import { describe, expect, it } from 'vitest';

import { DocsSignalBadge, type DocsSignalTone } from '@/features/docs/ui/DocsSignalBadge';
import {
  CalendarChronologicalListView,
  SharedChronologicalListView,
} from '@/features/events/ui/calendar/SharedChronologicalListView';
import * as rechartsFacade from '@/features/shared/ui/charting/RechartsPrimitives';
import { DocsSignalBadge as SharedDocsSignalBadge } from '@/features/shared/ui/status';
import {
  CalendarChronologicalListView as SharedCalendarChronologicalListView,
  SharedChronologicalListView as SharedSharedChronologicalListView,
} from '@/features/shared/ui/calendar';
import * as promptFacade from '@/server/ai-prompts';
import * as prompts from '@/lib/ai/prompts';

describe('production facade contracts', () => {
  it('keeps the docs signal facade wired to the shared status implementation', () => {
    const tone: DocsSignalTone = 'result';
    expect(tone).toBe('result');
    expect(DocsSignalBadge).toBe(SharedDocsSignalBadge);
  });

  it('keeps the chronological calendar aliases wired to shared calendar views', () => {
    expect(CalendarChronologicalListView).toBe(SharedCalendarChronologicalListView);
    expect(SharedChronologicalListView).toBe(SharedSharedChronologicalListView);
  });

  it('publishes every supported Recharts primitive', () => {
    expect(Object.keys(rechartsFacade).sort()).toEqual(
      [
        'Area',
        'AreaChart',
        'Bar',
        'BarChart',
        'CartesianGrid',
        'Cell',
        'Legend',
        'Line',
        'LineChart',
        'Pie',
        'PieChart',
        'RechartsTooltip',
        'ResponsiveContainer',
        'XAxis',
        'YAxis',
      ].sort()
    );
    expect(Object.values(rechartsFacade).every(Boolean)).toBe(true);
  });

  it('keeps the server AI prompt facade identical to the shared prompt module', () => {
    expect(promptFacade.BASE_ARIA_KAI_SYSTEM_PROMPT).toBe(prompts.BASE_ARIA_KAI_SYSTEM_PROMPT);
    expect(promptFacade.buildCurrentTurnUserContent).toBe(prompts.buildCurrentTurnUserContent);
    expect(promptFacade.buildHistoricUserContent).toBe(prompts.buildHistoricUserContent);
    expect(promptFacade.buildSystemPrompt).toBe(prompts.buildSystemPrompt);
  });
});
