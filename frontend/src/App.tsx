import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Shell from './pages/Shell';
import Feed from './pages/Feed';
import ProjectPage from './pages/ProjectPage';
import Account from './pages/Account';
import AdminClients from './pages/admin/AdminClients';
import AdminUsers from './pages/admin/AdminUsers';
import AdminProjects from './pages/admin/AdminProjects';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Shell />}>
            <Route index element={<Navigate to="/feed" replace />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/p/:projectId" element={<ProjectPage />} />
            <Route path="/account" element={<Account />} />
            <Route path="/admin/clients" element={<AdminClients />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/projects" element={<AdminProjects />} />
          </Route>
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
