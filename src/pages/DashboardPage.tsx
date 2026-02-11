import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { formatPlanName } from '../lib/dashboard-api'
import Header from '../components/Header'
import WorksheetManager from '../components/WorksheetManager'
import BuyGenerationsModal from '../components/BuyGenerationsModal'

// Icon components (used in stats cards)

function BoltIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  )
}

function DocumentIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

function GiftIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  )
}

function PresentationIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  )
}

function ChatIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  )
}

function ArrowRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/50 to-white flex items-center justify-center">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-200"></div>
        <div className="absolute inset-0 animate-spin rounded-full h-12 w-12 border-t-2 border-[#8C52FF]"></div>
      </div>
    </div>
  )
}

// Get max generations based on plan
function getMaxGenerations(plan: string): number {
  switch (plan) {
    case 'premium': return 100
    case 'pro': return 50
    case 'basic': return 10
    default: return 3 // free
  }
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, status, signOut } = useAuth()
  const [showBuyModal, setShowBuyModal] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/login')
    }
  }, [status, navigate])

  if (status === 'loading') {
    return <LoadingSpinner />
  }

  if (!user) {
    return null
  }

  const subscriptionPlan = user.subscription?.plan || 'free'
  const maxGenerations = getMaxGenerations(subscriptionPlan)
  const generationsUsed = maxGenerations - user.generationsLeft
  const progressPercent = Math.min((generationsUsed / maxGenerations) * 100, 100)
  const isLimitExhausted = user.generationsLeft <= 0

  // Progress bar color based on usage
  let progressBarClass = 'progress-bar-fill'
  if (progressPercent >= 100) {
    progressBarClass = 'progress-bar-fill progress-bar-fill-danger'
  } else if (progressPercent >= 80) {
    progressBarClass = 'progress-bar-fill progress-bar-fill-warning'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-10">
        {/* Profile Section */}
        <section className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-black neon-title mb-3 tracking-tight">
            Личный кабинет
          </h1>
          <p className="text-slate-600 font-medium">
            {user.name && <span className="text-slate-800">{user.name}</span>}
            {user.name && user.email && <span className="mx-2 text-slate-300">|</span>}
            {user.email && <span className="text-slate-500">{user.email}</span>}
          </p>
        </section>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {/* Generations with progress bar */}
          <div
            className="stat-card flex flex-col gap-3 px-5 py-4 rounded-2xl cursor-pointer group hover:shadow-lg hover:border-purple-200 transition-all"
            onClick={() => setShowBuyModal(true)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <BoltIcon className="w-5 h-5 text-[#8C52FF]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Генерации</span>
                <p className="text-sm font-bold text-slate-900">{user.generationsLeft} осталось</p>
              </div>
              <div className="text-xs text-purple-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                + Пополнить
              </div>
            </div>
            {/* Progress bar */}
            <div className="progress-bar-container">
              <div className={progressBarClass} style={{ width: `${progressPercent}%` }}></div>
            </div>
            {isLimitExhausted && (
              <span className="text-xs font-semibold text-[#8C52FF]">
                Нажмите чтобы пополнить →
              </span>
            )}
          </div>

          {/* Subscription / Tariff */}
          <div className="stat-card flex items-center gap-3 px-5 py-4 rounded-2xl cursor-pointer group">
            <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
              <DocumentIcon className="w-5 h-5 text-[#8C52FF]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Тариф</span>
              <p className="text-lg font-bold text-slate-900">{formatPlanName(subscriptionPlan)}</p>
            </div>
          </div>

          {/* Gift Certificate - Special card */}
          <div className="stat-card stat-card-special flex items-center gap-3 px-5 py-4 rounded-2xl cursor-pointer group">
            <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors relative">
              <GiftIcon className="w-5 h-5 text-emerald-600" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-emerald-600 uppercase tracking-wider font-semibold">Дополнительный</span>
              <p className="text-base font-bold text-emerald-700">бонус</p>
            </div>
          </div>
        </div>

        {/* Worksheets Section */}
        <section className="mb-8">
          <WorksheetManager />
        </section>

        {/* Presentations Section */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="section-badge">0</span>
            <h2 className="text-lg font-bold text-slate-900">Презентации</h2>
            <ArrowRightIcon className="w-5 h-5 text-slate-400" />
          </div>

          <div className="glass-container p-6">
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-xl mb-3">
                <PresentationIcon className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-400 text-sm">Презентаций пока нет</p>
            </div>
          </div>
        </section>

        {/* Support Section */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Поддержка</h2>
          <div className="glass-container p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <ChatIcon className="w-6 h-6 text-[#8C52FF]" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Нужна помощь?</p>
                <p className="text-sm text-slate-500">Напишите нам в Telegram</p>
              </div>
              <a
                href="https://t.me/mama_umnivera"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-medium text-sm transition-colors"
              >
                Написать
              </a>
            </div>
          </div>
        </section>

        {/* Sign Out Button */}
        <div className="text-center pt-4 border-t border-slate-100">
          <button
            onClick={signOut}
            className="px-8 py-3.5 text-slate-500 hover:text-slate-700 font-medium transition-colors"
          >
            Выйти из аккаунта
          </button>
        </div>
      </main>

      {/* Buy Generations Modal */}
      <BuyGenerationsModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />
    </div>
  )
}
