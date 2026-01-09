import { Routes, Route, Navigate } from 'react-router-dom'
import GeneratePage from './pages/GeneratePage'
import WorksheetPage from './pages/WorksheetPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import WorksheetsListPage from './pages/WorksheetsListPage'
import SavedWorksheetPage from './pages/SavedWorksheetPage'

// Admin pages
import AdminPage, { AdminOverview } from './pages/admin/AdminPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage'
import AdminGenerationsPage from './pages/admin/AdminGenerationsPage'
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<GeneratePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/worksheet/:sessionId" element={<WorksheetPage />} />
        <Route path="/worksheets" element={<WorksheetsListPage />} />
        <Route path="/worksheets/:id" element={<SavedWorksheetPage />} />

        {/* Admin routes */}
        <Route path="/admin" element={<AdminPage />}>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
          <Route path="generations" element={<AdminGenerationsPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
