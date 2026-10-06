import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Loader2 } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * Route guard that allows access only to administrators whose sign-in code has been accepted.
 * Blocks unauthorized users and redirects them to /home.
 */
export default function AdminGuard({ children }: AdminGuardProps) {
  const { isVerifiedAdmin, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Verifying administrator privileges...</p>
      </div>
    );
  }

  if (!isVerifiedAdmin) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
