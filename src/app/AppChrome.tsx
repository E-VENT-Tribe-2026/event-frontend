import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import TopBar from '@/components/TopBar';

type TopBarSearch = {
  search: string;
  setSearch: (value: string) => void;
};

const TopBarSearchContext = createContext<TopBarSearch | null>(null);

export function useTopBarSearch(): TopBarSearch {
  const ctx = useContext(TopBarSearchContext);
  const [localSearch, setLocalSearch] = useState('');
  return ctx ?? { search: localSearch, setSearch: setLocalSearch };
}

function searchPlaceholderFor(pathname: string): string | null {
  if (pathname === '/home' || pathname === '/map') return 'Search events...';
  if (pathname === '/friends') return 'Search by username...';
  if (pathname === '/notifications') return 'Search notifications...';
  if (pathname === '/chat') return 'Search chats...';
  return null;
}

/** Persistent signed-in chrome: top nav on every in-app page. */
export default function AppChrome({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [search, setSearch] = useState('');
  const placeholder = searchPlaceholderFor(pathname);

  useEffect(() => {
    setSearch('');
  }, [pathname]);

  const value = useMemo(() => ({ search, setSearch }), [search]);

  return (
    <TopBarSearchContext.Provider value={value}>
      <TopBar
        showSearch={placeholder != null}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={placeholder ?? 'Search events...'}
      />
      {children}
    </TopBarSearchContext.Provider>
  );
}
