import { describe, expect, it } from 'vitest';

import { buildLandingAmendmentPreviewData } from '@/features/public-landing/logic/landingAmendmentPreview';

const previewCopy = {
  documentTitle: 'Motion for transparent climate reporting',
  paragraphs: [
    'The party congress asks the parliamentary group to publish yearly climate reporting.',
    'Reports should be prepared with affected local branches.',
    'The decision is reviewed after the first budget cycle.',
  ],
  changeRequestTitle: 'Sharpen reporting milestones',
  changeRequestSubtitle: 'Replace the reporting cadence with quarterly milestones.',
  removedText: 'yearly climate reporting',
  addedText: 'quarterly public climate milestones',
  eventTitle: 'Schedule public hearing',
  eventDescription: 'A public hearing is held before the final vote.',
  workflowDescription: 'Delegates can compare both versions before the vote.',
};

describe('landingAmendmentPreview', () => {
  it('builds a stable read-only document value with suggestion marks', () => {
    const data = buildLandingAmendmentPreviewData(previewCopy);
    const documentJson = JSON.stringify(data.documentValue);

    expect(data.documentValue[0]).toMatchObject({
      type: 'h2',
      children: [{ text: previewCopy.documentTitle }],
    });
    expect(documentJson).toContain('suggestion_cr-reporting-milestones');
    expect(documentJson).toContain('suggestion_cr-public-hearing');
    expect(documentJson).toContain(previewCopy.addedText);
  });

  it('builds change-request discussions and timeline data with stable ids', () => {
    const data = buildLandingAmendmentPreviewData(previewCopy);

    expect(data.changeRequests.map(changeRequest => changeRequest.id)).toEqual([
      'cr-reporting-milestones',
      'cr-public-hearing',
    ]);
    expect(data.discussions.map(discussion => discussion.crId)).toEqual(['CR-1', 'CR-2']);
    expect(Object.keys(data.diffMap)).toEqual(['cr-reporting-milestones', 'cr-public-hearing']);
    expect(data.timelineItems.length).toBeGreaterThanOrEqual(2);
    expect(data.agendaItemId).toBe('agenda-item-climate-budget-18');
    expect(data.timelineItems[0]?.vote?.choices.map(choice => choice.label)).toEqual(['yes', 'no']);
  });
});
