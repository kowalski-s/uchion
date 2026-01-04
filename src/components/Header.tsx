import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getGenerationsLeft } from '../lib/limits'

function UserIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  )
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

export default function Header() {
  const { user } = useAuth()
  const generationsLeft = getGenerationsLeft(user)
  const location = useLocation()
  const isDashboard = location.pathname === '/dashboard'

  return (
    <header className="relative z-10 pt-6 pb-4">
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity">
            <span className="text-slate-900">Учи</span>
            <span className="text-[#8C52FF] drop-shadow-[0_0_12px_rgba(140,82,255,0.4)]">Он</span>
          </Link>

          {/* Create button - glass style */}
          {user && (
            <Link
              to="/"
              className="glass-btn-neon flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Создать</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <Link
              to="/dashboard"
              className={`glass-btn-neon flex items-center gap-2 px-4 py-2 text-sm font-semibold ${isDashboard ? 'glass-btn-neon-active' : ''}`}
            >
              <UserIcon className="w-4 h-4" />
              <span>Личный кабинет</span>
            </Link>
          ) : (
            <>
              <div className="text-sm text-slate-500">
                Бесплатно: {generationsLeft} из 2
              </div>
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#8C52FF] to-[#A16BFF] rounded-lg hover:scale-105 transition-transform"
              >
                Войти
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
