import { FormControlLabel } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { CreateInputField } from '@/features/shared/ui/form';

export function StatementSurveyInput({
  title,
  questionLabel,
  optionLabel,
  durationLabel,
  addOptionLabel,
  surveyQuestion,
  surveyOptions,
  surveyDurationHours,
  onSurveyQuestionChange,
  onSurveyOptionsChange,
  onSurveyDurationHoursChange,
}: {
  title: string;
  questionLabel: string;
  optionLabel: string;
  durationLabel: string;
  addOptionLabel: string;
  surveyQuestion: string;
  surveyOptions: string[];
  surveyDurationHours: number;
  onSurveyQuestionChange: (value: string) => void;
  onSurveyOptionsChange: (value: string[]) => void;
  onSurveyDurationHoursChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <FormControlLabel className="text-base font-semibold">{title}</FormControlLabel>
      <CreateInputField
        label={questionLabel}
        value={surveyQuestion}
        onValueChange={onSurveyQuestionChange}
        placeholder={questionLabel}
      />
      {surveyOptions.map((option, index) => (
        <CreateInputField
          key={index}
          label={`${optionLabel} ${index + 1}`}
          value={option}
          onValueChange={value => {
            const nextOptions = [...surveyOptions];
            nextOptions[index] = value;
            onSurveyOptionsChange(nextOptions);
          }}
          placeholder={`${optionLabel} ${index + 1}`}
        />
      ))}
      {surveyOptions.length < 4 && (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm"
          onClick={() => onSurveyOptionsChange([...surveyOptions, ''])}
        >
          {addOptionLabel}
        </Button>
      )}
      <div className="space-y-2">
        <CreateInputField
          label={durationLabel}
          type="number"
          min={1}
          max={168}
          value={surveyDurationHours}
          onValueChange={value => onSurveyDurationHoursChange(Number(value) || 1)}
        />
      </div>
    </div>
  );
}
