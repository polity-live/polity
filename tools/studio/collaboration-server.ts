// The separate persistence/room namespace is retired. Old startup commands must
// fail visibly instead of accepting updates outside the shared commit boundary.
throw new Error(
  'Standalone Studio collaboration is retired. Use pnpm dev:stack or pnpm collaboration:server on port 1236.'
);
export {};
