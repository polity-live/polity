import { createFileRoute } from '@tanstack/react-router';
import { TodosPage } from '@/features/todos/TodosPage';
import { useTodosPreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/todos')({
  component: TodosRoute,
});

function TodosRoute() {
  useTodosPreloads();
  return <TodosPage />;
}
