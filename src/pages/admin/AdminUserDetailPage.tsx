import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdminUserDetail,
  blockUser,
  unblockUser,
  formatProviderName,
  formatRoleName,
  formatGenerationStatus,
  formatDateTime,
  formatDate,
} from '../../lib/admin-api'
import { formatSubjectName, formatPlanName } from '../../lib/dashboard-api'

// Icon components
function ArrowLeftIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  )
}

function UserIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
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

function LockClosedIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  )
}

function LockOpenIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  )
}

function DocumentIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => fetchAdminUserDetail(id!),
    enabled: !!id,
  })

  const blockMutation = useMutation({
    mutationFn: () => blockUser(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setActionError(null)
    },
    onError: (err: Error) => {
      setActionError(err.message)
    },
  })

  const unblockMutation = useMutation({
    mutationFn: () => unblockUser(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setActionError(null)
    },
    onError: (err: Error) => {
      setActionError(err.message)
    },
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

  if (error || !data) {
    return (
      <div className="glass-container p-6">
        <p className="text-red-500 text-center">Ошибка загрузки данных пользователя</p>
        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/admin/users')}
            className="text-[#8C52FF] hover:underline"
          >
            Вернуться к списку
          </button>
        </div>
      </div>
    )
  }

  const { user, generations, worksheets } = data
  const isProcessing = blockMutation.isPending || unblockMutation.isPending

  // Status color for generations
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700'
      case 'failed': return 'bg-red-100 text-red-700'
      case 'processing': return 'bg-blue-100 text-blue-700'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Назад к списку
      </Link>

      {/* User info card */}
      <div className="glass-container p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="w-20 h-20 rounded-2xl object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-slate-200 flex items-center justify-center">
              <UserIcon className="w-10 h-10 text-slate-400" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className={`text-2xl font-bold ${user.isBlocked ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {user.name || 'Без имени'}
              </h2>
              {/* Status badge */}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                user.isBlocked
                  ? 'bg-red-100 text-red-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {user.isBlocked ? (
                  <>
                    <LockClosedIcon className="w-3.5 h-3.5" />
                    Заблокирован
                  </>
                ) : (
                  'Активен'
                )}
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                user.role === 'admin'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {formatRoleName(user.role)}
              </span>
            </div>
            <p className="text-slate-500 mb-4">{user.email}</p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Провайдер</p>
                <p className="text-sm font-medium text-slate-900">{formatProviderName(user.provider)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Тариф</p>
                <p className="text-sm font-medium text-slate-900">{formatPlanName(user.subscription.plan)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Генераций осталось</p>
                <p className="text-sm font-medium text-slate-900">{user.generationsLeft}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Всего листов</p>
                <p className="text-sm font-medium text-slate-900">{user.worksheetsCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Генераций</p>
                <p className="text-sm font-medium text-slate-900">{user.generationsCount}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {user.isBlocked ? (
              <button
                onClick={() => unblockMutation.mutate()}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                <LockOpenIcon className="w-5 h-5" />
                Разблокировать
              </button>
            ) : (
              <button
                onClick={() => blockMutation.mutate()}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                <LockClosedIcon className="w-5 h-5" />
                Заблокировать
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {actionError}
          </div>
        )}
      </div>

      {/* Details cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-container p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">ID пользователя</p>
          <p className="text-sm font-mono text-slate-600 break-all">{user.id}</p>
        </div>
        <div className="glass-container p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Provider ID</p>
          <p className="text-sm font-mono text-slate-600 break-all">{user.providerId || '-'}</p>
        </div>
        <div className="glass-container p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Дата регистрации</p>
          <p className="text-sm font-medium text-slate-900">{formatDateTime(user.createdAt)}</p>
        </div>
        <div className="glass-container p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Последнее обновление</p>
          <p className="text-sm font-medium text-slate-900">{formatDateTime(user.updatedAt)}</p>
        </div>
      </div>

      {/* Generations history */}
      <div className="glass-container overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BoltIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">История генераций</h3>
            <span className="text-sm text-slate-500">(последние 20)</span>
          </div>
        </div>

        {generations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Генераций пока нет</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Дата</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Статус</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Предмет</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Класс</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Тема</th>
                </tr>
              </thead>
              <tbody>
                {generations.map((gen) => (
                  <tr key={gen.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {formatDateTime(gen.createdAt)}
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        Завершено
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {gen.subject ? formatSubjectName(gen.subject) : '-'}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {gen.grade ? `${gen.grade} класс` : '-'}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600 max-w-xs truncate">
                      {gen.topic || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Worksheets (saved) */}
      <div className="glass-container overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DocumentIcon className="w-5 h-5 text-[#8C52FF]" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Сохраненные листы</h3>
            <span className="text-sm text-slate-500">(последние 20)</span>
          </div>
        </div>

        {worksheets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Сохраненных листов пока нет</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Дата</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Предмет</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Класс</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Тема</th>
                </tr>
              </thead>
              <tbody>
                {worksheets.map((ws) => (
                  <tr key={ws.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {formatDateTime(ws.createdAt)}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {formatSubjectName(ws.subject)}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {ws.grade} класс
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600 max-w-xs truncate">
                      {ws.title || ws.topic}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
