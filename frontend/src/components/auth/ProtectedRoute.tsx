import { Navigate } from 'react-router-dom';
import { useChatStore } from '../../store/store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = useChatStore((state) => state.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}
