import { createFileRoute } from '@tanstack/react-router';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { TodosPage } from '@/features/todos/TodosPage';
import { useTodosPreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/todos')({
  component: TodosRoute,
});

function TodosRoute() {
  useTodosPreloads();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const isDetailRoute = /^\/todos\/[^/]+\/?$/.test(pathname);

  return isDetailRoute ? <Outlet /> : <TodosPage />;
}
