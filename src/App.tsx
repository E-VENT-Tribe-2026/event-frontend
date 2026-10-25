import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import AIAssistantWidget from '@/components/assistant/AIAssistantWidget';
import RealtimeBridge from '@/components/RealtimeBridge';
import RouteDocumentTitle from '@/components/RouteDocumentTitle';
import { queryClient } from '@/lib/queryClient';
import AppRoutes from '@/app/AppRoutes';
import SessionGuard from '@/app/SessionGuard';

const persister = typeof window !== 'undefined'
  ? createSyncStoragePersister({
    storage: window.localStorage,
    key: 'event-tribe-query-cache',
  })
  : undefined;

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{ persister: persister! }}
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
