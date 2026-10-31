import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import AIAssistantWidget from '@/components/assistant/AIAssistantWidget';
import RealtimeBridge from '@/components/RealtimeBridge';
import RouteDocumentTitle from '@/components/RouteDocumentTitle';
import { queryClient, queryPersister, SESSION_CACHE_MAX_AGE } from '@/lib/queryClient';
import AppRoutes from '@/app/AppRoutes';
import SessionGuard from '@/app/SessionGuard';

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryPersister!,
      maxAge: SESSION_CACHE_MAX_AGE,
      buster: import.meta.env.VITE_CACHE_BUSTER ?? '',
      dehydrateOptions: {
        shouldDehydrateQuery: (query) =>
          query.state.status === 'success' && query.queryKey[0] !== 'notifications',
      },
    }}
  >
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteDocumentTitle />
        <SessionGuard>
          <RealtimeBridge />
          <AppRoutes />
          <AIAssistantWidget />
        </SessionGuard>
      </BrowserRouter>
    </TooltipProvider>
    {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
  </PersistQueryClientProvider>
);

export default App;
