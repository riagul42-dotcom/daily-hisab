import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Expenses from './pages/Expenses.jsx';
import Incomes from './pages/Incomes.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';
import CreateAccount from './pages/CreateAccount.jsx';

function Splash() {
  return (
    <div className="splash">
      <div className="splash-logo">৳</div>
      <p>Daily Hisab লোড হচ্ছে…</p>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'superadmin') return <Navigate to="/" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route
        element={(
          <Protected>
            <Layout />
          </Protected>
        )}
      >
        <Route index element={<Dashboard />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="incomes" element={<Incomes />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<AdminOnly><Users /></AdminOnly>} />
        <Route path="create-user" element={<AdminOnly><CreateAccount /></AdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
