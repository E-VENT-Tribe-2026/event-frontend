import { Navigate } from 'react-router-dom';
import { getAuthToken } from '@/lib/auth';

/** Signed-out visitors are sent to sign-in. Username and admin checks stay in RequireUsername. */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getAuthToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
