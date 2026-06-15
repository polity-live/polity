import { createElement, type ReactNode } from 'react';

import { CreateGroupSummaryStep } from '../ui/CreateGroupSummaryStep';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import type { CreateFormFieldDescriptor, CreateFormStep } from '../types/create-form.types';

export const CREATE_REVIEW_CARD_LAYOUT_ID = 'create-review-card';

const REVIEW_SUMMARY_COMPONENTS = new Set<unknown>([CreateSummaryStep, CreateGroupSummaryStep]);

function findReviewSummaryField(fields?: CreateFormFieldDescriptor[]) {
  return fields?.find(
    field => field.kind === 'customComponent' && REVIEW_SUMMARY_COMPONENTS.has(field.component)
  );
}

export function getCreateReviewPreview(steps: CreateFormStep[]): ReactNode | null {
  const reviewStep = steps[steps.length - 1];

  if (!reviewStep) {
    return null;
  }

  const directField = findReviewSummaryField(reviewStep.fields);
  const sectionField =
    directField ??
    reviewStep.sections
      ?.map(section => findReviewSummaryField(section.fields))
      .find((field): field is NonNullable<typeof field> => Boolean(field));
  const field = directField ?? sectionField;

  if (!field || field.kind !== 'customComponent') {
    return null;
  }

  return createElement(field.component, {
    ...(field.props ?? {}),
    layoutId: CREATE_REVIEW_CARD_LAYOUT_ID,
    overlayMode: true,
  });
}
