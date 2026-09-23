import { createFileRoute, Outlet } from '@tanstack/react-router';
export const Route = createFileRoute('/_authed/whiteboards')({
  component: Outlet,
});
