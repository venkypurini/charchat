import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Loader2 } from 'lucide-react';
import { useChatStore } from './store/store';

const Login = lazy(() => import('./components/auth/Login'));
const ChatDashboard = lazy(() => import('./components/chat/ChatDashboard'));

function PageLoader() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
        <span className="text-sm font-bold text-teal-400 animate-pulse">Loading CharChat...</span>
      </div>
    </div>
  );
}

function App() {
  const theme = useChatStore(s => s.theme);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <ChatDashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
