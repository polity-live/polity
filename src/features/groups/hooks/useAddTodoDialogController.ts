import { useState, type FormEvent } from 'react';

interface UseAddTodoDialogControllerProps {
  onSubmit: (data: {
    title: string;
    description: string;
    priority: string;
    dueDate: string;
    dueTime: string;
  }) => void;
}

export function useAddTodoDialogController({ onSubmit }: UseAddTodoDialogControllerProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setDueTime('');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ title, description, priority, dueDate, dueTime });
    reset();
  };

  return {
    description,
    dueDate,
    dueTime,
    priority,
    title,
    onDescriptionChange: setDescription,
    onDueDateChange: (value: string) => {
      setDueDate(value);
      if (!value) setDueTime('');
    },
    onDueTimeChange: setDueTime,
    onPriorityChange: setPriority,
    onSubmit: handleSubmit,
    onTitleChange: setTitle,
  };
}
