import { useState } from 'react';

type StatementVisibility = 'public' | 'authenticated' | 'private';

interface StatementEditSnapshot {
  imageUrl?: string | null;
  surveyOptions?: readonly { label: string }[] | null;
  surveyQuestion?: string | null;
  text?: string | null;
  videoUrl?: string | null;
  visibility?: string | null;
}

export function useStatementEditDialog() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editText, setEditText] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editVisibility, setEditVisibility] = useState<StatementVisibility>('public');
  const [editSurveyQuestion, setEditSurveyQuestion] = useState('');
  const [editSurveyOptions, setEditSurveyOptions] = useState<string[]>(['', '']);
  const [editSurveyDuration, setEditSurveyDuration] = useState(24);

  const prepareEdit = (snapshot: StatementEditSnapshot) => {
    setEditText(snapshot.text ?? '');
    setEditImageUrl(snapshot.imageUrl ?? '');
    setEditVideoUrl(snapshot.videoUrl ?? '');
    setEditVisibility((snapshot.visibility ?? 'public') as StatementVisibility);
    setEditSurveyQuestion(snapshot.surveyQuestion ?? '');
    setEditSurveyOptions(
      snapshot.surveyOptions?.length ? snapshot.surveyOptions.map(option => option.label) : ['', '']
    );
    setEditSurveyDuration(24);
  };

  const resetSurvey = () => {
    setEditSurveyQuestion('');
    setEditSurveyOptions(['', '']);
  };

  return {
    deleteOpen,
    editImageUrl,
    editSurveyDuration,
    editSurveyOptions,
    editSurveyQuestion,
    editText,
    editVideoUrl,
    editVisibility,
    prepareEdit,
    resetSurvey,
    setDeleteOpen,
    setEditImageUrl,
    setEditSurveyDuration,
    setEditSurveyOptions,
    setEditSurveyQuestion,
    setEditText,
    setEditVideoUrl,
    setEditVisibility,
  };
}
