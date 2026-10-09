import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ResetPassword } from './pages/ResetPassword';
import { NormalUserHome } from './pages/NormalUserHome';
import { SysAdminHome } from './pages/SysAdminHome';
import { SuperAdminHome } from './pages/SuperAdminHome';
import { EditDiary } from './pages/EditDiary';
import { EditComment } from './pages/EditComment';
import { Account } from './pages/Account';
import { EditUserProfile } from './pages/EditUserProfile';
import { CountPage } from './pages/CountPage';
import { LotusSpinner } from './components/LotusSpinner';

// HashRouter works with file:// protocol (Android WebView); BrowserRouter needs a web server.
const Router = (typeof window !== 'undefined' && window.location.protocol === 'file:') ? HashRouter : BrowserRouter;

function PrivateRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <LotusSpinner />;
  if (!token) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/home" element={<PrivateRoute><NormalUserHome /></PrivateRoute>} />
            <Route path="/sys" element={<PrivateRoute><SysAdminHome /></PrivateRoute>} />
            <Route path="/super" element={<PrivateRoute><SuperAdminHome /></PrivateRoute>} />
            <Route path="/edit-diary" element={<PrivateRoute><EditDiary /></PrivateRoute>} />
            <Route path="/edit-diary/:id" element={<PrivateRoute><EditDiary /></PrivateRoute>} />
            <Route path="/edit-comment/:id" element={<PrivateRoute><EditComment /></PrivateRoute>} />
            <Route path="/account" element={<PrivateRoute><Account /></PrivateRoute>} />
            <Route path="/edit-user-profile" element={<PrivateRoute><EditUserProfile /></PrivateRoute>} />
            <Route path="/count" element={<PrivateRoute><CountPage /></PrivateRoute>} />
          </Routes>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}
