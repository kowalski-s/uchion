import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getGenerationsLeft } from '../lib/limits'

export default function Header() {
  const { user, signOut } = useAuth()
  const generationsLeft = getGenerationsLeft(user)

  return (
    <header className="relative z-10 pt-6 pb-4">
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity">
          <span className="text-slate-900">Учи</span>
          <span className="text-[#8C52FF] drop-shadow-[0_0_12px_rgba(140,82,255,0.4)]">Он</span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="text-sm text-slate-600">
                <span className="font-medium">{user.name || user.email}</span>
                <span className="ml-2 text-[#8C52FF] font-bold">{generationsLeft} генераций</span>
              </div>
              <button
                onClick={signOut}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-[#8C52FF] transition-colors"
              >
                Выйти
              </button>
            </>
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
