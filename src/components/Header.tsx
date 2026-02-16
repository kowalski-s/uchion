import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function DocumentPlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

function PresentationPlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  )
}

function UserIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  )
}

function ShieldIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  )
}

export default function Header() {
  const { user } = useAuth()
  const location = useLocation()
  const isDashboard = location.pathname === '/dashboard'
  const [createOpen, setCreateOpen] = useState(false)
  const createRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false)
      }
    }
    if (createOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [createOpen])

  return (
      <header className="relative z-10 pt-4 pb-4">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Logo */}
            <Link to="/" className="flex-shrink-0 hover:opacity-80 transition-opacity mr-1 sm:mr-2">
              <img src="/logo.png" alt="УчиОн" className="h-10 sm:h-12" />
            </Link>

            {/* Create button with dropdown */}
            {user && (
            <div className="relative" ref={createRef}>
              <button
                onClick={() => setCreateOpen(!createOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-[#8C52FF] text-sm font-semibold rounded-xl transition-all hover:scale-105 bg-purple-50/80 hover:bg-purple-100 border border-purple-200/60 shadow-[0_0_8px_rgba(140,82,255,0.15)]"
              >
                <PlusIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Создать</span>
              </button>
              {createOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-50">
                  <Link
                    to="/"
                    onClick={() => setCreateOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-purple-50 transition-colors"
                  >
                    <DocumentPlusIcon className="w-5 h-5 text-[#8C52FF]" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Рабочий лист</p>
                      <p className="text-xs text-slate-400">Задания и тесты</p>
                    </div>
                  </Link>
                  <Link
                    to="/presentations/generate"
                    onClick={() => setCreateOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-purple-50 transition-colors border-t border-slate-50"
                  >
                    <PresentationPlusIcon className="w-5 h-5 text-[#8C52FF]" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Презентация</p>
                      <p className="text-xs text-slate-400">Учебные слайды</p>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className={`flex items-center gap-2 px-4 py-2 text-[#8C52FF] text-sm font-semibold rounded-xl transition-all hover:scale-105 bg-purple-50/80 hover:bg-purple-100 border border-purple-200/60 shadow-[0_0_8px_rgba(140,82,255,0.15)] ${isDashboard ? 'bg-purple-100 border-purple-300/80' : ''}`}
              >
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Личный кабинет</span>
              </Link>
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className={`flex items-center justify-center w-10 h-10 text-[#8C52FF] rounded-xl transition-all hover:scale-105 bg-purple-50/80 hover:bg-purple-100 border border-purple-200/60 shadow-[0_0_8px_rgba(140,82,255,0.15)] ${location.pathname.startsWith('/admin') ? 'bg-purple-100 border-purple-300/80' : ''}`}
                  title="Админ-панель"
                >
                  <ShieldIcon className="w-5 h-5" />
                </Link>
              )}
            </>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#8C52FF] to-[#A16BFF] rounded-lg hover:scale-105 transition-transform"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
