import { Navigate, Outlet } from 'react-router';
import { useAuth } from './AuthProvider';
import { DataGate } from './DataGate';

export function RequireAuth() {
  const { state } = useAuth();
  if (state.status === 'loading') return <div className="h-full" aria-busy="true" />;
  if (state.status === 'signedOut') return <Navigate to="/login" replace />;
  return (
    <DataGate>
      <Outlet />
    </DataGate>
  );
}
