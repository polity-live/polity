import { useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';

// Custom hook to set initial route based on window location
export function useInitialRoute(
  setCurrentPrimaryRoute: React.Dispatch<React.SetStateAction<string | null>>
) {
  const { pathname } = useLocation();

  useEffect(() => {
    const route =
      pathname === '/'
        ? 'home'
        : /^\/(?:group|user)\/[^/]+\/blog\/[^/]+(?:\/|$)/.test(pathname)
          ? 'blog'
          : pathname.split('/')[1];
    setCurrentPrimaryRoute(route);
  }, [pathname, setCurrentPrimaryRoute]);
}
