import type { ReactNode } from 'react';
import { APP_SHELL_PAGE_FRAME_CLASS, type AppShellPageFrame } from './app-shell-layout';

export function PageFrame({ children, frame }: { children: ReactNode; frame: AppShellPageFrame }) {
  if (frame === 'bare') return children;
  return (
    <div
      data-slot="app-shell-page-frame"
      data-frame={frame}
      className={APP_SHELL_PAGE_FRAME_CLASS[frame]}
    >
      {children}
    </div>
  );
}
