import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import CookieConsent from './components/CookieConsent'
import GeneratePage from './pages/GeneratePage'
import GeneratePresentationPage from './pages/GeneratePresentationPage'
import WorksheetPage from './pages/WorksheetPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import WorksheetsListPage from './pages/WorksheetsListPage'
import SavedWorksheetPage from './pages/SavedWorksheetPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import PaymentCancelPage from './pages/PaymentCancelPage'
import TelegramCallbackPage from './pages/TelegramCallbackPage'

// Admin pages -- lazy-loaded into a separate chunk.
// The AdminPage layout itself checks the user role before rendering,
// so even if someone loads the chunk they won't see data without admin rights.
const AdminPage = lazy(() => import('./pages/admin/AdminPage'))
const AdminOverview = lazy(() => import('./pages/admin/AdminPage').then(m => ({ default: m.AdminOverview })))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'))
const AdminGenerationsPage = lazy(() => import('./pages/admin/AdminGenerationsPage'))
const AdminPaymentsPage = lazy(() => import('./pages/admin/AdminPaymentsPage'))

function AdminFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200 border-t-[#8C52FF]"></div>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen">
      <CookieConsent />
      <Routes>
        <Route path="/" element={<GeneratePage />} />
        <Route path="/presentations/generate" element={<GeneratePresentationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/worksheet/:sessionId" element={<WorksheetPage />} />
        <Route path="/worksheets" element={<WorksheetsListPage />} />
        <Route path="/worksheets/:id" element={<SavedWorksheetPage />} />

        {/* Auth callback routes */}
        <Route path="/auth/telegram/callback" element={<TelegramCallbackPage />} />

        {/* Payment routes */}
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/payment/cancel" element={<PaymentCancelPage />} />

        {/* Admin routes -- lazy loaded */}
        <Route path="/admin" element={<Suspense fallback={<AdminFallback />}><AdminPage /></Suspense>}>
          <Route index element={<Suspense fallback={<AdminFallback />}><AdminOverview /></Suspense>} />
          <Route path="users" element={<Suspense fallback={<AdminFallback />}><AdminUsersPage /></Suspense>} />
          <Route path="users/:id" element={<Suspense fallback={<AdminFallback />}><AdminUserDetailPage /></Suspense>} />
          <Route path="generations" element={<Suspense fallback={<AdminFallback />}><AdminGenerationsPage /></Suspense>} />
          <Route path="payments" element={<Suspense fallback={<AdminFallback />}><AdminPaymentsPage /></Suspense>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
