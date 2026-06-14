import type { Value } from 'platejs';
import type { TDiscussion } from '@/features/shared/ui/kit-platejs/discussion-kit';
import type { ChangeRequestDiffData } from '@/features/agendas/ui/ChangeRequestTimelineCard';
import {
  createMockCRTimelineItems,
  type CRSummary,
} from '@/features/agendas/logic/createMockCRTimelineItems';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';

export const LANDING_AMENDMENT_USER_ID = 'landing-policy-lead';
export const LANDING_AMENDMENT_REVIEWER_ID = 'landing-reviewer';
export const LANDING_AGENDA_ITEM_ID = 'agenda-item-climate-budget-18';
const LANDING_AMENDMENT_CREATED_AT = 1781383200000;

export interface LandingChangeRequestOption {
  id: string;
  crId: string;
  title: string;
  type: string;
}

export interface LandingAmendmentPreviewCopy {
  documentTitle: string;
  paragraphs: string[];
  changeRequestTitle: string;
  changeRequestSubtitle: string;
  removedText: string;
  addedText: string;
  eventTitle: string;
  eventDescription: string;
  workflowDescription: string;
}

export interface LandingAmendmentPreviewData {
  documentValue: Value;
  discussions: TDiscussion[];
  changeRequests: LandingChangeRequestOption[];
  timelineItems: ChangeRequestTimelineRow[];
  diffMap: Record<string, ChangeRequestDiffData>;
  agendaItemId: string;
}

function suggestionText(text: string, suggestionId: string, type: 'insert' | 'remove') {
  return {
    text,
    suggestion: true,
    [`suggestion_${suggestionId}`]: {
      id: suggestionId,
      type,
      userId: LANDING_AMENDMENT_USER_ID,
      createdAt: LANDING_AMENDMENT_CREATED_AT,
    },
  };
}

function createDiscussion({
  id,
  crId,
  title,
  comment,
  userId = LANDING_AMENDMENT_USER_ID,
}: {
  id: string;
  crId: string;
  title: string;
  comment: string;
  userId?: string;
}): TDiscussion {
  return {
    id,
    crId,
    title,
    userId,
    isResolved: false,
    createdAt: new Date(LANDING_AMENDMENT_CREATED_AT),
    documentContent: comment,
    comments: [
      {
        id: `${id}-comment`,
        discussionId: id,
        contentRich: [
          {
            type: 'p',
            children: [{ text: comment }],
          },
        ],
        createdAt: new Date(LANDING_AMENDMENT_CREATED_AT),
        isEdited: false,
        userId,
      },
    ],
    changeRequestEntityId: id,
    votes: [
      {
        id: `${id}-vote-accept`,
        vote: 'accept',
        voterId: LANDING_AMENDMENT_REVIEWER_ID,
      },
    ],
  };
}

export function buildLandingAmendmentPreviewData(
  copy: LandingAmendmentPreviewCopy
): LandingAmendmentPreviewData {
  const [openingParagraph = '', processParagraph = '', decisionParagraph = ''] = copy.paragraphs;
  const reportingSuggestionId = 'cr-reporting-milestones';
  const hearingSuggestionId = 'cr-public-hearing';

  const documentValue = [
    {
      type: 'h2',
      children: [{ text: copy.documentTitle }],
    },
    {
      type: 'p',
      children: [{ text: openingParagraph }],
    },
    {
      type: 'p',
      children: [
        { text: processParagraph ? `${processParagraph} ` : '' },
        suggestionText(copy.removedText, reportingSuggestionId, 'remove'),
        { text: ' ' },
        suggestionText(copy.addedText, reportingSuggestionId, 'insert'),
      ],
    },
    {
      type: 'p',
      children: [
        { text: decisionParagraph ? `${decisionParagraph} ` : '' },
        suggestionText(copy.eventDescription, hearingSuggestionId, 'insert'),
      ],
    },
  ] as Value;

  const changeRequests: LandingChangeRequestOption[] = [
    {
      id: reportingSuggestionId,
      crId: 'CR-1',
      title: copy.changeRequestTitle,
      type: 'replace',
    },
    {
      id: hearingSuggestionId,
      crId: 'CR-2',
      title: copy.eventTitle,
      type: 'insert',
    },
  ];

  const crSummaries: CRSummary[] = [
    {
      id: reportingSuggestionId,
      crId: 'CR-1',
      title: copy.changeRequestTitle,
      description: copy.changeRequestSubtitle,
      status: 'open',
      type: 'replace',
      text: copy.removedText,
      newText: copy.addedText,
      justification: copy.workflowDescription,
    },
    {
      id: hearingSuggestionId,
      crId: 'CR-2',
      title: copy.eventTitle,
      description: copy.eventDescription,
      status: 'approved',
      type: 'insert',
      newText: copy.eventDescription,
    },
  ];

  const timelineItems = createMockCRTimelineItems(crSummaries).map(item => ({
    ...item,
    agenda_item_id: LANDING_AGENDA_ITEM_ID,
    vote: item.vote
      ? {
          ...item.vote,
          choices: item.vote.choices.filter(choice => choice.label !== 'abstain'),
        }
      : item.vote,
  })) as unknown as ChangeRequestTimelineRow[];

  return {
    documentValue,
    changeRequests,
    discussions: [
      createDiscussion({
        id: reportingSuggestionId,
        crId: 'CR-1',
        title: copy.changeRequestTitle,
        comment: copy.workflowDescription,
      }),
      createDiscussion({
        id: hearingSuggestionId,
        crId: 'CR-2',
        title: copy.eventTitle,
        comment: copy.eventDescription,
        userId: LANDING_AMENDMENT_REVIEWER_ID,
      }),
    ],
    timelineItems,
    diffMap: {
      [reportingSuggestionId]: {
        changeType: 'replace',
        originalText: copy.removedText,
        newText: copy.addedText,
        justification: copy.workflowDescription,
      },
      [hearingSuggestionId]: {
        changeType: 'insert',
        newText: copy.eventDescription,
      },
    },
    agendaItemId: LANDING_AGENDA_ITEM_ID,
  };
}
