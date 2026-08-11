/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';

import { useStatementEditDialog } from '../useStatementEditDialog';

it('prepares and resets statement edit snapshots with defaults and explicit values', () => {
  const { result } = renderHook(() => useStatementEditDialog());
  act(() => result.current.prepareEdit({}));
  expect(result.current).toMatchObject({
    editTitle: '',
    editText: '',
    editVisibility: 'public',
    editSurveyOptions: ['', ''],
  });
  act(() =>
    result.current.prepareEdit({
      title: 'T',
      text: 'B',
      imageUrl: 'I',
      videoUrl: 'V',
      isStory: true,
      visibility: 'private',
      surveyQuestion: 'Q',
      surveyOptions: [{ label: 'A' }, { label: 'B' }],
    })
  );
  expect(result.current).toMatchObject({
    editTitle: 'T',
    editText: 'B',
    editIsStory: true,
    editVisibility: 'private',
    editSurveyQuestion: 'Q',
    editSurveyOptions: ['A', 'B'],
  });
  act(() => result.current.resetSurvey());
  expect(result.current.editSurveyOptions).toEqual(['', '']);
});
