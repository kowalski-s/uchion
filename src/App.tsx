import { Routes, Route, Navigate } from 'react-router-dom'
import GeneratePage from './pages/GeneratePage'
import WorksheetPage from './pages/WorksheetPage'
import LoginPage from './pages/LoginPage'
import TestPage from './pages/TestPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<GeneratePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/worksheet/:sessionId" element={<WorksheetPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
