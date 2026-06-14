import { useState, type FormEvent } from 'react';

interface UseAddTodoDialogControllerProps {
  onSubmit: (data: {
    title: string;
    description: string;
    priority: string;
    dueDate: string;
  }) => void;
}

export function useAddTodoDialogController({ onSubmit }: UseAddTodoDialogControllerProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ title, description, priority, dueDate });
    reset();
  };

  return {
    description,
    dueDate,
    priority,
    title,
    onDescriptionChange: setDescription,
    onDueDateChange: setDueDate,
    onPriorityChange: setPriority,
    onSubmit: handleSubmit,
    onTitleChange: setTitle,
  };
}
