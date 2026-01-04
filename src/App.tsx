import { Routes, Route, Navigate } from 'react-router-dom'
import GeneratePage from './pages/GeneratePage'
import WorksheetPage from './pages/WorksheetPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TestPage from './pages/TestPage'
import WorksheetsListPage from './pages/WorksheetsListPage'
import SavedWorksheetPage from './pages/SavedWorksheetPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<GeneratePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/worksheet/:sessionId" element={<WorksheetPage />} />
        <Route path="/worksheets" element={<WorksheetsListPage />} />
        <Route path="/worksheets/:id" element={<SavedWorksheetPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
