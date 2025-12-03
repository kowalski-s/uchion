import { Routes, Route, Navigate } from 'react-router-dom'
import GeneratePage from './pages/GeneratePage'
import WorksheetPage from './pages/WorksheetPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<GeneratePage />} />
        <Route path="/worksheet/:sessionId" element={<WorksheetPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
