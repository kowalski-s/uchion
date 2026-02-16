import React, { useEffect } from 'react'
import { useNavigate, Link, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { fetchAdminStats } from '../../lib/admin-api'
import Header from '../../components/Header'

// Icon components
function UsersIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function BoltIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  )
}

function CreditCardIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
    </svg>
  )
}

function ChartIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  )
}

function CurrencyIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function CogIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
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

function AccessDenied() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">403</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Доступ запрещен</h1>
        <p className="text-slate-600 mb-6">У вас нет прав для просмотра этой страницы</p>
        <Link
          to="/dashboard"
          className="px-6 py-3 bg-[#8C52FF] text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
        >
          Вернуться в кабинет
        </Link>
      </div>
    </div>
  )
}

// Navigation items
const navItems = [
  { path: '/admin', label: 'Обзор', icon: ChartIcon, exact: true },
  { path: '/admin/users', label: 'Пользователи', icon: UsersIcon },
  { path: '/admin/generations', label: 'Генерации', icon: BoltIcon },
  { path: '/admin/payments', label: 'Платежи', icon: CreditCardIcon },
  { path: '/admin/ai-costs', label: 'AI-расходы', icon: CurrencyIcon },
  { path: '/admin/settings', label: 'Настройки', icon: CogIcon },
]

export default function AdminPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, status } = useAuth()

  // Check access
  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/login')
    }
  }, [status, navigate])

  if (status === 'loading') {
    return <LoadingSpinner />
  }

  if (!user || user.role !== 'admin') {
    return <AccessDenied />
  }

  // Check if current path matches nav item
  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
      <Header />

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Админ-панель</h1>
          <p className="text-slate-500 mt-1">Управление сервисом Uchion</p>
        </div>

        {/* Navigation */}
        <nav className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path, item.exact)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#8C52FF] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Content */}
        <Outlet />
      </div>
    </div>
  )
}

// Stats overview component (default view)
export function AdminOverview() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchAdminStats,
    staleTime: 30 * 1000, // 30 seconds
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="relative">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200"></div>
          <div className="absolute inset-0 animate-spin rounded-full h-8 w-8 border-t-2 border-[#8C52FF]"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-container p-6 text-center">
        <p className="text-red-500">Ошибка загрузки статистики</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={UsersIcon}
          label="Всего пользователей"
          value={stats?.totalUsers || 0}
          color="purple"
        />
        <StatCard
          icon={BoltIcon}
          label="Генераций сегодня"
          value={stats?.todayGenerations || 0}
          color="blue"
        />
        <StatCard
          icon={CreditCardIcon}
          label="Активных подписок"
          value={stats?.activeSubscriptions || 0}
          color="green"
        />
        <StatCard
          icon={ChartIcon}
          label="Всего генераций"
          value={stats?.totalGenerations || 0}
          color="orange"
        />
      </div>

      {/* Quick Links */}
      <div className="glass-container p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Быстрые действия</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/admin/users"
            className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <div className="p-2 bg-purple-100 rounded-lg">
              <UsersIcon className="w-5 h-5 text-[#8C52FF]" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Управление пользователями</p>
              <p className="text-sm text-slate-500">Просмотр, поиск, блокировка</p>
            </div>
          </Link>
          <Link
            to="/admin/generations"
            className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <div className="p-2 bg-blue-100 rounded-lg">
              <BoltIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">История генераций</p>
              <p className="text-sm text-slate-500">Логи и статистика</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

// Stat card component
interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: 'purple' | 'blue' | 'green' | 'orange'
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    purple: 'bg-purple-100 text-[#8C52FF]',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    orange: 'bg-orange-100 text-orange-600',
  }

  return (
    <div className="glass-container p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value.toLocaleString('ru-RU')}</p>
    </div>
  )
}
